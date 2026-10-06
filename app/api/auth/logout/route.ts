import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { appUrl } from "@/lib/config";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearSessionCookie());
  return res;
}

export async function GET() {
  const res = NextResponse.redirect(`${appUrl()}/`);
  res.cookies.set(clearSessionCookie());
  return res;
}
