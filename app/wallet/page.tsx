"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";

const networks = ["Ethereum", "Base", "Arbitrum", "BNB Chain", "Polygon"];

export default function WalletPage() {
  const [username, setUsername] = useState("");
  const [balance, setBalance] = useState(0);
  const [referral, setReferral] = useState(0);
  const [network, setNetwork] = useState("Base");
  const [address, setAddress] = useState("");
  const [wallets, setWallets] = useState<{ network: string; address: string; is_primary: boolean }[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const me = await fetch("/api/auth/me");
    if (me.status === 401) {
      window.location.href = "/login";
      return;
    }
    const profile = await me.json();
    setUsername(profile.user.x_username);
    const scratch = await fetch("/api/scratch");
    const reward = await scratch.json();
    setBalance(reward.reward?.claimed ? Number(reward.reward.amount) : 0);
    const ref = await fetch("/api/referral");
    if (ref.ok) setReferral(Number((await ref.json()).earned || 0));
    const walletsRes = await fetch("/api/wallet");
    setWallets((await walletsRes.json()).wallets || []);
  }
  useEffect(() => { load().catch((error) => setMessage(error.message)); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/wallet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ network, address }) });
    const data = await res.json();
    setMessage(res.ok ? "Payout address saved." : data.error);
    if (res.ok) setAddress("");
    await load();
  }

  const total = balance + referral;
  return (
    <>
      <Nav username={username} />
      <main className="px-4 py-6 md:ml-64">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-extrabold">Wallet</h1>
          <p className="mt-2 text-white/60">This is your internal platform balance, not a blockchain wallet.</p>
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="card p-5"><p className="text-sm text-white/50">Balance</p><p className="font-display text-4xl font-extrabold text-lime">${balance.toFixed(2)}</p></article>
            <article className="card p-5"><p className="text-sm text-white/50">Referral Earnings</p><p className="font-display text-4xl font-extrabold">${referral.toFixed(2)}</p></article>
            <article className="card p-5"><p className="text-sm text-white/50">Total Earned</p><p className="font-display text-4xl font-extrabold">${total.toFixed(2)}</p></article>
            <article className="card p-5"><p className="text-sm text-white/50">Withdrawable Balance</p><p className="font-display text-4xl font-extrabold">${balance.toFixed(2)}</p></article>
          </section>
          <Link href="/withdraw" className="btn-lime mt-6 w-full py-4">Withdraw</Link>
          <p className="mt-2 text-center text-sm text-white/50">Withdraw soon after KYC</p>
          <form onSubmit={save} className="card mt-6 space-y-3 p-5">
            <p className="text-sm text-white/60">Payout address. Never enter a private key or seed phrase.</p>
            <select className="input" value={network} onChange={(event) => setNetwork(event.target.value)}>{networks.map((item) => <option key={item}>{item}</option>)}</select>
            <input className="input" placeholder="0x..." value={address} onChange={(event) => setAddress(event.target.value)} />
            <button className="btn-ghost" type="submit">Save payout address</button>
            {message ? <p className="text-sm text-lime">{message}</p> : null}
          </form>
          <div className="mt-4 space-y-3">{wallets.map((wallet) => <div key={wallet.address + wallet.network} className="card p-4"><p className="text-sm text-electric">{wallet.network}</p><p className="break-all">{wallet.address}</p></div>)}</div>
        </div>
      </main>
    </>
  );
}
