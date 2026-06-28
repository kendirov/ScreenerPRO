"use client";

import type { ExternalMarketSummary, ExternalMarketStatus, ExternalRiskTone } from "@/lib/preparation/preparation-types";
import { cn } from "@/lib/utils/cn";

const TONE_CLASS: Record<ExternalRiskTone, string> = {
  "risk-on": "text-emerald-300/90",
  "risk-off": "text-rose-300/90",
  mixed: "text-cyan-200/85",
  calm: "text-slate-400",
  commodity: "text-amber-200/90",
  "dollar-pressure": "text-violet-300/90",
};

export function PreparationSummaryStrip({
  summary,
  eventsLabel,
  externalStatus,
  updatedAt,
}: {
  summary: ExternalMarketSummary;
  eventsLabel: string;
  externalStatus?: ExternalMarketStatus;
  updatedAt: string;
}) {
  const timeLabel = new Date(updatedAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.05] py-1.5 font-mono text-[10px] tabular-nums">
      <span className={cn("uppercase tracking-wide", TONE_CLASS[summary.tone])}>{summary.line}</span>
      <span className="text-lab-text-dim">·</span>
      <span className="text-lab-text-dim">движений {summary.moversCount}</span>
      <span className="text-lab-text-dim">·</span>
      <span className="text-lab-text-dim">{eventsLabel}</span>
      {externalStatus === "partial" ? (
        <>
          <span className="text-lab-text-dim">·</span>
          <span className="text-amber-200/85">данные частично</span>
        </>
      ) : null}
      <span className="text-lab-text-dim">·</span>
      <span className="text-lab-text-dim">{timeLabel}</span>
    </div>
  );
}
