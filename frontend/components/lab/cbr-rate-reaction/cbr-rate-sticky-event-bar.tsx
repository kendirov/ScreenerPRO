"use client";

import {
  buildExpectationVsFactView,
} from "@/lib/domain/cbr-rate-expectation";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import {
  CBR_COCKPIT_BAR_MODE_LABELS,
  CBR_COCKPIT_PHASE_BY_ID,
  type CbrCockpitPhaseId,
} from "@/lib/domain/cbr-rate-cockpit";
import type { CbrReactionChartGridModel } from "@/lib/domain/cbr-rate-chart-model";
import {
  formatCbrEventDate,
  formatRatePct,
  formatSurpriseBps,
  resolveDataProvenanceLabel,
} from "@/lib/domain/cbr-rate-reaction";
import { cn } from "@/lib/utils/cn";
import { DataStatusBadge } from "@/components/ui/metrics-minimalism";

export function CbrRateStickyEventBar({
  event,
  activePhase,
  chartModel,
  loading,
}: {
  event: CbrRateEvent;
  activePhase: CbrCockpitPhaseId;
  chartModel: CbrReactionChartGridModel | null;
  loading?: boolean;
}) {
  const expectation = buildExpectationVsFactView(event);
  const phase = CBR_COCKPIT_PHASE_BY_ID[activePhase];
  const provenance = resolveDataProvenanceLabel(chartModel, loading ?? false);

  return (
    <div
      className={cn(
        "sticky top-0 z-40 -mx-1 border-b border-lab-cyan/15 bg-lab-bg-deep/92 px-2 py-1.5 backdrop-blur-md sm:-mx-2 sm:px-3",
        "shadow-[0_8px_32px_rgba(0,0,0,0.45)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <p className="truncate font-mono text-[10px] tabular-nums text-lab-amber">
            {formatCbrEventDate(event.date)}
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
          <BarStat label="было" value={formatRatePct(event.previousRate)} />
          <span className="text-lab-dim">→</span>
          <BarStat label="ожид." value={formatRatePct(expectation.expectedRate)} muted={expectation.expectedRate == null} />
          <span className="text-lab-dim">→</span>
          <BarStat label="факт" value={formatRatePct(expectation.actualRate)} highlight={event.status === "past"} muted={event.status === "upcoming"} />
        </div>

        <div
          className={cn(
            "rounded border px-2 py-0.5 font-mono text-sm font-bold tabular-nums",
            surpriseTone(expectation.surpriseBps),
          )}
        >
          {formatSurpriseBps(expectation.surpriseBps)}
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-lab-violet/25 bg-lab-violet/10 px-2 py-0.5">
          <span className="text-[8px] uppercase tracking-[0.12em] text-lab-dim">фаза</span>
          <span className="text-[10px] font-medium text-lab-text">{phase.label}</span>
          <span className="text-[9px] text-lab-muted">· {CBR_COCKPIT_BAR_MODE_LABELS[phase.barMode]}</span>
        </div>

        <DataStatusBadge
          kind={provenance.honest && chartModel?.bundleDataStatus === "live" ? "live" : "fallback"}
          label={provenance.label}
          className="ml-auto text-[8px]"
        />
        {event.dataStatus === "mock" ? (
          <span className="text-[8px] uppercase tracking-wide text-lab-dim">rates · mock</span>
        ) : null}
      </div>
    </div>
  );
}

function BarStat({
  label,
  value,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", muted && "opacity-55")}>
      <span className="text-[8px] uppercase text-lab-dim">{label}</span>
      <span className={cn(highlight ? "font-semibold text-lab-cyan" : "text-lab-text")}>{value}</span>
    </span>
  );
}

function surpriseTone(bps: number | null): string {
  if (bps == null) return "border-lab-border/50 text-lab-muted";
  if (bps <= -12) return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
  if (bps >= 12) return "border-rose-400/35 bg-rose-500/10 text-rose-100";
  return "border-amber-400/30 bg-amber-500/8 text-amber-100";
}
