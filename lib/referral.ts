import { appUrl, referralRewardConfig, referralRewardFor } from "./config";
import { supabaseAdmin } from "./supabase";

type Referrer = { id: string; x_username?: string; referral_code?: string | null };

function codeFromUser(id: string) {
  return id.replace(/-/g, "").slice(0, 10);
}

export async function ensureReferralCode(userId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.from("users").select("id, referral_code").eq("id", userId).maybeSingle();
  if (error || !data) return codeFromUser(userId);
  if (data.referral_code) return String(data.referral_code);
  const code = codeFromUser(userId);
  const saved = await db.from("users").update({ referral_code: code }).eq("id", userId).is("referral_code", null);
  if (saved.error) return code;
  return code;
}

async function findReferrer(code: string): Promise<Referrer | null> {
  const db = supabaseAdmin();
  const clean = code.trim();
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(clean)) return null;
  const byCode = await db.from("users").select("id, x_username, referral_code").eq("referral_code", clean).maybeSingle();
  if (byCode.data?.id) return byCode.data as Referrer;
  const { data: users } = await db.from("users").select("id, x_username").limit(500);
  const match = (users || []).find((user) => codeFromUser(user.id) === clean.toLowerCase());
  return match ? { id: match.id, x_username: match.x_username, referral_code: codeFromUser(match.id) } : null;
}

export async function attributeReferral(userId: string, code: string | null | undefined) {
  if (!code) return { attached: false, reason: "missing" };
  const db = supabaseAdmin();
  const referrer = await findReferrer(code);
  if (!referrer?.id) return { attached: false, reason: "unknown" };
  if (referrer.id === userId) return { attached: false, reason: "self" };

  const existingBind = await db.from("transactions").select("id, reference_id").eq("user_id", userId).eq("type", "REFERRAL_BIND").maybeSingle();
  if (existingBind.data) return { attached: false, reason: "already" };

  const { data: user } = await db.from("users").select("id, referred_by").eq("id", userId).maybeSingle();
  if (user && user.referred_by) return { attached: false, reason: "already" };

  const { error } = await db.from("transactions").insert({
    user_id: userId,
    type: "REFERRAL_BIND",
    amount: 0,
    status: "COMPLETED",
    reference_id: referrer.id
  });
  if (error) return { attached: false, reason: error.message };
  await db.from("users").update({ referred_by: referrer.id }).eq("id", userId).is("referred_by", null);
  await db.from("referrals").insert({
    referrer_id: referrer.id,
    referred_id: userId,
    code: referrer.referral_code || code,
    status: "PENDING",
    reward_amount: 0
  });
  return { attached: true, reason: "ok" };
}

export async function creditReferral(referredId: string, scratchAmount: number) {
  const db = supabaseAdmin();
  const { data: bind } = await db.from("transactions").select("reference_id").eq("user_id", referredId).eq("type", "REFERRAL_BIND").maybeSingle();
  if (!bind?.reference_id || bind.reference_id === referredId) return;
  const { data: already } = await db.from("transactions").select("id").eq("user_id", bind.reference_id).eq("type", "REFERRAL_CREDIT").eq("reference_id", referredId).maybeSingle();
  if (already) return;
  const amount = referralRewardFor(scratchAmount);
  if (amount <= 0) return;
  await db.from("transactions").insert({
    user_id: bind.reference_id,
    type: "REFERRAL_CREDIT",
    amount,
    status: "COMPLETED",
    reference_id: referredId
  });
  await db.from("referrals").update({ status: "CREDITED", reward_amount: amount, credited_at: new Date().toISOString() }).eq("referred_id", referredId);
}

export async function referralSummary(userId: string) {
  const db = supabaseAdmin();
  const code = await ensureReferralCode(userId);
  const { data: binds } = await db.from("transactions").select("user_id, created_at, reference_id").eq("type", "REFERRAL_BIND").eq("reference_id", userId);
  const { data: credits } = await db.from("transactions").select("amount, created_at, reference_id, status").eq("user_id", userId).eq("type", "REFERRAL_CREDIT");
  const { data: payouts } = await db.from("transactions").select("amount, created_at, status").eq("user_id", userId).eq("type", "REFERRAL_WITHDRAWAL");
  const earned = (credits || []).reduce((sum, row) => sum + Number(row.amount), 0);
  const withdrawn = (payouts || []).filter((row) => row.status !== "REJECTED").reduce((sum, row) => sum + Number(row.amount), 0);
  const ids = (binds || []).map((row) => row.user_id);
  const { data: people } = ids.length ? await db.from("users").select("id, x_username, created_at").in("id", ids) : { data: [] as { id: string; x_username: string }[] };
  const names = new Map((people || []).map((person) => [person.id, person.x_username]));
  const config = referralRewardConfig();
  return {
    code,
    link: `${appUrl()}/?ref=${code}`,
    count: (binds || []).length,
    earned: Number(earned.toFixed(2)),
    withdrawn: Number(withdrawn.toFixed(2)),
    available: Number(Math.max(0, earned - withdrawn).toFixed(2)),
    config,
    history: (binds || []).map((row) => ({
      username: names.get(row.user_id) || "user",
      created_at: row.created_at,
      earned: Number((credits || []).find((credit) => credit.reference_id === row.user_id)?.amount || 0)
    }))
  };
}
