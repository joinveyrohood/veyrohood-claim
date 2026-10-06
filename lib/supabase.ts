import { createClient, SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function supabaseAdmin() {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured.");
  }
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return admin;
}

export function isEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
