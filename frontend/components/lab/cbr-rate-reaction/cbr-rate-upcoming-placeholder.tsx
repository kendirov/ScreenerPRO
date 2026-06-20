"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { CbrRateEvent } from "@/lib/cbr";
import { formatRateCompact, formatSelectorMeetingDate } from "@/lib/cbr/cbr-rate-event-selector";

export function CbrRateUpcomingPlaceholder({ event }: { event: CbrRateEvent }) {
  return (
    <LabGlassPanel depth={10} className="px-3 py-6 text-center">
      <p className="font-mono text-xs font-semibold text-lab-amber">
        {formatSelectorMeetingDate(event.date)} · заседание ещё не состоялось
      </p>
      <p className="mt-2 text-[11px] text-lab-muted">
        Исторический replay недоступен. Текущая ставка{" "}
        <span className="font-mono tabular-nums text-lab-text">
          {formatRateCompact(event.previousRate)}%
        </span>
        — факт объявят в 13:30 МСК.
      </p>
      <p className="mt-1 text-[10px] text-lab-dim">
        Маркеры 13:30 и 15:00 появятся на графиках после заседания.
      </p>
    </LabGlassPanel>
  );
}
