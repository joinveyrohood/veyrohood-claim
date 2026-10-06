"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

type Me = {
  user: { x_username: string; display_name: string; avatar_url?: string; created_at: string };
  progress: { completed: number; total: number };
  balance: { available: number; reward: number; revealed: boolean };
  kyc: { status: string };
  wallet?: { network: string; address: string } | null;
  reward?: { amount: number; revealed: boolean } | null;
};

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return null;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => data && setMe(data))
      .catch((err) => setError(err.message));
  }, []);

  if (!me) {
    return <main className="p-8 text-white/60">{error || "Loading account..."}</main>;
  }

  const ready = me.progress.completed >= 4;
  return (
    <>
      <Nav username={me.user.x_username} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <section className="card flex flex-col gap-4 p-6 md:flex-row md:items-center">
          {me.user.avatar_url ? <img src={me.user.avatar_url} alt="" className="h-16 w-16 rounded-2xl" /> : null}
          <div>
            <h1 className="font-display text-3xl font-extrabold">{me.user.display_name}</h1>
            <p className="text-white/60">@{me.user.x_username} · Account active</p>
          </div>
          <div className="md:ml-auto">
            <p className="text-sm text-white/50">Mission progress</p>
            <p className="font-display text-4xl font-extrabold text-lime">{me.progress.completed}/{me.progress.total}</p>
          </div>
        </section>
        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <p className="text-sm text-white/50">Available balance</p>
            <p className="font-display text-3xl font-bold">${me.balance.available.toFixed(2)}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-white/50">KYC status</p>
            <p className="font-display text-3xl font-bold">{me.kyc.status}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-white/50">Wallet</p>
            <p className="truncate font-display text-xl font-bold">{me.wallet?.address || "Not added"}</p>
          </div>
        </section>
        {ready ? (
          <section className="card mt-4 p-6">
            <h2 className="font-display text-3xl font-extrabold">Scratch Card Unlocked!</h2>
            <p className="mt-2 text-white/70">Your reward is generated once on the server and stays the same if you refresh or log out.</p>
            <Link href="/scratch" className="btn-lime mt-5">Scratch & Claim</Link>
          </section>
        ) : (
          <section className="card mt-4 p-6">
            <h2 className="font-display text-2xl font-bold">Finish the 4 missions</h2>
            <Link href="/missions" className="btn-lime mt-4">Open missions</Link>
          </section>
        )}
      </main>
    </>
  );
}
