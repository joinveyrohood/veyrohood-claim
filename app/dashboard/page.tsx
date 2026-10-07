"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

type Me = {
  user: { x_username: string; display_name: string; avatar_url?: string; discord_user_id?: string | null };
  progress: { completed: number; total: number };
  balance: { available: number; reward: number; revealed: boolean };
  kyc: { status: string };
  wallet?: { network: string; address: string } | null;
};
type Referral = { count: number; earned: number; available: number; withdrawn: number; link: string; code: string };

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [referral, setReferral] = useState<Referral | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(async (res) => {
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      setMe(await res.json());
      const ref = await fetch("/api/referral");
      if (ref.ok) setReferral(await ref.json());
    }).catch((error) => setNote(error.message));
  }, []);

  async function copy() {
    if (!referral) return;
    await navigator.clipboard.writeText(referral.link);
    setNote("Referral link copied.");
  }

  if (!me) return <main className="p-8 text-white/60">{note || "Loading account..."}</main>;
  const ready = me.progress.total > 0 && me.progress.completed >= me.progress.total;
  return (
    <>
      <Nav username={me.user.x_username} />
      <main className="px-4 py-6 md:ml-64">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-white/50">Mission progress</p>
          <h1 className="font-display text-4xl font-extrabold">{me.progress.completed}/{me.progress.total} Missions Completed</h1>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-lime" style={{ width: `${me.progress.total ? (me.progress.completed / me.progress.total) * 100 : 0}%` }} /></div>
          <section className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="card p-5"><p className="text-sm text-white/50">Account</p><p className="mt-2 font-display text-2xl font-bold">@{me.user.x_username}</p><p className="text-sm text-white/50">{me.user.discord_user_id ? "Discord connected" : "Discord not connected"}</p></article>
            <article className="card p-5"><p className="text-sm text-white/50">Reward</p><p className="mt-2 font-display text-2xl font-bold">{me.balance.revealed ? `$${me.balance.reward.toFixed(2)}` : "Hidden"}</p></article>
            <article className="card p-5"><p className="text-sm text-white/50">Referral earnings</p><p className="mt-2 font-display text-2xl font-bold">${referral?.earned.toFixed(2) || "0.00"}</p><p className="text-sm text-white/50">{referral?.count || 0} referred</p></article>
            <article className="card p-5"><p className="text-sm text-white/50">Available balance</p><p className="mt-2 font-display text-2xl font-bold">${me.balance.available.toFixed(2)}</p><p className="text-sm text-white/50">Referral available ${referral?.available.toFixed(2) || "0.00"}</p></article>
          </section>
          <section className="card mt-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold">Referral</h2>
                <p className="mt-1 break-all text-sm text-white/60">{referral?.link || "Loading link..."}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={copy}>Copy Referral Link</button>
                <a className="btn-lime" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join VeyroHood Claim ${referral?.link || ""}`)}`} target="_blank" rel="noreferrer">Share on X</a>
              </div>
            </div>
            {note ? <p className="mt-3 text-sm text-lime">{note}</p> : null}
          </section>
          <section className="mt-4 grid gap-4 md:grid-cols-3">
            <Link href="/missions" className="card p-5">Missions <span className="block text-sm text-white/50">Open the five tasks</span></Link>
            <Link href="/scratch" className="card p-5">{ready ? "Scratch unlocked" : "Scratch locked"}<span className="block text-sm text-white/50">{me.progress.completed}/{me.progress.total} complete</span></Link>
            <Link href="/withdraw" className="card p-5">Withdraw <span className="block text-sm text-white/50">KYC {me.kyc.status}</span></Link>
          </section>
        </div>
      </main>
    </>
  );
}
