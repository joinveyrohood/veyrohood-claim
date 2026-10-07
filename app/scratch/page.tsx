"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ScratchCard } from "@/components/ScratchCard";

export default function ScratchPage() {
  const [username, setUsername] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [progress, setProgress] = useState("0/5");
  const [revealed, setRevealed] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      if (me.status === 401) return (window.location.href = "/login");
      setUsername((await me.json()).user.x_username);
      const res = await fetch("/api/scratch");
      const data = await res.json();
      setUnlocked(Boolean(data.unlocked));
      setProgress(`${data.completed || 0}/${data.total || 0}`);
      if (!data.unlocked) return;
      if (!data.reward) {
        const created = await fetch("/api/scratch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate" }) });
        const reward = await created.json();
        if (!created.ok) return setError(reward.error || "Could not create reward.");
        setRevealed(Boolean(reward.revealed));
        setAmount(reward.amount);
      } else {
        setRevealed(Boolean(data.reward.revealed));
        setAmount(data.reward.amount);
      }
      setReady(true);
    })().catch((err) => setError(err.message));
  }, []);

  async function onReveal() {
    const res = await fetch("/api/scratch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reveal" }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Reveal failed.");
    setAmount(data.amount);
    setRevealed(true);
    return data.amount as number;
  }

  return (
    <>
      <Nav username={username} />
      <main className="px-4 py-8 md:ml-64">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-extrabold">Scratch & Claim</h1>
          <p className="mt-2 text-white/60">The reward is generated once on the server. The browser cannot choose the amount or scratch twice.</p>
          {error ? <p className="mt-4 text-red-200">{error}</p> : null}
          {!unlocked ? <section className="card mt-6 p-6"><h2 className="font-display text-2xl font-bold">Scratch locked</h2><p className="mt-2 text-white/60">{progress} missions completed. Finish the mission flow to unlock the card.</p><Link href="/missions" className="btn-lime mt-4">Open missions</Link></section> : null}
          {ready ? <div className="mt-6"><ScratchCard revealed={revealed} amount={amount} onReveal={onReveal} />{revealed && amount ? <div className="card mt-6 p-6 text-center"><p className="font-display text-3xl font-extrabold">Reward revealed</p><p className="mt-2 text-xl">${amount}</p><Link href="/wallet" className="btn-lime mt-4">Continue to wallet</Link></div> : null}</div> : null}
        </div>
      </main>
    </>
  );
}
