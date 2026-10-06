import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  self_reported_name: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(60),
  note: z.string().trim().max(400).optional()
});

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { data } = await supabaseAdmin()
    .from("kyc")
    .select("status, provider, provider_reference, self_reported_name, country, note, rejection_reason, reviewed_at, created_at")
    .eq("user_id", auth.session!.sub)
    .maybeSingle();
  return NextResponse.json({
    kyc: data || { status: "NOT_STARTED" },
    providerConnected: false,
    notice: "This is a manual review queue. It is not identity verification from Sumsub, Persona, or Stripe Identity."
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const limited = rateLimit(`kyc:${auth.session!.sub}`, 5, 60_000);
  if (!limited.ok) return jsonError("Too many KYC submissions.", 429);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Name and country are required.");

  const db = supabaseAdmin();
  const { data: current } = await db.from("kyc").select("status").eq("user_id", auth.session!.sub).maybeSingle();
  if (current?.status === "APPROVED") return jsonError("KYC is already approved.");
  if (current?.status === "PENDING") return jsonError("KYC is already waiting for review.");

  const { data, error } = await db
    .from("kyc")
    .upsert(
      {
        user_id: auth.session!.sub,
        status: "PENDING",
        provider: "manual",
        self_reported_name: parsed.data.self_reported_name,
        country: parsed.data.country,
        note: parsed.data.note || null,
        rejection_reason: null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    )
    .select("status")
    .single();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ kyc: data });
}
