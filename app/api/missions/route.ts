import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/http";
import { missionProgress } from "@/lib/account";
import { missionTarget } from "@/lib/verify";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { verifyMission } from "@/lib/verify";
import { ACTION_MISSIONS, discordInviteUrl, pinnedPostUrl } from "@/lib/config";
import { z } from "zod";

export const dynamic = "force-dynamic";

const copy: Record<string, { title: string; description: string; mode: string }> = {
  follow_x: {
    title: "Follow X",
    description: "Sign in with X. Login saves your account and completes this task. Follow verification is not called.",
    mode: "X login"
  },
  join_discord: {
    title: "Join Discord",
    description: "Open the invite, then connect Discord. Successful OAuth completes this task. Membership is not checked.",
    mode: "Discord OAuth"
  },
  like_pinned: {
    title: "Like pinned post",
    description: "Open the pinned post and like it. This is an action task, not an X API check.",
    mode: "Action"
  },
  repost_pinned: {
    title: "Repost pinned post",
    description: "Open the pinned post and repost it. This is an action task, not an X API check.",
    mode: "Action"
  },
  reply_pinned: {
    title: "Reply to pinned post",
    description: "Open the pinned post and reply. This is an action task, not an X API check.",
    mode: "Action"
  }
};

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const progress = await missionProgress(auth.session!.sub);
  return NextResponse.json({
    completed: progress.completed,
    total: progress.total,
    pinnedPostUrl: pinnedPostUrl(),
    discordInvite: discordInviteUrl(),
    missions: progress.cards.map((card) => ({
      ...card,
      title: copy[card.code]?.title || card.title,
      description: copy[card.code]?.description || card.description,
      mode: copy[card.code]?.mode || "Task",
      target_url: missionTarget(card.code, card.target_url)
    }))
  });
}

const bodySchema = z.object({
  code: z.enum(["follow_x", "join_discord", "like_pinned", "repost_pinned", "reply_pinned"]),
  action: z.enum(["start", "verify", "confirm"])
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const limited = rateLimit(`mission:${auth.session!.sub}`, 20, 60_000);
  if (!limited.ok) return jsonError("Too many mission requests. Wait a minute.", 429);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid mission request.");
  const db = supabaseAdmin();
  const { data: mission } = await db.from("missions").select("id, code").eq("code", parsed.data.code).single();
  if (!mission) return jsonError("Mission not found.", 404);
  const { data: existing } = await db.from("user_missions").select("status").eq("user_id", auth.session!.sub).eq("mission_id", mission.id).maybeSingle();
  if (existing?.status === "COMPLETED") return NextResponse.json({ status: "COMPLETED" });

  if (parsed.data.action === "confirm") {
    if (!(ACTION_MISSIONS as readonly string[]).includes(parsed.data.code)) return jsonError("This mission is completed by OAuth, not a manual action.");
    if (!pinnedPostUrl()) return jsonError("Pinned post URL is not configured.", 409);
    await db.from("user_missions").upsert({
      user_id: auth.session!.sub,
      mission_id: mission.id,
      status: "COMPLETED",
      last_error: null,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,mission_id" });
    return NextResponse.json({ status: "COMPLETED", note: "Marked done. Not verified by the X API." });
  }

  if (parsed.data.action === "start") {
    await db.from("user_missions").upsert({
      user_id: auth.session!.sub,
      mission_id: mission.id,
      status: "IN_PROGRESS",
      last_error: null,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,mission_id" });
    return NextResponse.json({ status: "IN_PROGRESS" });
  }

  try {
    const passed = await verifyMission(auth.session!.sub, parsed.data.code);
    const status = passed ? "COMPLETED" : "FAILED";
    await db.from("user_missions").upsert({
      user_id: auth.session!.sub,
      mission_id: mission.id,
      status,
      last_error: passed ? null : "Not completed yet.",
      verified_at: passed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,mission_id" });
    return NextResponse.json({ status, error: passed ? null : "Not completed yet." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    await db.from("user_missions").upsert({
      user_id: auth.session!.sub,
      mission_id: mission.id,
      status: "FAILED",
      last_error: message,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,mission_id" });
    return NextResponse.json({ status: "FAILED", error: message }, { status: 422 });
  }
}
