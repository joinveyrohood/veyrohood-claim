import { NextResponse } from "next/server";
import { requireUser } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const db = supabaseAdmin();
  const [{ data: txs }, { data: withdrawals }] = await Promise.all([
    db.from("transactions").select("id, type, amount, status, reference_id, created_at").eq("user_id", auth.session!.sub).order("created_at", { ascending: false }),
    db.from("withdrawals").select("id, amount, network, wallet_address, status, tx_hash, created_at, completed_at").eq("user_id", auth.session!.sub).order("created_at", { ascending: false })
  ]);
  return NextResponse.json({ transactions: txs || [], withdrawals: withdrawals || [] });
}
