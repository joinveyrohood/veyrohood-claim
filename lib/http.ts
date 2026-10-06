import { NextResponse } from "next/server";
import { readAdminSession, readUserSession } from "./session";

export async function requireUser() {
  const session = await readUserSession();
  if (!session) return { session: null, error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  return { session, error: null };
}

export async function requireAdmin() {
  const ok = await readAdminSession();
  if (!ok) return { error: NextResponse.json({ error: "Admin session required." }, { status: 401 }) };
  return { error: null };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
