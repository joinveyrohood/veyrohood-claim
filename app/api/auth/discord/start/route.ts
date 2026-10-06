import { NextResponse } from "next/server";
import { appUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || "",
    redirect_uri: process.env.DISCORD_REDIRECT_URI || `${appUrl()}/api/auth/discord/callback`,
    response_type: "code",
    scope: "identify",
    prompt: "consent"
  });
  if (!process.env.DISCORD_CLIENT_ID) {
    return NextResponse.json({ error: "Discord OAuth is not configured." }, { status: 500 });
  }
  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
}
