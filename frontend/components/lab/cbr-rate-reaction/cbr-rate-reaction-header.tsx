"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { DataStatusBadge, StatusChip } from "@/components/ui/metrics-minimalism";
import {
  CBR_DECISION_LABELS,
  cbrDataStatusLabel,
  formatCbrEventDate,
  type CbrDecisionType,
  type CbrRateEvent,
  type CbrTone,
} from "@/lib/domain/cbr-rate-reaction";

export function CbrRateReactionHeader({ event }: { event: CbrRateEvent }) {
  return (
    <LabGlassPanel depth={20} className="p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-lab-dim">Заседание ЦБ</p>
            <DataStatusBadge kind="fallback" label={cbrDataStatusLabel(event.dataStatus)} />
          </div>
          <h2 className="mt-0.5 text-base font-semibold text-lab-text">{event.title}</h2>
          <p className="mt-0.5 text-[11px] text-lab-muted">{formatCbrEventDate(event.date)}</p>
          {event.summary ? (
            <p className="mt-1.5 max-w-3xl text-[11px] leading-snug text-lab-muted">{event.summary}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {event.decisionType ? (
            <StatusChip label={CBR_DECISION_LABELS[event.decisionType]} tone={decisionTone(event.decisionType)} />
          ) : (
            <StatusChip label="ожидание" tone="muted" />
          )}
          {event.toneLabelRu ? (
            <StatusChip label={`тон: ${event.toneLabelRu}`} tone={toneChip(event.tone)} />
          ) : null}
        </div>
      </div>

      {event.keyPhrases.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {event.keyPhrases.map((phrase) => (
            <span
              key={phrase}
              className="rounded border border-lab-border/50 bg-lab-bg-deep/40 px-1.5 py-0.5 text-[9px] text-lab-muted"
            >
              {phrase}
            </span>
          ))}
        </div>
      ) : null}
    </LabGlassPanel>
  );
}

function decisionTone(decision: CbrDecisionType): "cyan" | "amber" | "rose" {
  if (decision === "cut") return "cyan";
  if (decision === "hike") return "rose";
  return "amber";
}

function toneChip(tone: CbrTone | null): "cyan" | "neutral" | "rose" {
  if (tone === "dovish") return "cyan";
  if (tone === "hawkish") return "rose";
  return "neutral";
}
