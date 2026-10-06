import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { data, error } = await supabaseAdmin()
    .from("withdrawals")
    .select("id, user_id, amount, network, wallet_address, status, tx_hash, admin_note, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ withdrawals: data || [] });
}
