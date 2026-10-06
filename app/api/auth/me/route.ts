import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";
import { availableBalance, missionProgress } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const db = supabaseAdmin();
  const { data: user, error } = await db
    .from("users")
    .select("id, x_user_id, x_username, display_name, avatar_url, discord_user_id, created_at")
    .eq("id", auth.session!.sub)
    .single();
  if (error || !user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const progress = await missionProgress(user.id);
  const balance = await availableBalance(user.id);
  const { data: kyc } = await db.from("kyc").select("status, rejection_reason").eq("user_id", user.id).maybeSingle();
  const { data: wallet } = await db
    .from("wallets")
    .select("network, address")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .maybeSingle();
  const { data: reward } = await db
    .from("scratch_rewards")
    .select("amount, revealed")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    user,
    progress: { completed: progress.completed, total: progress.total },
    balance,
    kyc: kyc || { status: "NOT_STARTED" },
    wallet,
    reward: reward ? { amount: Number(reward.amount), revealed: reward.revealed } : null
  });
}
