import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const db = supabaseAdmin();

  const [users, missions, rewards, kyc, withdrawals] = await Promise.all([
    db.from("users").select("id", { count: "exact", head: true }),
    db.from("user_missions").select("id", { count: "exact", head: true }).eq("status", "COMPLETED"),
    db.from("scratch_rewards").select("amount, revealed"),
    db.from("kyc").select("status"),
    db.from("withdrawals").select("amount, status")
  ]);

  const rewardRows = rewards.data || [];
  const kycRows = kyc.data || [];
  const withdrawalRows = withdrawals.data || [];
  const distributed = rewardRows.filter((row) => row.revealed).reduce((sum, row) => sum + Number(row.amount), 0);
  const withdrawn = withdrawalRows.filter((row) => row.status === "PAID").reduce((sum, row) => sum + Number(row.amount), 0);

  return NextResponse.json({
    totalUsers: users.count || 0,
    missionCompletions: missions.count || 0,
    scratchRewards: rewardRows.length,
    rewardsDistributed: distributed,
    pendingKyc: kycRows.filter((row) => row.status === "PENDING").length,
    approvedKyc: kycRows.filter((row) => row.status === "APPROVED").length,
    pendingWithdrawals: withdrawalRows.filter((row) => row.status === "PENDING" || row.status === "APPROVED").length,
    paidWithdrawals: withdrawalRows.filter((row) => row.status === "PAID").length,
    totalWithdrawn: withdrawn
  });
}
