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
  const [claimed, setClaimed] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      if (me.status === 401) {
        window.location.href = "/login";
        return;
      }
      setUsername((await me.json()).user.x_username);
      const res = await fetch("/api/scratch");
      const data = await res.json();
      setUnlocked(Boolean(data.unlocked));
      setProgress(`${data.completed || 0}/${data.total || 5}`);
      if (!data.unlocked) return;
      if (!data.reward) {
        const created = await fetch("/api/scratch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate" }) });
        const reward = await created.json();
        if (!created.ok) return setError(reward.error || "Could not create reward.");
      } else {
        setRevealed(Boolean(data.reward.revealed));
        setClaimed(Boolean(data.reward.claimed));
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
  async function claim() {
    const res = await fetch("/api/scratch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim" }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Claim failed.");
    window.location.href = "/wallet";
  }

  return (
    <>
      <Nav username={username} />
      <main className="px-4 py-8 md:ml-64">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-extrabold">Scratch & Claim Your Bonus</h1>
          <p className="mt-2 text-white/60">Scratch the card to reveal your reward.</p>
          {error ? <p className="mt-4 text-red-200">{error}</p> : null}
          {!unlocked ? <section className="card mt-6 p-6"><p>Scratch locked. {progress} missions completed.</p><Link href="/missions" className="btn-lime mt-4">Back to missions</Link></section> : null}
          {ready ? <div className="mt-6"><ScratchCard revealed={revealed} amount={amount} onReveal={onReveal} />{revealed && amount ? <div className="card mt-6 p-6"><p className="font-display text-3xl font-extrabold">Congratulations!</p><p className="mt-2 text-xl">You won ${amount}</p>{claimed ? <Link href="/wallet" className="btn-lime mt-4">View wallet</Link> : <button className="btn-lime mt-4" onClick={claim}>Claim ${amount}</button>}</div> : null}</div> : null}
        </div>
      </main>
    </>
  );
}
