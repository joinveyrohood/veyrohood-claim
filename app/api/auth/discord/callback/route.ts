import { NextResponse } from "next/server";
import { appUrl } from "@/lib/config";
import { readUserSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const fail = (message: string) => NextResponse.redirect(`${appUrl()}/missions?error=${encodeURIComponent(message)}`);
  const session = await readUserSession();
  if (!session) return fail("Sign in with X first.");
  if (!code) return fail("Discord did not return a code.");

  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || "",
    client_secret: process.env.DISCORD_CLIENT_SECRET || "",
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI || `${appUrl()}/api/auth/discord/callback`
  });
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) return fail(token.error_description || "Discord token exchange failed.");

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const me = await meRes.json();
  if (!meRes.ok) return fail("Could not read Discord profile.");

  await supabaseAdmin()
    .from("users")
    .update({ discord_user_id: me.id, discord_username: me.username, updated_at: new Date().toISOString() })
    .eq("id", session.sub);

  return NextResponse.redirect(`${appUrl()}/missions?discord=connected`);
}
