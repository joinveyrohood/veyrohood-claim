import { NextResponse } from "next/server";
import { exchangeXCode, fetchXMe, xRedirectUri } from "@/lib/x";
import { applyCookie, clearOauthCookie, decodeOauthPayload, readOauthCookie, sessionCookie, signUserSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import { appUrl } from "@/lib/config";
import { attributeReferral, ensureReferralCode } from "@/lib/referral";

export const dynamic = "force-dynamic";

function readRef(request: Request) {
  const header = request.headers.get("cookie") || "";
  const part = header.split(";").find((item) => item.trim().startsWith("sc_ref="));
  return part ? decodeURIComponent(part.split("=").slice(1).join("=")) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const fail = (message: string) => {
    const res = NextResponse.redirect(`${appUrl()}/login?error=${encodeURIComponent(message)}`);
    applyCookie(res, clearOauthCookie());
    return res;
  };
  if (oauthError) return fail(oauthError);
  if (!code || !state) return fail("Missing OAuth code.");
  const raw = readOauthCookie(request);
  const saved = raw ? decodeOauthPayload(raw) : null;
  if (!saved) return fail("OAuth session expired. Try again.");
  if (saved.state !== state) return fail("OAuth state mismatch.");
  try {
    const token = await exchangeXCode(code, saved.verifier);
    const profile = await fetchXMe(token.access_token);
    const expires = new Date(Date.now() + (token.expires_in || 7200) * 1000).toISOString();
    const db = supabaseAdmin();
    const { data: existing } = await db.from("users").select("id").eq("x_user_id", profile.id).maybeSingle();
    const { data: user, error } = await db.from("users").upsert({
      x_user_id: profile.id,
      x_username: profile.username,
      display_name: profile.name,
      avatar_url: profile.profile_image_url || null,
      x_access_token: token.access_token,
      x_refresh_token: token.refresh_token || null,
      x_token_expires_at: expires,
      updated_at: new Date().toISOString()
    }, { onConflict: "x_user_id" }).select("id, x_username").single();
    if (error || !user) return fail(error?.message || "Could not save user.");
    await ensureReferralCode(user.id);
    if (!existing) await attributeReferral(user.id, readRef(request));
    const session = await signUserSession({ sub: user.id, username: user.x_username });
    const res = NextResponse.redirect(`${appUrl()}/missions`);
    applyCookie(res, sessionCookie(session));
    applyCookie(res, clearOauthCookie());
    res.cookies.set("sc_ref", "", { path: "/", maxAge: 0 });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "X login failed.";
    return fail(`${message} Redirect URI in use: ${xRedirectUri()}`);
  }
}
