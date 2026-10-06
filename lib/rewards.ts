import { REWARD_AMOUNTS, type RewardAmount } from "./config";

export function generateRewardAmount(): RewardAmount {
  const index = crypto.getRandomValues(new Uint32Array(1))[0] % REWARD_AMOUNTS.length;
  return REWARD_AMOUNTS[index];
}

export function money(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return n.toFixed(2);
}
