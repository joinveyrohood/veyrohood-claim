"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

const networks = ["Ethereum", "Base", "Arbitrum", "BNB Chain", "Polygon"];

export default function WalletPage() {
  const [username, setUsername] = useState("");
  const [network, setNetwork] = useState("Base");
  const [address, setAddress] = useState("");
  const [wallets, setWallets] = useState<{ network: string; address: string; is_primary: boolean }[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const me = await fetch("/api/auth/me");
    if (me.status === 401) return (window.location.href = "/login");
    const profile = await me.json();
    setUsername(profile.user.x_username);
    const res = await fetch("/api/wallet");
    const data = await res.json();
    setWallets(data.wallets || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const res = await fetch("/api/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ network, address })
    });
    const data = await res.json();
    setMessage(res.ok ? "Public wallet saved." : data.error);
    if (res.ok) setAddress("");
    await load();
  }

  return (
    <>
      <Nav username={username} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">Wallet</h1>
        <p className="mt-2 text-white/60">Add a public EVM address only. Never enter a private key, seed phrase, or recovery phrase.</p>
        <form onSubmit={save} className="card mt-6 space-y-3 p-5">
          <select className="input" value={network} onChange={(event) => setNetwork(event.target.value)}>
            {networks.map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className="input" placeholder="0x..." value={address} onChange={(event) => setAddress(event.target.value)} />
          <button className="btn-lime" type="submit">Save public address</button>
          {message ? <p className="text-sm text-lime">{message}</p> : null}
        </form>
        <div className="mt-4 space-y-3">
          {wallets.length === 0 ? <p className="text-white/50">No wallet yet.</p> : wallets.map((wallet) => (
            <div key={wallet.address + wallet.network} className="card p-4">
              <p className="text-sm text-electric">{wallet.network} {wallet.is_primary ? "· primary" : ""}</p>
              <p className="break-all">{wallet.address}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
