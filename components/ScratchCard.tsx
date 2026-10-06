"use client";

import { useEffect, useRef, useState } from "react";

export function ScratchCard({
  revealed,
  amount,
  onReveal
}: {
  revealed: boolean;
  amount: number | null;
  onReveal: () => Promise<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [percent, setPercent] = useState(revealed ? 100 : 0);
  const [prize, setPrize] = useState<number | null>(amount);
  const [busy, setBusy] = useState(false);
  const revealedRef = useRef(revealed);

  useEffect(() => {
    setPrize(amount);
    if (revealed) {
      setPercent(100);
      revealedRef.current = true;
    }
  }, [amount, revealed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#9aa4b2");
      gradient.addColorStop(0.5, "#e8edf2");
      gradient.addColorStop(1, "#6d7785");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#1b2430";
      ctx.font = "700 42px Outfit, sans-serif";
      ctx.fillText("SCRATCH", 48, canvas.height / 2);
    };
    paint();
  }, [revealed]);

  async function scratch(event: React.PointerEvent<HTMLCanvasElement>) {
    if (revealedRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * 2;
    const y = (event.clientY - rect.top) * 2;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 36, 0, Math.PI * 2);
    ctx.fill();
    const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0;
    for (let i = 3; i < sample.length; i += 16) if (sample[i] === 0) clear += 1;
    const next = Math.min(100, Math.round((clear / (sample.length / 16)) * 100));
    setPercent(next);
    if (next >= 42 && !revealedRef.current && !busy) {
      setBusy(true);
      revealedRef.current = true;
      const won = await onReveal();
      setPrize(won);
      setPercent(100);
      setBusy(false);
    }
  }

  return (
    <div className="card relative mx-auto aspect-[5/3] w-full max-w-xl overflow-hidden p-0">
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(200,245,66,0.25),transparent_40%),#10141c]">
        <p className="text-sm uppercase tracking-[0.25em] text-white/50">Your bonus</p>
        <p className="font-display text-6xl font-extrabold text-lime">{prize ? `$${prize}` : "???"}</p>
      </div>
      {!revealed && percent < 100 ? (
        <canvas
          ref={canvasRef}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            scratch(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons || event.currentTarget.hasPointerCapture(event.pointerId)) scratch(event);
          }}
          className="absolute inset-0 h-full w-full touch-none"
        />
      ) : null}
      <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs">{percent}% scratched</div>
    </div>
  );
}
