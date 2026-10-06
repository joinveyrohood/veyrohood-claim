import { NextResponse } from "next/server";
import { xAuthorizeUrl } from "@/lib/x";
import { applyCookie, encodeOauthPayload, oauthCookie } from "@/lib/session";
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
  const authorizeUrl = xAuthorizeUrl(state, codeChallenge);
  const payload = encodeOauthPayload({ state, verifier, exp: Date.now() + 10 * 60 * 1000 });

  // 200 + Set-Cookie, then a same-origin script hop. A 307 straight to X drops
  // the PKCE cookie in Chrome because that Set-Cookie rides a cross-site redirect.
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="referrer" content="no-referrer">
  <title>Continue to X</title>
</head>
<body>
  <p>Redirecting to X…</p>
  <script>location.replace(${JSON.stringify(authorizeUrl)});</script>
</body>
</html>`;

  const res = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer"
    }
  });
  applyCookie(res, oauthCookie(payload));
  return res;
}
