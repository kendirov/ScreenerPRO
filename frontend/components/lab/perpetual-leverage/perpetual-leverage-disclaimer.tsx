"use client";

import { Info } from "lucide-react";
import { PERPETUAL_LIQUIDATION_DISCLAIMER } from "@/lib/domain/perpetual-leverage";

export function PerpetualLeverageDisclaimer() {
  return (
    <div
      className="flex gap-2.5 rounded-lg border border-amber-500/20 bg-amber-950/15 px-3 py-2.5"
      role="note"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden />
      <p className="text-[11px] leading-relaxed text-amber-100/85">{PERPETUAL_LIQUIDATION_DISCLAIMER}</p>
    </div>
  );
}
