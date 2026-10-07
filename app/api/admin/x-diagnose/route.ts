import { NextResponse } from "next/server";
import { officialUsername } from "@/lib/config";
import { appBearerToken, userByUsernamePath, xErrorText, xGet, X_SCOPES } from "@/lib/x";
import { rateLimit } from "@/lib/rate-limit";

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

  try {
    const token = await appBearerToken();
    const result = await xGet(path, token);
    report.appLookup = {
      auth: process.env.X_BEARER_TOKEN || process.env.X_APP_BEARER_TOKEN ? "bearer-env" : "client-credentials",
      status: result.status,
      ok: result.ok,
      userId: result.data?.data?.id || null,
      resolvedUsername: result.data?.data?.username || null,
      error: result.ok ? null : xErrorText(result),
      body: result.ok ? { id: result.data?.data?.id, username: result.data?.data?.username } : safeBody(result.data)
    };
  } catch (error) {
    report.appLookup = {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "App lookup failed."
    };
  }

  return NextResponse.json(report);
}
