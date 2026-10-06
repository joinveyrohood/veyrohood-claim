import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/http";
import { supabaseAdmin, isEvmAddress } from "@/lib/supabase";
import { NETWORKS } from "@/lib/config";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  network: z.enum(NETWORKS),
  address: z.string().trim()
});

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { data } = await supabaseAdmin()
    .from("wallets")
    .select("id, network, address, is_primary, created_at")
    .eq("user_id", auth.session!.sub)
    .order("created_at", { ascending: false });
  return NextResponse.json({ wallets: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const limited = rateLimit(`wallet:${auth.session!.sub}`, 10, 60_000);
  if (!limited.ok) return jsonError("Too many wallet updates.", 429);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Choose a supported network and wallet address.");
  if (!isEvmAddress(parsed.data.address)) return jsonError("Address must be a public 0x EVM address.");

  const db = supabaseAdmin();
  await db.from("wallets").update({ is_primary: false }).eq("user_id", auth.session!.sub);
  const { data, error } = await db
    .from("wallets")
    .insert({
      user_id: auth.session!.sub,
      network: parsed.data.network,
      address: parsed.data.address,
      is_primary: true,
      verified: false
    })
    .select("id, network, address")
    .single();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ wallet: data });
}
