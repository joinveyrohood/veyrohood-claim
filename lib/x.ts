import { appUrl } from "./config";
import { supabaseAdmin } from "./supabase";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const USER_URL = "https://api.x.com/2/users/me";

export const X_SCOPES = ["tweet.read", "users.read", "follows.read", "like.read", "offline.access"] as const;

export type XResult = {
  ok: boolean;
  status: number;
  data: {
    data?: { id?: string; username?: string; name?: string };
    detail?: string;
    title?: string;
    type?: string;
    reason?: string;
    error?: string;
    error_description?: string;
    errors?: { detail?: string; title?: string; reason?: string; type?: string }[];
    meta?: { next_token?: string };
    [key: string]: unknown;
  };
};

export function xRedirectUri() {
  return process.env.X_REDIRECT_URI || `${appUrl()}/api/auth/x/callback`;
}

export function xAuthorizeUrl(state: string, challenge: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID || "",
    redirect_uri: xRedirectUri(),
    scope: X_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

function basicAuth() {
  const id = process.env.X_CLIENT_ID || "";
  const secret = process.env.X_CLIENT_SECRET || "";
  return Buffer.from(`${id}:${secret}`).toString("base64");
}

export function xErrorText(result: XResult) {
  const data = result.data || {};
  const first = Array.isArray(data.errors) ? data.errors[0] : undefined;
  const title = first?.title || data.title || "";
  const detail = first?.detail || data.detail || data.error_description || data.error || title || "X API request failed";
  const reason = first?.reason || data.reason || data.type || "";
  return `X API ${result.status}${title ? ` ${title}` : ""}: ${detail}${reason ? ` (${reason})` : ""}`;
}

export function missingXScopes(granted?: string | null) {
  if (!granted) return null;
  const have = new Set(granted.split(/[\s,]+/).filter(Boolean));
  return X_SCOPES.filter((scope) => !have.has(scope));
}

export async function exchangeXCode(code: string, verifier: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: xRedirectUri(),
    code_verifier: verifier,
    client_id: process.env.X_CLIENT_ID || ""
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`
    },
    body,
    cache: "no-store"
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "X token exchange failed.");
  }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

export async function refreshXToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.X_CLIENT_ID || ""
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`
    },
    body,
    cache: "no-store"
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "X token refresh failed.");
  return data as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

export async function fetchXMe(accessToken: string) {
  const res = await fetch(`${USER_URL}?user.fields=profile_image_url,name,username`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.title || "Could not load X profile.");
  return data.data as {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
  };
}

export async function xGet(path: string, accessToken: string): Promise<XResult> {
  const res = await fetch(`https://api.x.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

let appTokenCache: { token: string; expires: number } | null = null;

export async function appBearerToken() {
  if (appTokenCache && appTokenCache.expires > Date.now() + 30_000) return appTokenCache.token;
  const configured = process.env.X_BEARER_TOKEN || process.env.X_APP_BEARER_TOKEN;
  if (configured) return configured;
  const id = process.env.X_CLIENT_ID || "";
  const secret = process.env.X_CLIENT_SECRET || "";
  if (!id || !secret) throw new Error("X app credentials are not configured.");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`
    },
    body,
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.detail || data.error || data.title || "Could not get an app bearer token.";
    throw new Error(`X API ${res.status} app token: ${detail}`);
  }
  appTokenCache = {
    token: data.access_token as string,
    expires: Date.now() + (Number(data.expires_in) || 7200) * 1000
  };
  return appTokenCache.token;
}

export function userByUsernamePath(username: string) {
  const handle = username.trim().replace(/^@/, "");
  return `/2/users/by/username/${encodeURIComponent(handle)}?user.fields=id,name,username`;
}

export async function ensureXAccess(userId: string) {
  const db = supabaseAdmin();
  const { data: user } = await db
    .from("users")
    .select("x_access_token, x_refresh_token, x_token_expires_at, x_user_id")
    .eq("id", userId)
    .single();
  if (!user?.x_access_token) throw new Error("Reconnect X to verify this mission.");

  const expires = user.x_token_expires_at ? new Date(user.x_token_expires_at).getTime() : 0;
  if (expires && expires > Date.now() + 30_000) {
    return { token: user.x_access_token as string, xUserId: user.x_user_id as string, scopes: null as string | null };
  }
  if (!user.x_refresh_token) {
    return { token: user.x_access_token as string, xUserId: user.x_user_id as string, scopes: null as string | null };
  }
  const refreshed = await refreshXToken(user.x_refresh_token);
  const nextExpiry = new Date(Date.now() + (refreshed.expires_in || 7200) * 1000).toISOString();
  await db
    .from("users")
    .update({
      x_access_token: refreshed.access_token,
      x_refresh_token: refreshed.refresh_token || user.x_refresh_token,
      x_token_expires_at: nextExpiry,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);
  return {
    token: refreshed.access_token,
    xUserId: user.x_user_id as string,
    scopes: refreshed.scope || null
  };
}
