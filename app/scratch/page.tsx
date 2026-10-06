"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { ScratchCard } from "@/components/ScratchCard";

export default function ScratchPage() {
  const [username, setUsername] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
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
      const profile = await me.json();
      setUsername(profile.user.x_username);
      const res = await fetch("/api/scratch");
      const data = await res.json();
      setUnlocked(Boolean(data.unlocked));
      if (!data.unlocked) return;
      if (!data.reward) {
        const created = await fetch("/api/scratch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "generate" })
        });
        const reward = await created.json();
        if (!created.ok) {
          setError(reward.error || "Could not create reward.");
          return;
        }
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
    const res = await fetch("/api/scratch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reveal" })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Reveal failed.");
    setAmount(data.amount);
    setRevealed(true);
    return data.amount as number;
  }

  return (
    <>
      <Nav username={username} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">Scratch card</h1>
        {error ? <p className="mt-4 text-red-200">{error}</p> : null}
        {!unlocked ? <p className="mt-6 text-white/60">Complete and verify all 4 missions to unlock this card.</p> : null}
        {ready ? (
          <>
            <div className="mt-6">
              <ScratchCard revealed={revealed} amount={amount} onReveal={onReveal} />
            </div>
            {revealed && amount ? (
              <div className="card mt-6 p-6 text-center">
                <p className="font-display text-3xl font-extrabold">Congratulations!</p>
                <p className="mt-2 text-xl">You won ${amount}</p>
                <p className="mt-2 text-white/60">Available balance: ${amount.toFixed(2)}. This reward will not change.</p>
              </div>
            ) : null}
          </>
        ) : unlocked ? <p className="mt-6 text-white/50">Preparing your card...</p> : null}
      </main>
    </>
  );
}
