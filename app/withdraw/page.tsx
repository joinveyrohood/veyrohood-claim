"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

const networks = ["Ethereum", "Base", "Arbitrum", "BNB Chain", "Polygon"];

export default function WithdrawPage() {
  const [username, setUsername] = useState("");
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ amount: "", network: "Base", wallet_address: "" });
  const [message, setMessage] = useState("");

  async function load() {
    const me = await fetch("/api/auth/me");
    if (me.status === 401) return (window.location.href = "/login");
    const profile = await me.json();
    setUsername(profile.user.x_username);
    const res = await fetch("/api/withdraw");
    const payload = await res.json();
    setData(payload);
    if (payload.wallet) {
      setForm((current) => ({ ...current, network: payload.wallet.network, wallet_address: payload.wallet.address }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) })
    });
    const payload = await res.json();
    setMessage(res.ok ? "Withdrawal requested. An admin will send funds manually." : payload.error);
    await load();
  }

  const locked = !data || data.kycStatus !== "APPROVED" || data.balance.available <= 0;
  return (
    <>
      <Nav username={username} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">Withdraw</h1>
        {!data ? <p className="mt-4 text-white/50">Loading...</p> : null}
        {data && locked ? (
          <div className="card mt-6 p-6">
            <p className="font-display text-2xl font-bold">Withdrawal Locked</p>
            <p className="mt-2 text-white/70">Complete KYC verification to withdraw your reward.</p>
            <Link href="/kyc" className="btn-lime mt-4">Open KYC</Link>
          </div>
        ) : null}
        {data && !locked ? (
          <form onSubmit={submit} className="card mt-6 space-y-3 p-5">
            <p className="text-sm text-white/60">Available ${Number(data.balance.available).toFixed(2)}</p>
            <input className="input" type="number" min="0.01" step="0.01" placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            <select className="input" value={form.network} onChange={(event) => setForm({ ...form, network: event.target.value })}>
              {networks.map((item) => <option key={item}>{item}</option>)}
            </select>
            <input className="input" placeholder="Public 0x address" value={form.wallet_address} onChange={(event) => setForm({ ...form, wallet_address: event.target.value })} />
            <button className="btn-lime" type="submit">Request withdrawal</button>
          </form>
        ) : null}
        {message ? <p className="mt-4 text-sm">{message}</p> : null}
      </main>
    </>
  );
}
