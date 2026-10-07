import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/http";
import { referralSummary } from "@/lib/referral";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const summary = await referralSummary(auth.session!.sub);
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const limited = rateLimit(`referral:${auth.session!.sub}`, 8, 60_000);
  if (!limited.ok) return jsonError("Too many referral requests.", 429);
  const body = await request.json().catch(() => ({}));
  if (body.action !== "withdraw") return jsonError("Unknown referral action.");
  const summary = await referralSummary(auth.session!.sub);
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > summary.available) return jsonError("Amount exceeds available referral balance.");
  const { error } = await supabaseAdmin().from("transactions").insert({
    user_id: auth.session!.sub,
    type: "REFERRAL_WITHDRAWAL",
    amount,
    status: "PENDING"
  });
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, available: Number((summary.available - amount).toFixed(2)) });
}
