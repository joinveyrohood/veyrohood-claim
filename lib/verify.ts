import { discordInviteUrl, officialUsername, pinnedPostUrl, tweetIdFromUrl } from "./config";
import { appBearerToken, ensureXAccess, missingXScopes, userByUsernamePath, xErrorText, xGet, X_SCOPES } from "./x";
import { supabaseAdmin } from "./supabase";

async function lookupOfficialId(userToken: string) {
  const username = officialUsername();
  if (!username) throw new Error("X_OFFICIAL_USERNAME is empty.");
  const path = userByUsernamePath(username);
  const attempts: string[] = [];

  try {
    const appToken = await appBearerToken();
    const appResult = await xGet(path, appToken);
    if (appResult.ok && appResult.data?.data?.id) {
      return {
        id: String(appResult.data.data.id),
        username: String(appResult.data.data.username || username)
      };
    }
    attempts.push(`app bearer: ${xErrorText(appResult)}`);
  } catch (error) {
    attempts.push(`app bearer: ${error instanceof Error ? error.message : "app token failed"}`);
  }

  const userResult = await xGet(path, userToken);
  if (userResult.ok && userResult.data?.data?.id) {
    return {
      id: String(userResult.data.data.id),
      username: String(userResult.data.data.username || username)
    };
  }
  attempts.push(`user token: ${xErrorText(userResult)}`);
  throw new Error(`Could not look up the official X account @${username}. ${attempts.join(" | ")}`);
}

function rowMatches(row: { id?: string; username?: string }, officialId: string, username: string) {
  return row.id === officialId || row.username?.toLowerCase() === username.toLowerCase();
}

async function pageContains(
  token: string,
  pathFor: (pagination: string) => string,
  match: (row: { id?: string; username?: string }) => boolean
) {
  let pagination = "";
  for (let page = 0; page < 10; page += 1) {
    const result = await xGet(pathFor(pagination), token);
    if (!result.ok) return { found: false, error: xErrorText(result), exhausted: false };
    const rows = (result.data.data || []) as { id?: string; username?: string }[];
    if (rows.some(match)) return { found: true, error: null, exhausted: false };
    const next = result.data.meta?.next_token;
    if (!next) return { found: false, error: null, exhausted: true };
    pagination = `&pagination_token=${encodeURIComponent(next)}`;
  }
  return { found: false, error: null, exhausted: false };
}

async function followsOfficial(token: string, xUserId: string, scopes: string | null) {
  const missing = missingXScopes(scopes);
  if (missing && missing.includes("follows.read")) {
    throw new Error(`X token is missing scopes: ${missing.join(", ")}. Reconnect X and approve ${X_SCOPES.join(", ")}.`);
  }
  const official = await lookupOfficialId(token);
  const following = await pageContains(
    token,
    (pagination) => `/2/users/${xUserId}/following?max_results=100&user.fields=id,username${pagination}`,
    (row) => rowMatches(row, official.id, official.username)
  );
  if (following.found) return true;
  if (following.exhausted) return false;

  const followers = await pageContains(
    token,
    (pagination) => `/2/users/${official.id}/followers?max_results=100&user.fields=id,username${pagination}`,
    (row) => row.id === xUserId
  );
  if (followers.found) return true;
  if (followers.exhausted) return false;

  try {
    const appToken = await appBearerToken();
    const appFollowers = await pageContains(
      appToken,
      (pagination) => `/2/users/${official.id}/followers?max_results=100&user.fields=id,username${pagination}`,
      (row) => row.id === xUserId
    );
    if (appFollowers.found) return true;
    if (appFollowers.exhausted) return false;
    if (appFollowers.error) {
      throw new Error(`${following.error || followers.error || appFollowers.error} Follow check needs follows.read, users.read, and tweet.read.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Follow check needs")) throw error;
  }

  throw new Error(`${following.error || followers.error || "X API denied the follow lookup."} Follow check needs follows.read, users.read, and tweet.read. Reconnect X if those scopes were not granted.`);
}

async function likedPinned(token: string, xUserId: string, tweetId: string) {
  let pagination = "";
  for (let page = 0; page < 4; page += 1) {
    const path = `/2/users/${xUserId}/liked_tweets?max_results=100&tweet.fields=id${pagination}`;
    const result = await xGet(path, token);
    if (!result.ok) {
      throw new Error(`${xErrorText(result)} Like check needs like.read and a permitted X API plan.`);
    }
    const rows = (result.data.data || []) as { id?: string }[];
    if (rows.some((row) => row.id === tweetId)) return true;
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
      throw new Error(`${xErrorText(result)} Repost check needs tweet.read and a permitted X API plan.`);
    }
    const rows = (result.data.data || []) as { referenced_tweets?: { type: string; id: string }[] }[];
    const hit = rows.some((row) =>
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
    return followsOfficial(access.token, access.xUserId, access.scopes);
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
