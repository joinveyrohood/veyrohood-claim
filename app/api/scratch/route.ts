import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/http";
import { missionProgress } from "@/lib/account";
import { generateRewardAmount } from "@/lib/rewards";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { creditReferral } from "@/lib/referral";

export const dynamic = "force-dynamic";

function unlocked(progress: { completed: number; total: number }) {
  return progress.total > 0 && progress.completed >= progress.total;
}

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const db = supabaseAdmin();
  const { data } = await db.from("scratch_rewards").select("amount, revealed, revealed_at").eq("user_id", auth.session!.sub).maybeSingle();
  const { data: credit } = await db.from("transactions").select("id").eq("user_id", auth.session!.sub).eq("type", "REWARD_CREDIT").maybeSingle();
  const progress = await missionProgress(auth.session!.sub);
  return NextResponse.json({
    unlocked: unlocked(progress),
    completed: progress.completed,
    total: progress.total,
    reward: data ? { amount: data.revealed ? Number(data.amount) : null, revealed: data.revealed, claimed: Boolean(credit) } : null
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const limited = rateLimit(`scratch:${auth.session!.sub}`, 8, 60_000);
  if (!limited.ok) return jsonError("Too many scratch requests.", 429);
  const body = await request.json().catch(() => ({}));
  const action = body.action === "claim" ? "claim" : body.action === "reveal" ? "reveal" : "generate";
  const progress = await missionProgress(auth.session!.sub);
  if (!unlocked(progress)) return jsonError("Complete all missions before scratching.", 403);
  const db = supabaseAdmin();
  const { data: existing } = await db.from("scratch_rewards").select("id, amount, revealed").eq("user_id", auth.session!.sub).maybeSingle();

  if (action === "generate") {
    if (existing) return NextResponse.json({ amount: existing.revealed ? Number(existing.amount) : null, revealed: existing.revealed, created: false });
    const amount = generateRewardAmount();
    const { error } = await db.from("scratch_rewards").insert({ user_id: auth.session!.sub, amount, revealed: false });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ amount: null, revealed: false, created: true });
  }

  if (!existing) return jsonError("Generate the scratch reward first.", 409);
  if (action === "reveal") {
    if (!existing.revealed) {
      await db.from("scratch_rewards").update({ revealed: true, revealed_at: new Date().toISOString() }).eq("id", existing.id).eq("revealed", false);
    }
    return NextResponse.json({ amount: Number(existing.amount), revealed: true, claimed: false });
  }

  if (!existing.revealed) return jsonError("Scratch the card before claiming.", 409);
  const { data: credit } = await db.from("transactions").select("id").eq("user_id", auth.session!.sub).eq("type", "REWARD_CREDIT").maybeSingle();
  if (!credit) {
    const { error } = await db.from("transactions").insert({ user_id: auth.session!.sub, type: "REWARD_CREDIT", amount: existing.amount, status: "COMPLETED", reference_id: existing.id });
    if (error && !String(error.message).toLowerCase().includes("duplicate")) return jsonError(error.message, 500);
    await creditReferral(auth.session!.sub, Number(existing.amount));
  }
  return NextResponse.json({ amount: Number(existing.amount), revealed: true, claimed: true });
}
