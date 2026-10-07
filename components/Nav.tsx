"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  ["/missions", "Missions"],
  ["/scratch", "Scratch & Claim"],
  ["/wallet", "Wallet"],
  ["/referral", "Referral"],
  ["/kyc", "KYC"],
  ["/withdraw", "Withdraw"],
  ["/history", "History"]
];

export function Nav({ username }: { username?: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-line bg-ink/95 p-4 backdrop-blur transition md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <Link href="/missions" className="font-display text-xl font-extrabold">VeyroHood <span className="text-lime">Claim</span></Link>
        <nav className="mt-6 grid gap-1">
          {links.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={`rounded-2xl px-3 py-3 text-sm ${path === href ? "bg-lime text-ink" : "text-white/70 hover:bg-white/5"}`}>{label}</Link>
          ))}
          <a href="/api/auth/logout" className="rounded-2xl px-3 py-3 text-sm text-white/70 hover:bg-white/5">Logout</a>
        </nav>
      </aside>
      {open ? <button className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} aria-label="Close menu" /> : null}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-ink/80 px-4 py-3 backdrop-blur md:ml-64">
        <button className="btn-ghost px-3 py-2 md:hidden" onClick={() => setOpen(true)}>Menu</button>
        <p className="text-sm text-white/60">{username ? `@${username}` : "VeyroHood"}</p>
        <a href="/api/auth/logout" className="text-sm text-white/60">Logout</a>
      </header>
    </>
  );
}
