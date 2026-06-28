"use client";

import { cn } from "@/lib/utils/cn";

export function DayRangeBar({
  position,
  className,
  size = "sm",
}: {
  position: number | null;
  className?: string;
  size?: "sm" | "md";
}) {
  if (position == null || !Number.isFinite(position)) {
    return <span className={cn("inline-block rounded bg-white/5", size === "sm" ? "h-1 w-12" : "h-1.5 w-16", className)} />;
  }

  const pct = Math.max(0, Math.min(1, position)) * 100;

  return (
    <span
      className={cn(
        "relative inline-block overflow-hidden rounded-full bg-slate-800/80",
        size === "sm" ? "h-1 w-12" : "h-1.5 w-16",
        className,
      )}
      title={`${pct.toFixed(0)}% диапазона дня`}
    >
      <span className="absolute inset-y-0 left-0 w-px bg-rose-400/50" aria-hidden />
      <span className="absolute inset-y-0 right-0 w-px bg-emerald-400/50" aria-hidden />
      <span
        className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.55)]"
        style={{ left: `${pct}%` }}
        aria-hidden
      />
    </span>
  );
}
