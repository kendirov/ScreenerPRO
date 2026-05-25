"use client";

import { Info } from "lucide-react";
import { PREPARATION_READ_HINT } from "@/lib/domain/preparation-events";
import { cn } from "@/lib/utils/cn";

export function PreparationReadHint({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "lab-glass-card flex gap-2.5 border border-lab-cyan/20 bg-gradient-to-r from-lab-cyan/6 to-lab-violet/4 px-3 py-2.5",
        className,
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-lab-cyan/80" aria-hidden />
      <p className="text-[11px] leading-relaxed text-lab-muted">
        <span className="font-medium text-lab-text">Как читать. </span>
        {PREPARATION_READ_HINT}
      </p>
    </div>
  );
}
