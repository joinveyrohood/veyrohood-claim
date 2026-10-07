import { discordInviteUrl, officialUsername, pinnedPostUrl } from "./config";
import { ensureXAccess } from "./x";
import { supabaseAdmin } from "./supabase";

const PAID_X_MISSIONS = new Set(["like_pinned", "repost_pinned"]);

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
    return Boolean(user?.discord_user_id);
  }
  throw new Error("Unknown mission.");
}

export function missionTarget(code: string, storedUrl?: string | null) {
  if (code === "follow_x") return `https://x.com/${officialUsername()}`;
  if (code === "join_discord") return "/api/auth/discord/start";
  if (code === "like_pinned" || code === "repost_pinned") return pinnedPostUrl() || storedUrl || "";
  return storedUrl || "";
}

export { discordInviteUrl };
