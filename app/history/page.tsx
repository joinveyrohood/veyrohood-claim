"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

export default function HistoryPage() {
  const [username, setUsername] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      if (me.status === 401) return (window.location.href = "/login");
      const profile = await me.json();
      setUsername(profile.user.x_username);
      const res = await fetch("/api/history");
      const data = await res.json();
      setTransactions(data.transactions || []);
      setWithdrawals(data.withdrawals || []);
    })();
  }, []);

  return (
    <>
      <Nav username={username} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">History</h1>
        <section className="mt-6">
          <h2 className="font-display text-2xl font-bold">Rewards</h2>
          {transactions.length === 0 ? <p className="mt-2 text-white/50">No transactions yet.</p> : transactions.map((row) => (
            <div key={row.id} className="card mt-3 p-4 text-sm">
              <p>{row.type} · ${Number(row.amount).toFixed(2)} · {row.status}</p>
              <p className="text-white/40">{new Date(row.created_at).toLocaleString()}</p>
            </div>
          ))}
        </section>
        <section className="mt-8">
          <h2 className="font-display text-2xl font-bold">Withdrawals</h2>
          {withdrawals.length === 0 ? <p className="mt-2 text-white/50">No withdrawals yet.</p> : withdrawals.map((row) => (
            <div key={row.id} className="card mt-3 p-4 text-sm">
              <p>${Number(row.amount).toFixed(2)} · {row.network} · {row.status}</p>
              <p className="break-all text-white/50">{row.wallet_address}</p>
              {row.tx_hash ? <p className="break-all text-lime">{row.tx_hash}</p> : null}
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
