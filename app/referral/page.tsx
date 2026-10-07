"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

type Summary = {
  code: string; link: string; count: number; earned: number; available: number; withdrawn: number;
  config: { flat: number; percent: number };
  history: { username: string; created_at: string; earned: number }[];
};

export default function ReferralPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const me = await fetch("/api/auth/me");
    if (me.status === 401) return (window.location.href = "/login");
    setUsername((await me.json()).user.x_username);
    const res = await fetch("/api/referral");
    setData(await res.json());
  }
  useEffect(() => { load().catch((error) => setNote(error.message)); }, []);

  async function copy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.link);
    setNote("Referral link copied.");
  }
  async function withdraw() {
    const res = await fetch("/api/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "withdraw", amount: Number(amount) }) });
    const body = await res.json();
    setNote(body.error || "Referral withdrawal requested.");
    await load();
  }

  return (
    <>
      <Nav username={username} />
      <main className="px-4 py-6 md:ml-64">
        <div className="mx-auto max-w-5xl">
          <h1 className="font-display text-4xl font-extrabold">Referral</h1>
          <p className="mt-2 text-white/60">Reward is {data?.config.flat ? `$${data.config.flat} flat` : `${data?.config.percent || 10}% of the referred user's revealed scratch`} from env config. Self-referrals and duplicate credits are rejected. The referrer cannot be changed after signup.</p>
          <section className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="card p-5"><p className="text-sm text-white/50">Count</p><p className="font-display text-3xl font-bold">{data?.count || 0}</p></article>
            <article className="card p-5"><p className="text-sm text-white/50">Earnings</p><p className="font-display text-3xl font-bold">${data?.earned.toFixed(2) || "0.00"}</p></article>
            <article className="card p-5"><p className="text-sm text-white/50">Available</p><p className="font-display text-3xl font-bold">${data?.available.toFixed(2) || "0.00"}</p></article>
            <article className="card p-5"><p className="text-sm text-white/50">Withdrawn</p><p className="font-display text-3xl font-bold">${data?.withdrawn.toFixed(2) || "0.00"}</p></article>
          </section>
          <section className="card mt-4 p-5">
            <p className="break-all text-sm">{data?.link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={copy}>Copy Referral Link</button>
              <a className="btn-lime" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join VeyroHood Claim ${data?.link || ""}`)}`} target="_blank" rel="noreferrer">Share on X</a>
            </div>
          </section>
          <section className="card mt-4 p-5">
            <h2 className="font-display text-2xl font-bold">Request referral payout</h2>
            <p className="mt-1 text-sm text-white/50">This is tracked separately and does not change the scratch withdrawal function.</p>
            <div className="mt-3 flex gap-2"><input className="input" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" /><button className="btn-lime" onClick={withdraw}>Request</button></div>
          </section>
          {note ? <p className="mt-4 text-sm text-lime">{note}</p> : null}
          <section className="mt-4 grid gap-3">
            {(data?.history || []).map((row) => (
              <article key={row.username + row.created_at} className="card flex items-center justify-between p-4"><div><p className="font-bold">@{row.username}</p><p className="text-xs text-white/40">{new Date(row.created_at).toLocaleString()}</p></div><p>${row.earned.toFixed(2)}</p></article>
            ))}
            {!data?.history.length ? <p className="text-white/50">No referrals yet.</p> : null}
          </section>
        </div>
      </main>
    </>
  );
}
