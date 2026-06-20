"use client";

import { Lightbulb } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { DataStatusBadge } from "@/components/ui/metrics-minimalism";
import { cbrDataStatusLabel, type CbrRateEvent } from "@/lib/domain/cbr-rate-reaction";

export function CbrRateReactionTakeaways({ event, items }: { event: CbrRateEvent; items: string[] }) {
  return (
    <LabGlassPanel depth={10} className="p-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Lightbulb className="h-3.5 w-3.5 text-lab-amber/85" />
        <h3 className="text-xs font-semibold text-lab-text">Что понял трейдер</h3>
        <DataStatusBadge kind="fallback" label={cbrDataStatusLabel(event.dataStatus)} className="text-[8px]" />
      </div>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex gap-2 rounded-md border border-lab-border/40 bg-lab-bg-deep/25 px-2 py-1.5 text-[11px] leading-snug text-lab-text"
          >
            <span className="shrink-0 font-mono text-[9px] text-lab-dim">{index + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[9px] text-lab-dim">
        Описание реакции и контекста, не инвестиционная рекомендация. Рыночные % — только из live-источника.
      </p>
    </LabGlassPanel>
  );
}
