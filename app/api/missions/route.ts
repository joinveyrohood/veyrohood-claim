import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/http";
import { missionProgress } from "@/lib/account";
import { missionTarget } from "@/lib/verify";
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { verifyMission } from "@/lib/verify";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const progress = await missionProgress(auth.session!.sub);
  return NextResponse.json({
    completed: progress.completed,
    total: progress.total,
    missions: progress.cards.map((card) => ({
      ...card,
      target_url: missionTarget(card.code, card.target_url)
    })),
    pinnedConfigured: Boolean(process.env.X_PINNED_POST_URL),
    discordConfigured: Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID)
  });
}

const bodySchema = z.object({
  code: z.enum(["follow_x", "join_discord", "like_pinned", "repost_pinned"]),
  action: z.enum(["start", "verify"])
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

  const { data: existing } = await db
    .from("user_missions")
    .select("status")
    .eq("user_id", auth.session!.sub)
    .eq("mission_id", mission.id)
    .maybeSingle();
  if (existing?.status === "COMPLETED") {
    return NextResponse.json({ status: "COMPLETED" });
  }

  if (parsed.data.action === "start") {
    await db.from("user_missions").upsert(
      {
        user_id: auth.session!.sub,
        mission_id: mission.id,
        status: "IN_PROGRESS",
        last_error: null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,mission_id" }
    );
    return NextResponse.json({ status: "IN_PROGRESS" });
  }

  await db.from("user_missions").upsert(
    {
      user_id: auth.session!.sub,
      mission_id: mission.id,
      status: "VERIFYING",
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,mission_id" }
  );

  try {
    const passed = await verifyMission(auth.session!.sub, parsed.data.code);
    const status = passed ? "COMPLETED" : "FAILED";
    await db
      .from("user_missions")
      .update({
        status,
        last_error: passed ? null : "Verification did not find this action yet.",
        verified_at: passed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", auth.session!.sub)
      .eq("mission_id", mission.id);
    return NextResponse.json({
      status,
      error: passed ? null : "Not verified yet. Finish the action, wait a moment, then verify again."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    await db
      .from("user_missions")
      .update({ status: "FAILED", last_error: message, updated_at: new Date().toISOString() })
      .eq("user_id", auth.session!.sub)
      .eq("mission_id", mission.id);
    return NextResponse.json({ status: "FAILED", error: message }, { status: 422 });
  }
}
