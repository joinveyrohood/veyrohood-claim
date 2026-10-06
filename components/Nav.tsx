"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/dashboard", "Home"],
  ["/missions", "Missions"],
  ["/scratch", "Scratch"],
  ["/wallet", "Wallet"],
  ["/kyc", "KYC"],
  ["/withdraw", "Withdraw"],
  ["/history", "History"]
];

export function Nav({ username }: { username?: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/dashboard" className="font-display text-lg font-extrabold tracking-tight">
          Scratch<span className="text-lime">.</span>Claim
        </Link>
        <nav className="hidden gap-1 md:flex">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={`rounded-full px-3 py-1.5 text-sm ${path === href ? "bg-lime text-ink" : "text-white/70 hover:text-white"}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm text-white/70">
          {username ? <span>@{username}</span> : null}
          <a href="/api/auth/logout" className="rounded-full border border-line px-3 py-1.5">Log out</a>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 md:hidden">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className={`shrink-0 rounded-full px-3 py-1 text-xs ${path === href ? "bg-lime text-ink" : "bg-white/5 text-white/70"}`}>
            {label}
          </Link>
        ))}
      </div>
    </header>
  );
}
