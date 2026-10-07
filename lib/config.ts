export const REWARD_AMOUNTS = [20, 25, 30, 40, 50, 60, 75, 100] as const;
export type RewardAmount = (typeof REWARD_AMOUNTS)[number];

export const NETWORKS = ["Ethereum", "Base", "Arbitrum", "BNB Chain", "Polygon"] as const;
export type Network = (typeof NETWORKS)[number];

export const MISSION_CODES = ["follow_x", "join_discord", "like_pinned", "repost_pinned", "reply_pinned"] as const;
export type MissionCode = (typeof MISSION_CODES)[number];

export const ACTION_MISSIONS = ["like_pinned", "repost_pinned", "reply_pinned"] as const;

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function officialUsername() {
  return (process.env.X_OFFICIAL_USERNAME || "VeyroHood").trim().replace(/^@/, "");
}

export function pinnedPostUrl() {
  return (process.env.X_PINNED_POST_URL || "").trim();
}

export function discordInviteUrl() {
  return process.env.DISCORD_INVITE_URL || "https://discord.gg/ZKWGaxafe";
}

export function followUrl() {
  return `https://x.com/${officialUsername()}`;
}

export function referralRewardConfig() {
  const flat = Number(process.env.REFERRAL_REWARD_AMOUNT || "");
  const percent = Number(process.env.REFERRAL_REWARD_PERCENT || "10");
  return {
    flat: Number.isFinite(flat) && flat > 0 ? flat : 0,
    percent: Number.isFinite(percent) && percent >= 0 ? percent : 10
  };
}

export function referralRewardFor(scratchAmount: number) {
  const config = referralRewardConfig();
  if (config.flat > 0) return Number(config.flat.toFixed(2));
  return Number(((scratchAmount * config.percent) / 100).toFixed(2));
}

export function tweetIdFromUrl(url: string) {
  const match = url.match(/status\/(\d+)/);
  return match?.[1] || null;
}

export function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_SECRET || "";
}
