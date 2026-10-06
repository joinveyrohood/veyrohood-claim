import { appUrl } from "./config";
import { supabaseAdmin } from "./supabase";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const USER_URL = "https://api.x.com/2/users/me";

export function xRedirectUri() {
  return process.env.X_REDIRECT_URI || `${appUrl()}/api/auth/x/callback`;
}

export function xAuthorizeUrl(state: string, challenge: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID || "",
    redirect_uri: xRedirectUri(),
    scope: "tweet.read users.read follows.read like.read offline.access",
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
    body
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "X token exchange failed.");
  }
  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
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
    body
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "X token refresh failed.");
  return data as { access_token: string; refresh_token?: string; expires_in?: number };
}

export async function fetchXMe(accessToken: string) {
  const res = await fetch(`${USER_URL}?user.fields=profile_image_url,name,username`, {
    headers: { Authorization: `Bearer ${accessToken}` }
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

export async function xGet(path: string, accessToken: string) {
  const res = await fetch(`https://api.x.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
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
    return { token: user.x_access_token as string, xUserId: user.x_user_id as string };
  }
  if (!user.x_refresh_token) {
    return { token: user.x_access_token as string, xUserId: user.x_user_id as string };
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
  return { token: refreshed.access_token, xUserId: user.x_user_id as string };
}
