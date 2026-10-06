import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-16">
      <p className="mb-4 text-sm uppercase tracking-[0.28em] text-electric">VeyroHood bonus desk</p>
      <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-tight md:text-7xl">
        Complete Missions. Scratch. Claim Your Bonus.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-white/70">
        Complete 4 missions, unlock a scratch card, win $20–$100, complete KYC review, then request a withdrawal.
        Rewards are created on the server and stored once.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="btn-lime">Connect with X</Link>
        <a href="https://x.com/VeyroHood" className="btn-ghost">Official X</a>
        <a href="https://discord.gg/ZKWGaxafe" className="btn-ghost">Official Discord</a>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-4">
        {["Follow on X", "Join Discord", "Like pinned post", "Repost pinned post"].map((item, index) => (
          <div key={item} className="card p-5">
            <p className="text-xs text-lime">0{index + 1}</p>
            <p className="mt-2 font-display text-xl font-bold">{item}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
