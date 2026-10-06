"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [secret, setSecret] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [kyc, setKyc] = useState("");
  const [sort, setSort] = useState("created_at");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<Record<string, string>>({});

  async function load() {
    const statsRes = await fetch("/api/admin/stats");
    if (statsRes.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    setStats(await statsRes.json());
    const userRes = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&kyc=${kyc}&sort=${sort}`);
    const userData = await userRes.json();
    setUsers(userData.users || []);
    const wd = await fetch("/api/admin/withdrawals");
    const wdData = await wd.json();
    setWithdrawals(wdData.withdrawals || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setSecret("");
    await load();
  }

  async function act(body: Record<string, string>) {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    await load();
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <form onSubmit={login} className="card space-y-3 p-6">
          <h1 className="font-display text-3xl font-extrabold">Admin</h1>
          <input className="input" type="password" placeholder="Admin secret" value={secret} onChange={(event) => setSecret(event.target.value)} />
          <button className="btn-lime w-full" type="submit">Unlock dashboard</button>
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-extrabold">Admin</h1>
        <button className="btn-ghost" onClick={async () => { await fetch("/api/admin/login", { method: "DELETE" }); setAuthed(false); }}>Log out</button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
      {stats ? (
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className="card p-4">
              <p className="text-xs uppercase text-white/40">{key}</p>
              <p className="font-display text-2xl font-bold">{String(value)}</p>
            </div>
          ))}
        </section>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Search username" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="input max-w-[180px]" value={kyc} onChange={(event) => setKyc(event.target.value)}>
          <option value="">All KYC</option>
          {["NOT_STARTED", "PENDING", "APPROVED", "REJECTED"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="input max-w-[180px]" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="created_at">Newest</option>
          <option value="username">Username</option>
        </select>
        <button className="btn-lime" onClick={load}>Apply</button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="text-white/40">
            <tr>
              {["User", "Created", "Missions", "Reward", "KYC", "Wallet", "Withdrawal", "Actions"].map((head) => <th key={head} className="p-2">{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-white/5">
                <td className="p-2">@{user.x_username}<div className="text-xs text-white/40">{user.id}</div></td>
                <td className="p-2">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="p-2">{user.missionProgress} · {user.missionStatus}</td>
                <td className="p-2">{user.scratchReward ? `$${user.scratchReward}` : "—"} {user.rewardRevealed ? "revealed" : ""}</td>
                <td className="p-2">{user.kycStatus}</td>
                <td className="max-w-[180px] break-all p-2">{user.walletAddress || "—"}</td>
                <td className="p-2">{user.withdrawalStatus || "—"} {user.withdrawalAmount ? `$${user.withdrawalAmount}` : ""}<div className="break-all text-xs text-lime">{user.txHash}</div></td>
                <td className="space-y-1 p-2">
                  <button className="btn-ghost" onClick={() => act({ action: "approve_kyc", userId: user.id })}>Approve KYC</button>
                  <button className="btn-ghost" onClick={() => act({ action: "reject_kyc", userId: user.id, reason: "Rejected in manual review" })}>Reject KYC</button>
                  {["follow_x", "join_discord", "like_pinned", "repost_pinned"].map((code) => (
                    <button key={code} className="btn-ghost" onClick={() => act({ action: "complete_mission", userId: user.id, missionCode: code })}>{code}</button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? <p className="mt-4 text-white/50">No users match.</p> : null}
      </div>
      <h2 className="mt-10 font-display text-2xl font-bold">Withdrawals</h2>
      <div className="mt-3 space-y-3">
        {withdrawals.map((row) => (
          <div key={row.id} className="card p-4 text-sm">
            <p>${Number(row.amount).toFixed(2)} · {row.network} · {row.status}</p>
            <p className="break-all text-white/50">{row.wallet_address}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => act({ action: "approve_withdrawal", withdrawalId: row.id })}>Approve</button>
              <button className="btn-ghost" onClick={() => act({ action: "reject_withdrawal", withdrawalId: row.id, reason: "Rejected" })}>Reject</button>
              <input className="input max-w-xs" placeholder="Transaction hash" value={tx[row.id] || ""} onChange={(event) => setTx({ ...tx, [row.id]: event.target.value })} />
              <button className="btn-lime" onClick={() => act({ action: "mark_paid", withdrawalId: row.id, txHash: tx[row.id] || "" })}>Mark paid</button>
            </div>
          </div>
        ))}
        {withdrawals.length === 0 ? <p className="text-white/50">No withdrawals.</p> : null}
      </div>
    </main>
  );
}
