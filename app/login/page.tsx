"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginInner() {
  const params = useSearchParams();
  const error = params.get("error");
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <div className="card p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-electric">X OAuth 2.0</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold">Connect with X</h1>
        <p className="mt-3 text-white/70">We store your X id, username, display name, and profile image. The client secret never reaches the browser.</p>
        {error ? <p className="mt-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
        <a href="/api/auth/x/start" className="btn-lime mt-6 w-full">Continue with X</a>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
