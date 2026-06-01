"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { SpreadTrendEvent } from "@/lib/domain/quad-hedge/types";
import { cn } from "@/lib/utils/cn";

const EVENT_TONE: Record<SpreadTrendEvent["kind"], string> = {
  "new-max": "text-emerald-400/85",
  "new-min": "text-rose-400/85",
  "compress-start": "text-amber-300/80",
  collapse: "text-cyan-300/85",
  retest: "text-violet-300/85",
};

export function SpreadLabEventTape({
  events,
  className,
}: {
  events: SpreadTrendEvent[];
  className?: string;
}) {
  if (!events.length) return null;

  return (
    <LabGlassPanel
      depth={10}
      className={cn(
        "border-white/[0.04] bg-slate-950/40 px-3 py-2 backdrop-blur-sm",
        className,
      )}
    >
      <p className="mb-1.5 text-[8px] uppercase tracking-[0.16em] text-slate-600">
        лента событий
      </p>
      <ul className="space-y-1">
        {events.map((ev, i) => (
          <li
            key={`${ev.time}-${ev.kind}-${i}`}
            className="flex items-baseline gap-2 font-mono text-[10px]"
          >
            <span className="shrink-0 tabular-nums text-slate-600">{ev.timeLabel}</span>
            <span className={cn(EVENT_TONE[ev.kind])}>{ev.message}</span>
          </li>
        ))}
      </ul>
    </LabGlassPanel>
  );
}
