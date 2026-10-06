import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/http";
import { supabaseAdmin, isEvmAddress } from "@/lib/supabase";
import { NETWORKS } from "@/lib/config";
import { availableBalance } from "@/lib/account";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.number().positive(),
  network: z.enum(NETWORKS),
  wallet_address: z.string().trim()
});

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const db = supabaseAdmin();
  const balance = await availableBalance(auth.session!.sub);
  const { data: rows } = await db
    .from("withdrawals")
    .select("id, amount, network, wallet_address, status, tx_hash, admin_note, created_at, completed_at")
    .eq("user_id", auth.session!.sub)
    .order("created_at", { ascending: false });
  const { data: kyc } = await db.from("kyc").select("status").eq("user_id", auth.session!.sub).maybeSingle();
  const { data: wallet } = await db
    .from("wallets")
    .select("network, address")
    .eq("user_id", auth.session!.sub)
    .eq("is_primary", true)
    .maybeSingle();
  return NextResponse.json({
    balance,
    kycStatus: kyc?.status || "NOT_STARTED",
    wallet,
    withdrawals: rows || []
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const limited = rateLimit(`withdraw:${auth.session!.sub}`, 5, 60_000);
  if (!limited.ok) return jsonError("Too many withdrawal attempts.", 429);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid withdrawal form.");
  if (!isEvmAddress(parsed.data.wallet_address)) return jsonError("Public EVM address required. Never send a private key.");

  const amount = Number(parsed.data.amount.toFixed(2));
  const { data, error } = await supabaseAdmin().rpc("request_withdrawal", {
    p_user_id: auth.session!.sub,
    p_amount: amount,
    p_network: parsed.data.network,
    p_wallet: parsed.data.wallet_address
  });
  if (error) return jsonError(error.message, 500);
  if (!data?.ok) return jsonError(data?.error || "Withdrawal rejected.", 422);
  return NextResponse.json(data);
}
