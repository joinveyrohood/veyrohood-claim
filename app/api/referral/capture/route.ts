import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") || "";
  const clean = code.trim();
  const res = NextResponse.json({ ok: /^[A-Za-z0-9_-]{4,40}$/.test(clean) });
  if (/^[A-Za-z0-9_-]{4,40}$/.test(clean)) {
    res.cookies.set("sc_ref", clean, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}
