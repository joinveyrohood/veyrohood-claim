import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const kyc = url.searchParams.get("kyc") || "";
  const sort = url.searchParams.get("sort") || "created_at";
  const db = supabaseAdmin();

  const { data: users, error } = await db
    .from("users")
    .select("id, x_user_id, x_username, display_name, avatar_url, created_at")
    .order(sort === "username" ? "x_username" : "created_at", { ascending: sort === "username" })
    .limit(200);
  if (error) return jsonError(error.message, 500);

  const ids = (users || []).map((user) => user.id);
  const [missionStates, missionDefs, rewards, kycRows, wallets, withdrawals] = await Promise.all([
    db.from("user_missions").select("user_id, status, mission_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    db.from("missions").select("id").eq("active", true),
    db.from("scratch_rewards").select("user_id, amount, revealed").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    db.from("kyc").select("user_id, status").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    db.from("wallets").select("user_id, network, address").eq("is_primary", true).in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    db.from("withdrawals").select("user_id, amount, status, tx_hash, created_at").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("created_at", { ascending: false })
  ]);

  const missionTotal = missionDefs.data?.length || 4;
  const rows = (users || [])
    .map((user) => {
      const states = (missionStates.data || []).filter((row) => row.user_id === user.id);
      const completed = states.filter((row) => row.status === "COMPLETED").length;
      const reward = (rewards.data || []).find((row) => row.user_id === user.id);
      const kycRow = (kycRows.data || []).find((row) => row.user_id === user.id);
      const wallet = (wallets.data || []).find((row) => row.user_id === user.id);
      const latest = (withdrawals.data || []).find((row) => row.user_id === user.id);
      return {
        ...user,
        missionProgress: `${completed}/${missionTotal}`,
        missionStatus: completed >= missionTotal ? "COMPLETED" : states.some((row) => row.status === "FAILED") ? "FAILED" : "IN_PROGRESS",
        scratchReward: reward ? Number(reward.amount) : null,
        rewardRevealed: Boolean(reward?.revealed),
        balance: reward?.revealed ? Number(reward.amount) : 0,
        kycStatus: kycRow?.status || "NOT_STARTED",
        walletAddress: wallet ? `${wallet.network}: ${wallet.address}` : null,
        withdrawalStatus: latest?.status || null,
        withdrawalAmount: latest ? Number(latest.amount) : null,
        txHash: latest?.tx_hash || null
      };
    })
    .filter((row) => {
      const text = `${row.x_username} ${row.display_name || ""} ${row.id}`.toLowerCase();
      if (q && !text.includes(q)) return false;
      if (kyc && row.kycStatus !== kyc) return false;
      return true;
    });

  return NextResponse.json({ users: rows });
}

const actionSchema = z.object({
  action: z.enum(["approve_kyc", "reject_kyc", "approve_withdrawal", "reject_withdrawal", "mark_paid", "complete_mission"]),
  userId: z.string().uuid().optional(),
  withdrawalId: z.string().uuid().optional(),
  txHash: z.string().trim().max(120).optional(),
  reason: z.string().trim().max(300).optional(),
  missionCode: z.string().optional()
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid admin action.");
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const { action, userId, withdrawalId, txHash, reason, missionCode } = parsed.data;

  if (action === "approve_kyc" || action === "reject_kyc") {
    if (!userId) return jsonError("User required.");
    const status = action === "approve_kyc" ? "APPROVED" : "REJECTED";
    const { error } = await db
      .from("kyc")
      .upsert(
        {
          user_id: userId,
          status,
          provider: "manual",
          rejection_reason: status === "REJECTED" ? reason || "Rejected by admin" : null,
          reviewed_at: now,
          updated_at: now
        },
        { onConflict: "user_id" }
      );
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, status });
  }

  if (action === "complete_mission") {
    if (!userId || !missionCode) return jsonError("User and mission required.");
    const { data: mission } = await db.from("missions").select("id").eq("code", missionCode).single();
    if (!mission) return jsonError("Mission not found.", 404);
    const { error } = await db.from("user_missions").upsert(
      {
        user_id: userId,
        mission_id: mission.id,
        status: "COMPLETED",
        last_error: null,
        verified_at: now,
        updated_at: now
      },
      { onConflict: "user_id,mission_id" }
    );
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  if (!withdrawalId) return jsonError("Withdrawal required.");
  if (action === "mark_paid" && !txHash) return jsonError("Transaction hash is required to mark paid.");

  const next =
    action === "approve_withdrawal" ? "APPROVED" : action === "reject_withdrawal" ? "REJECTED" : "PAID";
  const { data: row, error } = await db
    .from("withdrawals")
    .update({
      status: next,
      tx_hash: action === "mark_paid" ? txHash : undefined,
      admin_note: reason || null,
      completed_at: next === "PAID" || next === "REJECTED" ? now : null
    })
    .eq("id", withdrawalId)
    .select("user_id, amount, status")
    .single();
  if (error) return jsonError(error.message, 500);

  await db.from("transactions").insert({
    user_id: row.user_id,
    type: next === "PAID" ? "WITHDRAWAL_PAID" : next === "REJECTED" ? "WITHDRAWAL_REJECTED" : "WITHDRAWAL_APPROVED",
    amount: row.amount,
    status: next,
    reference_id: withdrawalId
  });
  return NextResponse.json({ ok: true, status: next });
}
