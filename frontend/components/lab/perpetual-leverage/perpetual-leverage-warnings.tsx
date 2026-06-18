"use client";

import { cn } from "@/lib/utils/cn";
import type { PerpetualCalculatorWarning } from "@/lib/domain/perpetual-leverage";

const SEVERITY_CLASS: Record<PerpetualCalculatorWarning["severity"], string> = {
  info: "border-cyan-500/25 bg-cyan-950/20 text-cyan-100/90",
  warn: "border-amber-500/30 bg-amber-950/20 text-amber-100/90",
  danger: "border-rose-500/35 bg-rose-950/25 text-rose-100/90",
};

export function PerpetualLeverageWarnings({ warnings }: { warnings: PerpetualCalculatorWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <ul className="space-y-2" role="list">
      {warnings.map((warning) => (
        <li
          key={warning.id}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs leading-relaxed",
            SEVERITY_CLASS[warning.severity],
          )}
        >
          {warning.message}
        </li>
      ))}
    </ul>
  );
}
