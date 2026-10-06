import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { sessionSecret } from "./config";

const USER_COOKIE = "sc_session";
const ADMIN_COOKIE = "sc_admin";
const OAUTH_COOKIE = "sc_oauth";

function key() {
  const secret = sessionSecret();
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET or ADMIN_SECRET must be at least 16 characters.");
  }
  return new TextEncoder().encode(secret);
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

export function sessionCookie(token: string) {
  return {
    name: USER_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    }
  };
}

export function clearSessionCookie() {
  return { name: USER_COOKIE, value: "", options: { httpOnly: true, path: "/", maxAge: 0 } };
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

export function adminCookie(token: string) {
  return {
    name: ADMIN_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 12
    }
  };
}

export function clearAdminCookie() {
  return { name: ADMIN_COOKIE, value: "", options: { httpOnly: true, path: "/", maxAge: 0 } };
}

export function oauthCookie(value: string) {
  return {
    name: OAUTH_COOKIE,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 10
    }
  };
}

export function readOauthCookie() {
  return cookies().get(OAUTH_COOKIE)?.value || null;
}

export function clearOauthCookie() {
  return { name: OAUTH_COOKIE, value: "", options: { httpOnly: true, path: "/", maxAge: 0 } };
}
