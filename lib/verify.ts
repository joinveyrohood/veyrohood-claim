import { discordInviteUrl, officialUsername, pinnedPostUrl, tweetIdFromUrl } from "./config";
import { ensureXAccess, xGet } from "./x";
import { supabaseAdmin } from "./supabase";

async function lookupOfficialId(token: string) {
  const username = officialUsername();
  const result = await xGet(`/2/users/by/username/${encodeURIComponent(username)}`, token);
  if (!result.ok) {
    throw new Error("Could not look up the official X account. Check API access.");
  }
  return result.data.data.id as string;
}

async function followsOfficial(token: string, xUserId: string) {
  const officialId = await lookupOfficialId(token);
  let pagination = "";
  for (let page = 0; page < 5; page += 1) {
    const path = `/2/users/${xUserId}/following?max_results=1000&user.fields=username${pagination}`;
    const result = await xGet(path, token);
    if (!result.ok) {
      const detail = result.data?.detail || result.data?.title || "X API denied the follow lookup.";
      throw new Error(`${detail} Follow check needs follows.read and a permitted X API plan.`);
    }
    const rows = result.data.data || [];
    if (rows.some((row: { id: string; username: string }) => row.id === officialId || row.username?.toLowerCase() === officialUsername().toLowerCase())) {
      return true;
    }
    const next = result.data.meta?.next_token;
    if (!next) return false;
    pagination = `&pagination_token=${encodeURIComponent(next)}`;
  }
  return false;
}

async function likedPinned(token: string, xUserId: string, tweetId: string) {
  let pagination = "";
  for (let page = 0; page < 4; page += 1) {
    const path = `/2/users/${xUserId}/liked_tweets?max_results=100&tweet.fields=id${pagination}`;
    const result = await xGet(path, token);
    if (!result.ok) {
      const detail = result.data?.detail || result.data?.title || "X API denied the like lookup.";
      throw new Error(`${detail} Like check needs like.read and a permitted X API plan.`);
    }
    const rows = result.data.data || [];
    if (rows.some((row: { id: string }) => row.id === tweetId)) return true;
    const next = result.data.meta?.next_token;
    if (!next) return false;
    pagination = `&pagination_token=${encodeURIComponent(next)}`;
  }
  return false;
}

async function repostedPinned(token: string, xUserId: string, tweetId: string) {
  let pagination = "";
  for (let page = 0; page < 4; page += 1) {
    const path = `/2/users/${xUserId}/tweets?max_results=100&tweet.fields=referenced_tweets${pagination}`;
    const result = await xGet(path, token);
    if (!result.ok) {
      const detail = result.data?.detail || result.data?.title || "X API denied the repost lookup.";
      throw new Error(`${detail} Repost check needs tweet.read and a permitted X API plan.`);
    }
    const rows = result.data.data || [];
    const hit = rows.some((row: { referenced_tweets?: { type: string; id: string }[] }) =>
      (row.referenced_tweets || []).some((ref) => ref.type === "retweeted" && ref.id === tweetId)
    );
    if (hit) return true;
    const next = result.data.meta?.next_token;
    if (!next) return false;
    pagination = `&pagination_token=${encodeURIComponent(next)}`;
  }
  return false;
}

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
    return followsOfficial(access.token, access.xUserId);
  }
  if (code === "like_pinned" || code === "repost_pinned") {
    const url = pinnedPostUrl();
    const tweetId = tweetIdFromUrl(url);
    if (!url || !tweetId) {
      throw new Error("Pinned post URL is not configured yet. Set X_PINNED_POST_URL, then verify again.");
    }
    const access = await ensureXAccess(userId);
    return code === "like_pinned"
      ? likedPinned(access.token, access.xUserId, tweetId)
      : repostedPinned(access.token, access.xUserId, tweetId);
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
