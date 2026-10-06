import { NextResponse } from "next/server";
import { applyCookie, clearSessionCookie } from "@/lib/session";
import { appUrl } from "@/lib/config";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  applyCookie(res, clearSessionCookie());
  return res;
}

export async function GET() {
  const res = NextResponse.redirect(`${appUrl()}/`);
  applyCookie(res, clearSessionCookie());
  return res;
}
