"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

type Mission = { code: string; title: string; description: string; target_url: string; status: string; mode: string; last_error?: string | null };
const icons: Record<string, string> = { follow_x: "X", join_discord: "D", like_pinned: "L", repost_pinned: "R", reply_pinned: "Re" };

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [username, setUsername] = useState("");
  const [invite, setInvite] = useState("https://discord.gg/ZKWGaxafe");
  const [pinned, setPinned] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const me = await fetch("/api/auth/me");
    if (me.status === 401) return (window.location.href = "/login");
    setUsername((await me.json()).user.x_username);
    const res = await fetch("/api/missions");
    const data = await res.json();
    setMissions(data.missions || []);
    setCompleted(data.completed || 0);
    setTotal(data.total || 0);
    setInvite(data.discordInvite || invite);
    setPinned(data.pinnedPostUrl || "");
  }
  useEffect(() => { load().catch((error) => setNote(error.message)); }, []);

  async function confirm(code: string) {
    const res = await fetch("/api/missions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, action: "confirm" }) });
    const data = await res.json();
    setNote(data.note || data.error || "Updated.");
    await load();
  }

  return (
    <>
      <Nav username={username} />
      <main className="px-4 py-6 md:ml-64">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-4xl font-extrabold">{completed}/{total} Missions Completed</h1>
          <p className="mt-2 max-w-2xl text-white/60">X login and Discord OAuth complete those two tasks. Like, repost, and reply are action tasks. They are not checked with a paid X API.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-ghost" href="https://x.com/VeyroHood" target="_blank" rel="noreferrer">Follow https://x.com/VeyroHood</a>
            <a className="btn-ghost" href={invite} target="_blank" rel="noreferrer">Discord invite</a>
            {pinned ? <a className="btn-ghost" href={pinned} target="_blank" rel="noreferrer">Pinned post</a> : <span className="btn-ghost">Pinned post URL not set</span>}
          </div>
          {note ? <p className="mt-4 rounded-2xl border border-electric/40 bg-electric/10 p-3 text-sm">{note}</p> : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {missions.map((mission) => (
              <article key={mission.code} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-lime text-sm font-bold text-ink">{icons[mission.code] || "M"}</span>
                    <div>
                      <h2 className="font-display text-2xl font-bold">{mission.title}</h2>
                      <p className="text-xs uppercase tracking-wide text-white/40">{mission.mode}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{mission.status === "COMPLETED" ? "Completed" : "Pending"}</span>
                </div>
                <p className="mt-3 text-sm text-white/60">{mission.description}</p>
                {mission.last_error ? <p className="mt-2 text-sm text-red-200">{mission.last_error}</p> : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  {mission.code === "follow_x" ? <a className="btn-ghost" href={mission.target_url} target="_blank" rel="noreferrer">Open X</a> : null}
                  {mission.code === "join_discord" ? <>
                    <a className="btn-ghost" href={invite} target="_blank" rel="noreferrer">Open invite</a>
                    <a className="btn-lime" href="/api/auth/discord/start">Connect Discord</a>
                  </> : null}
                  {mission.code !== "follow_x" && mission.code !== "join_discord" ? <>
                    <a className={`btn-ghost ${mission.target_url ? "" : "pointer-events-none opacity-50"}`} href={mission.target_url || "#"} target="_blank" rel="noreferrer">Open pinned post</a>
                    <button className="btn-lime" disabled={mission.status === "COMPLETED" || !mission.target_url} onClick={() => confirm(mission.code)}>Mark action done</button>
                  </> : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
