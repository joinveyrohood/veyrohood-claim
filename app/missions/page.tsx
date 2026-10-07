"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

type Mission = {
  code: string;
  title: string;
  description: string;
  target_url: string;
  status: string;
  last_error?: string | null;
};

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const [username, setUsername] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const me = await fetch("/api/auth/me");
    if (me.status === 401) {
      window.location.href = "/login";
      return;
    }
    const profile = await me.json();
    setUsername(profile.user.x_username);
    const res = await fetch("/api/missions");
    const data = await res.json();
    setMissions(data.missions || []);
    setCompleted(data.completed || 0);
    setTotal(data.total || 0);
    const params = new URLSearchParams(window.location.search);
    if (params.get("discord") === "connected") setNote("Discord connected. Mission completed.");
    if (params.get("error")) setNote(params.get("error") || "");
  }

  useEffect(() => {
    load().catch((error) => setNote(error.message));
  }, []);

  async function act(code: string, action: "start" | "verify", url?: string) {
    setBusy(`${code}:${action}`);
    setNote("");
    if (action === "start" && code === "join_discord") {
      window.location.href = "/api/auth/discord/start";
      return;
    }
    if (action === "start" && url) window.open(url, "_blank", "noopener,noreferrer");
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, action })
    });
    const data = await res.json();
    if (data.error) setNote(data.error);
    if (data.status === "COMPLETED") setNote("Mission completed.");
    setBusy("");
    await load();
  }

  return (
    <>
      <Nav username={username} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">Missions {completed}/{total}</h1>
        <p className="mt-2 max-w-2xl text-white/60">X login completes the X mission. Discord OAuth completes the Discord mission. Opening the invite alone does not.</p>
        {note ? <p className="mt-4 rounded-2xl border border-electric/40 bg-electric/10 p-3 text-sm">{note}</p> : null}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {missions.map((mission) => (
            <article key={mission.code} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-2xl font-bold">{mission.title}</h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{mission.status}</span>
              </div>
              <p className="mt-2 text-sm text-white/60">{mission.description}</p>
              {mission.last_error ? <p className="mt-3 text-sm text-red-200">{mission.last_error}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn-ghost" disabled={mission.status === "COMPLETED" || busy === `${mission.code}:start`} onClick={() => act(mission.code, "start", mission.target_url)}>
                  {busy === `${mission.code}:start` ? "Opening..." : mission.code === "join_discord" ? "Connect Discord" : "Open"}
                </button>
                {mission.code !== "join_discord" ? (
                  <button className="btn-lime" disabled={mission.status === "COMPLETED" || busy === `${mission.code}:verify`} onClick={() => act(mission.code, "verify")}>
                    {busy === `${mission.code}:verify` ? "Checking..." : "Verify"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
