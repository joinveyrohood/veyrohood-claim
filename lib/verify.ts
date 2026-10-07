import { discordInviteUrl, officialUsername, pinnedPostUrl } from "./config";
import { ensureXAccess } from "./x";
import { supabaseAdmin } from "./supabase";

const PAID_X_MISSIONS = new Set(["like_pinned", "repost_pinned"]);

async function discordMember(discordUserId: string) {
  const bot = process.env.DISCORD_BOT_TOKEN;
  const guild = process.env.DISCORD_GUILD_ID;
  if (!bot || !guild) {
    throw new Error("Discord verification is not configured. Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID. Joining the invite alone does not complete this mission.");
  }
  const res = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${bot}` }
  });
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error("Discord membership check failed. Confirm the bot is in the server and can view members.");
  }
  return true;
}

export async function verifyMission(userId: string, code: string) {
  const db = supabaseAdmin();
  if (code === "follow_x") {
    const access = await ensureXAccess(userId);
    return Boolean(access.xUserId);
  }
  if (PAID_X_MISSIONS.has(code)) {
    throw new Error("Like and repost checks used paid X API endpoints and are disabled. This mission is not required.");
  }
  if (code === "join_discord") {
    const { data: user } = await db.from("users").select("discord_user_id").eq("id", userId).single();
    if (!user?.discord_user_id) {
      throw new Error("Connect Discord first, then verify membership. Opening the invite does not complete this mission.");
    }
    return discordMember(user.discord_user_id);
  }
  throw new Error("Unknown mission.");
}

export function missionTarget(code: string, storedUrl?: string | null) {
  if (code === "follow_x") return `https://x.com/${officialUsername()}`;
  if (code === "join_discord") return discordInviteUrl();
  if (code === "like_pinned" || code === "repost_pinned") return pinnedPostUrl() || storedUrl || "";
  return storedUrl || "";
}
