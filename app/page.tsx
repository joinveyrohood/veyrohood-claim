"use client";

import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) fetch(`/api/referral/capture?code=${encodeURIComponent(ref)}`);
  }, []);
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm uppercase tracking-[0.28em] text-electric">VeyroHood</p>
      <h1 className="mt-4 font-display text-5xl font-extrabold md:text-7xl">Scratch. Reveal. Claim.</h1>
      <p className="mt-4 max-w-xl text-lg text-white/70">Complete the missions, scratch your bonus, and claim your reward.</p>
      <a href="/api/auth/x/start" className="btn-lime mt-8 px-8 py-4 text-base">Connect Your X Account</a>
    </main>
  );
}
