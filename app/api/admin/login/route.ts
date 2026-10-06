import { NextResponse } from "next/server";
import { adminCookie, applyCookie, clearAdminCookie, signAdminSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  const limited = rateLimit(`admin-login:${ip}`, 8, 60_000);
  if (!limited.ok) return NextResponse.json({ error: "Too many admin attempts." }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json({ error: "ADMIN_SECRET is not configured." }, { status: 500 });
  }
  if (body.secret !== secret) {
    return NextResponse.json({ error: "Invalid admin secret." }, { status: 401 });
  }
  const token = await signAdminSession();
  const res = NextResponse.json({ ok: true });
  applyCookie(res, adminCookie(token));
  return res;
}

export async function DELETE() {
  const res = NextResponse.redirect(`${appUrl()}/admin`);
  applyCookie(res, clearAdminCookie());
  return res;
}
