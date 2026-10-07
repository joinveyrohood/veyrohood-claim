import { supabaseAdmin } from "./supabase";

const DISABLED_PAID_MISSIONS = new Set(["like_pinned", "repost_pinned"]);

export async function availableBalance(userId: string) {
  const db = supabaseAdmin();
  const { data: reward } = await db
    .from("scratch_rewards")
    .select("amount, revealed")
    .eq("user_id", userId)
    .maybeSingle();

  if (!reward?.revealed) {
    return { reward: reward ? Number(reward.amount) : 0, revealed: false, locked: 0, available: 0 };
  }

  const { data: rows } = await db
    .from("withdrawals")
    .select("amount, status")
    .eq("user_id", userId)
    .in("status", ["PENDING", "APPROVED", "PAID"]);

  const locked = (rows || []).reduce((sum, row) => sum + Number(row.amount), 0);
  const amount = Number(reward.amount);
  return {
    reward: amount,
    revealed: true,
    locked,
    available: Math.max(0, Number((amount - locked).toFixed(2)))
  };
}

export async function missionProgress(userId: string) {
  const db = supabaseAdmin();
  const { data: missions } = await db
    .from("missions")
    .select("id, code, title, description, type, target_url, sort_order, active")
    .eq("active", true)
    .order("sort_order");

  const { data: states } = await db
    .from("user_missions")
    .select("mission_id, status, last_error, verified_at")
    .eq("user_id", userId);

  const byMission = new Map((states || []).map((row) => [row.mission_id, row]));
  const cards = (missions || [])
    .filter((mission) => !DISABLED_PAID_MISSIONS.has(mission.code))
    .map((mission) => {
      const state = byMission.get(mission.id);
      return {
        ...mission,
        status: state?.status || "NOT_STARTED",
        last_error: state?.last_error || null,
        verified_at: state?.verified_at || null
      };
    });
  const completed = cards.filter((card) => card.status === "COMPLETED").length;
  return { cards, completed, total: cards.length };
}
