"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

export default function KycPage() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("NOT_STARTED");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ self_reported_name: "", country: "", note: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      if (me.status === 401) return (window.location.href = "/login");
      const profile = await me.json();
      setUsername(profile.user.x_username);
      const res = await fetch("/api/kyc");
      const data = await res.json();
      setStatus(data.kyc.status);
      setReason(data.kyc.rejection_reason || "");
      setNotice(data.notice);
    })();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/kyc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setMessage(res.ok ? "Submitted for manual review. This is not a live identity-provider check." : data.error);
    if (res.ok) setStatus("PENDING");
  }

  return (
    <>
      <Nav username={username} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">KYC review</h1>
        <p className="mt-2 text-white/60">{notice}</p>
        <p className="mt-4 text-sm text-white/50">Status: {status}</p>
        {reason ? <p className="mt-2 text-sm text-red-200">{reason}</p> : null}
        {status === "APPROVED" ? <p className="mt-4 text-lime">Manual review approved. Withdrawal can be requested.</p> : null}
        {status !== "APPROVED" && status !== "PENDING" ? (
          <form onSubmit={submit} className="card mt-6 space-y-3 p-5">
            <input className="input" placeholder="Self-reported name" value={form.self_reported_name} onChange={(event) => setForm({ ...form, self_reported_name: event.target.value })} />
            <input className="input" placeholder="Country" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
            <textarea className="input" placeholder="Note for the reviewer" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            <button className="btn-lime" type="submit">Submit for manual review</button>
          </form>
        ) : null}
        {message ? <p className="mt-4 text-sm">{message}</p> : null}
      </main>
    </>
  );
}
