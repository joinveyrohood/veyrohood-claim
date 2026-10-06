import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { sessionSecret } from "./config";

const USER_COOKIE = "sc_session";
const ADMIN_COOKIE = "sc_admin";
const OAUTH_COOKIE = "sc_oauth";

export type CookieSpec = {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "none" | "strict";
    path: string;
    maxAge: number;
  };
};

function key() {
  const secret = sessionSecret();
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET or ADMIN_SECRET must be at least 16 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function isSecureCookie() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function cookieOptions(maxAge: number, sameSite: "lax" | "none" | "strict") {
  const secure = isSecureCookie() || sameSite === "none";
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge
  };
}

export async function signUserSession(payload: { sub: string; username: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function readUserSession() {
  const token = cookies().get(USER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (!payload.sub || typeof payload.sub !== "string") return null;
    return { sub: payload.sub, username: String(payload.username || "") };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): CookieSpec {
  return {
    name: USER_COOKIE,
    value: token,
    options: cookieOptions(60 * 60 * 24 * 7, "lax")
  };
}

export function clearSessionCookie(): CookieSpec {
  return { name: USER_COOKIE, value: "", options: cookieOptions(0, "lax") };
}

export async function signAdminSession() {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key());
}

export async function readAdminSession() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export function adminCookie(token: string): CookieSpec {
  return {
    name: ADMIN_COOKIE,
    value: token,
    options: cookieOptions(60 * 60 * 12, "lax")
  };
}

export function clearAdminCookie(): CookieSpec {
  return { name: ADMIN_COOKIE, value: "", options: cookieOptions(0, "lax") };
}

// X returns via a cross-site top-level navigation. SameSite=Lax cookies set on
// the redirect to twitter.com are dropped by Chrome. SameSite=None; Secure is
// required so the PKCE verifier is still present on the callback.
export function oauthCookie(value: string): CookieSpec {
  return {
    name: OAUTH_COOKIE,
    value,
    options: cookieOptions(60 * 10, isSecureCookie() ? "none" : "lax")
  };
}

export function clearOauthCookie(): CookieSpec {
  return {
    name: OAUTH_COOKIE,
    value: "",
    options: cookieOptions(0, isSecureCookie() ? "none" : "lax")
  };
}

export function applyCookie(res: NextResponse, spec: CookieSpec) {
  res.cookies.set(spec.name, spec.value, spec.options);
  return res;
}

export function readCookieHeader(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const keyName = part.slice(0, eq).trim();
    if (keyName !== name) continue;
    const raw = part.slice(eq + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export function readOauthCookie(request?: Request) {
  const fromHeader = request ? readCookieHeader(request.headers.get("cookie"), OAUTH_COOKIE) : null;
  if (fromHeader) return fromHeader;
  try {
    return cookies().get(OAUTH_COOKIE)?.value || null;
  } catch {
    return null;
  }
}

export type OauthPayload = { state: string; verifier: string; exp: number };

export function encodeOauthPayload(payload: OauthPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeOauthPayload(raw: string): OauthPayload | null {
  try {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<OauthPayload>;
    if (!parsed || typeof parsed.state !== "string" || typeof parsed.verifier !== "string") return null;
    if (!parsed.state || !parsed.verifier) return null;
    if (parsed.exp != null && (typeof parsed.exp !== "number" || parsed.exp < Date.now())) return null;
    return { state: parsed.state, verifier: parsed.verifier, exp: parsed.exp || 0 };
  } catch {
    return null;
  }
}
