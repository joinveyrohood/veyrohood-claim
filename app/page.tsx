"use client";

import Link from "next/link";
import { useEffect } from "react";

const steps = ["Sign in with X", "Dashboard", "Missions", "Scratch & Claim", "Reward revealed", "Wallet", "KYC", "Withdraw", "History"];

export default function HomePage() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) fetch(`/api/referral/capture?code=${encodeURIComponent(ref)}`);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-16">
      <p className="mb-4 text-sm uppercase tracking-[0.28em] text-electric">VeyroHood claim desk</p>
      <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-tight md:text-7xl">Scratch & Claim. Refer. Withdraw.</h1>
      <p className="mt-6 max-w-2xl text-lg text-white/70">Sign in with X, finish the mission flow, scratch a server-generated card, then move through wallet, KYC, and withdrawal. Referral rewards are tracked separately.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="btn-lime">Sign in with X</Link>
        <a href="https://x.com/VeyroHood" className="btn-ghost">Follow @VeyroHood</a>
        <a href="https://discord.gg/ZKWGaxafe" className="btn-ghost">Discord invite</a>
      </div>
      <div className="mt-10 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step} className="card p-4">
            <p className="text-xs text-lime">0{index + 1}</p>
            <p className="mt-1 font-display text-lg font-bold">{step}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
