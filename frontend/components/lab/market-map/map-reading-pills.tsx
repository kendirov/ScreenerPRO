"use client";

import { MAP_READING_PILLS } from "@/lib/domain/market-map-semantics";
import { cn } from "@/lib/utils/cn";

export function MapReadingPills({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-slate-900/30 px-3 py-2 backdrop-blur-md", className)}>
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">Как читать карту</p>
      <div className="flex flex-wrap gap-1.5">
        {MAP_READING_PILLS.map((pill) => (
          <span
            key={pill.id}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] leading-snug text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm"
          >
            {pill.text}
          </span>
        ))}
      </div>
    </div>
  );
}
