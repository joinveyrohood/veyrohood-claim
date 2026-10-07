import { ACTION_MISSIONS, discordInviteUrl, officialUsername, pinnedPostUrl } from "./config";
import { ensureXAccess } from "./x";
import { supabaseAdmin } from "./supabase";

export async function verifyMission(userId: string, code: string) {
  const db = supabaseAdmin();
  if (code === "follow_x") {
    const access = await ensureXAccess(userId);
    return Boolean(access.xUserId);
  }
  if ((ACTION_MISSIONS as readonly string[]).includes(code)) {
    throw new Error("This task is not checked with the X API. Open the post, then mark the action done.");
  }
  if (code === "join_discord") {
    const { data: user } = await db.from("users").select("discord_user_id").eq("id", userId).single();
    return Boolean(user?.discord_user_id);
  }
  throw new Error("Unknown mission.");
}

export function missionTarget(code: string, storedUrl?: string | null) {
  if (code === "follow_x") return `https://x.com/${officialUsername()}`;
  if (code === "join_discord") return discordInviteUrl();
  if (code === "like_pinned" || code === "repost_pinned" || code === "reply_pinned") return pinnedPostUrl() || storedUrl || "";
  return storedUrl || "";
}

export { discordInviteUrl };
