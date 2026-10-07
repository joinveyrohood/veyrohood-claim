import { ACTION_MISSIONS, discordInviteUrl, officialUsername, pinnedPostUrl } from "./config";
import { supabaseAdmin } from "./supabase";

export async function verifyMission(userId: string, code: string) {
  if ((ACTION_MISSIONS as readonly string[]).includes(code)) {
    throw new Error("This task is not checked with the X API. Open the link, then mark it done.");
  }
  if (code === "join_discord") {
    const { data: user } = await supabaseAdmin().from("users").select("discord_user_id").eq("id", userId).single();
    return Boolean(user?.discord_user_id);
  }
  throw new Error("Unknown mission.");
}

export function missionTarget(code: string) {
  if (code === "follow_x") return `https://x.com/${officialUsername()}`;
  if (code === "join_discord") return discordInviteUrl();
  return pinnedPostUrl();
}

export { discordInviteUrl };
