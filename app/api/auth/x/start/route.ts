import { NextResponse } from "next/server";
import { xAuthorizeUrl } from "@/lib/x";
import { oauthCookie } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function randomBase64Url(bytes = 32) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Buffer.from(buf).toString("base64url");
}

async function challenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limited = rateLimit(`oauth-start:${ip}`, 10, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many login attempts." }, { status: 429 });

  if (!process.env.X_CLIENT_ID || !process.env.X_CLIENT_SECRET) {
    return NextResponse.json({ error: "X OAuth is not configured." }, { status: 500 });
  }

  const state = randomBase64Url(16);
  const verifier = randomBase64Url(48);
  const codeChallenge = await challenge(verifier);
  const res = NextResponse.redirect(xAuthorizeUrl(state, codeChallenge));
  res.cookies.set(oauthCookie(JSON.stringify({ state, verifier })));
  return res;
}
