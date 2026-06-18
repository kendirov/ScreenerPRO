"use client";

import { LIQUIDATION_MAP_TAKEAWAY } from "@/lib/domain/liquidation-map-labels";

export function LiquidationMapKeyThought() {
  return (
    <section className="min-w-0 rounded-xl border border-white/[0.05] bg-slate-950/40 px-3 py-3 sm:px-4">
      <p className="text-sm font-medium leading-snug text-slate-300">{LIQUIDATION_MAP_TAKEAWAY}</p>
    </section>
  );
}
