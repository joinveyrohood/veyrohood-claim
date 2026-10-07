import { NextResponse } from "next/server";
import { officialUsername } from "@/lib/config";
import { appBearerToken, refreshXToken, userByUsernamePath, xErrorText, xGet, X_SCOPES } from "@/lib/x";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function safeBody(data: unknown) {
  if (!data || typeof data !== "object") return data;
  const copy = { ...(data as Record<string, unknown>) };
  delete copy.access_token;
  delete copy.refresh_token;
  delete copy.token;
  return copy;
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limited = rateLimit(`x-diagnose:${ip}`, 6, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many diagnose requests." }, { status: 429 });

  const username = officialUsername();
  const path = userByUsernamePath(username);
  const report: Record<string, unknown> = {
    username,
    endpoint: `GET https://api.x.com${path}`,
    requestedScopes: X_SCOPES,
    hasClientId: Boolean(process.env.X_CLIENT_ID),
    hasClientSecret: Boolean(process.env.X_CLIENT_SECRET),
    hasBearerOverride: Boolean(process.env.X_BEARER_TOKEN || process.env.X_APP_BEARER_TOKEN)
  };

  let officialId: string | null = null;
  try {
    const token = await appBearerToken();
    const result = await xGet(path, token);
    officialId = result.data?.data?.id || null;
    report.appLookup = {
      auth: process.env.X_BEARER_TOKEN || process.env.X_APP_BEARER_TOKEN ? "bearer-env" : "client-credentials",
      status: result.status,
      ok: result.ok,
      userId: officialId,
      resolvedUsername: result.data?.data?.username || null,
      error: result.ok ? null : xErrorText(result),
      body: result.ok ? { id: officialId, username: result.data?.data?.username } : safeBody(result.data)
    };
  } catch (error) {
    report.appLookup = {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "App lookup failed."
    };
  }

  try {
    const db = supabaseAdmin();
    const { data: user, error } = await db
      .from("users")
      .select("id, x_user_id, x_access_token, x_refresh_token, x_token_expires_at")
      .not("x_access_token", "is", null)
      .limit(1)
      .maybeSingle();
    if (error) {
      report.userLookup = { ok: false, error: error.message };
    } else if (!user?.x_access_token || !user.x_user_id) {
      report.userLookup = { ok: false, error: "No stored X user token to test." };
    } else {
      let token = user.x_access_token as string;
      let scopes: string | null = null;
      let refreshed = false;
      if (user.x_refresh_token) {
        const next = await refreshXToken(user.x_refresh_token);
        token = next.access_token;
        scopes = next.scope || null;
        refreshed = true;
        await db.from("users").update({
          x_access_token: next.access_token,
          x_refresh_token: next.refresh_token || user.x_refresh_token,
          x_token_expires_at: new Date(Date.now() + (next.expires_in || 7200) * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", user.id);
      }
      const me = await xGet("/2/users/me?user.fields=id,username", token);
      const result = await xGet(path, token);
      officialId = officialId || result.data?.data?.id || null;
      const follow = officialId
        ? await xGet(`/2/users/${user.x_user_id}/following?max_results=100&user.fields=id,username`, token)
        : null;
      report.userLookup = {
        auth: "oauth2-user",
        refreshed,
        grantedScopes: scopes,
        missingScopes: scopes ? X_SCOPES.filter((scope) => !scopes!.split(/\s+/).includes(scope)) : null,
        meStatus: me.status,
        meOk: me.ok,
        status: result.status,
        ok: result.ok,
        error: result.ok ? null : xErrorText(result),
        body: result.ok ? { id: result.data?.data?.id, username: result.data?.data?.username } : safeBody(result.data),
        followCheck: follow
          ? {
              endpoint: "GET /2/users/:id/following",
              status: follow.status,
              ok: follow.ok,
              error: follow.ok ? null : xErrorText(follow),
              body: follow.ok ? { count: Array.isArray(follow.data?.data) ? (follow.data.data as unknown[]).length : 0 } : safeBody(follow.data)
            }
          : null
      };
    }
  } catch (error) {
    report.userLookup = { ok: false, error: error instanceof Error ? error.message : "User lookup failed." };
  }

  return NextResponse.json(report);
}
