"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

type Mission = { code: string; title: string; description: string; target_url: string; status: string; button: string };

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(5);
  const [username, setUsername] = useState("");
  const [pinned, setPinned] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const me = await fetch("/api/auth/me");
    if (me.status === 401) {
      window.location.href = "/login";
      return;
    }
    setUsername((await me.json()).user.x_username);
    const res = await fetch("/api/missions");
    const data = await res.json();
    const order = ["follow_x", "like_pinned", "repost_pinned", "reply_pinned", "join_discord"];
    const cards = (data.missions || []).slice().sort((a: Mission, b: Mission) => order.indexOf(a.code) - order.indexOf(b.code));
    setMissions(cards);
    setCompleted(data.completed || 0);
    setTotal(data.total || cards.length || 5);
    setPinned(data.pinnedPostUrl || "");
  }
  useEffect(() => { load().catch((error) => setNote(error.message)); }, []);

  async function confirm(code: string) {
    const res = await fetch("/api/missions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, action: "confirm" }) });
    const data = await res.json();
    setNote(data.note || data.error || "");
    await load();
  }

  const ready = total > 0 && completed >= total;
  return (
    <>
      <Nav username={username} />
      <main className="px-4 py-6 md:ml-64">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-extrabold">Complete Missions</h1>
          <p className="mt-2 text-white/60">Complete all missions to unlock your bonus.</p>
          <p className="mt-4 font-display text-2xl font-bold text-lime">{ready ? "5/5 MISSIONS COMPLETE" : `${completed}/${total} Missions Completed`}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-lime transition-all" style={{ width: `${total ? (completed / total) * 100 : 0}%` }} /></div>
          {pinned ? <a className="mt-4 inline-block text-sm text-electric" href={pinned} target="_blank" rel="noreferrer">{pinned}</a> : null}
          {note ? <p className="mt-4 text-sm text-lime">{note}</p> : null}
          <div className="mt-6 grid gap-4">
            {missions.map((mission, index) => (
              <article key={mission.code} className="card p-5">
                <p className="text-xs text-electric">Mission {index + 1}</p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold">{mission.title}</h2>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{mission.status === "COMPLETED" ? "Completed" : "Pending"}</span>
                </div>
                <p className="mt-2 text-sm text-white/60">{mission.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {mission.code === "join_discord" ? (
                    <>
                      <a className="btn-ghost" href="https://discord.gg/ZKWGaxafe" target="_blank" rel="noreferrer">Open invite</a>
                      <a className="btn-lime" href="/api/auth/discord/start">JOIN DISCORD</a>
                    </>
                  ) : (
                    <>
                      <a className="btn-lime" href={mission.target_url} target="_blank" rel="noreferrer">{mission.button}</a>
                      <button className="btn-ghost" disabled={mission.status === "COMPLETED"} onClick={() => confirm(mission.code)}>Mark done</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="mt-6">
            {ready ? <Link href="/scratch" className="btn-lime w-full py-4 text-base">SCRATCH & CLAIM YOUR BONUS</Link> : <button className="btn-ghost w-full py-4" disabled>Scratch locked</button>}
          </div>
        </div>
      </main>
    </>
  );
}
