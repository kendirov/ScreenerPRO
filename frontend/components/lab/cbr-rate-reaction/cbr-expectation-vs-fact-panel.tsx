"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { StatusChip } from "@/components/ui/metrics-minimalism";
import {
  buildExpectationVsFactView,
  CBR_EXPECTATION_SOURCE_LABELS,
  CBR_SURPRISE_NEUTRAL_THRESHOLD_BPS,
  type CbrExpectationDecisionId,
  type CbrExpectationSource,
  type CbrToneAfterStatementId,
} from "@/lib/domain/cbr-rate-expectation";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import { formatRatePct, formatSurpriseBps } from "@/lib/domain/cbr-rate-reaction";
import { cn } from "@/lib/utils/cn";

export function CbrExpectationVsFactPanel({
  event,
  compact = false,
}: {
  event: CbrRateEvent;
  /** Без тройки ставок — они уже в header. */
  compact?: boolean;
}) {
  const view = buildExpectationVsFactView(event);
  const isUpcoming = view.status === "upcoming";

  if (compact) {
    return (
      <div className="space-y-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          {view.decisionLabel ? (
            <StatusChip
              label={view.decisionLabel}
              tone={decisionChipTone(view.decisionId)}
              className="text-[9px]"
            />
          ) : null}
          {view.toneAfterLabel ? (
            <StatusChip
              label={view.toneAfterLabel}
              tone={toneAfterChipTone(view.toneAfterId)}
              className="text-[9px]"
            />
          ) : null}
          <ExpectationSourceBadge source={view.expectationSource} label={view.expectationSourceLabel} />
        </div>
        <p className="leading-snug text-lab-muted">{view.dayRiskRead}</p>
        {isUpcoming ? (
          <p className="text-[10px] text-lab-dim">Ожидание рынка не задано — surprise не считаем.</p>
        ) : null}
      </div>
    );
  }

  return (
    <LabGlassPanel
      depth={30}
      className="relative overflow-hidden border-lab-cyan/15 px-3 py-2.5 sm:px-4 sm:py-3"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_0%_0%,rgba(34,211,238,0.07),transparent_55%),radial-gradient(ellipse_50%_60%_at_100%_0%,rgba(139,92,246,0.05),transparent_50%)]"
        aria-hidden
      />

      <div className="relative space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-lab-cyan/90">
              Expectation vs Fact
            </p>
            <ExpectationSourceBadge source={view.expectationSource} label={view.expectationSourceLabel} />
          </div>
          {view.decisionLabel ? (
            <StatusChip
              label={view.decisionLabel}
              tone={decisionChipTone(view.decisionId)}
              className="text-[9px]"
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-stretch lg:gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5 sm:gap-2">
            <RateCell label="Было" value={formatRatePct(view.previousRate)} />
            <RateCell
              label="Ожидание рынка"
              value={formatRatePct(view.expectedRate)}
              muted={view.expectedRate == null}
              accent="expected"
            />
            <RateCell
              label="Факт"
              value={formatRatePct(view.actualRate)}
              muted={isUpcoming}
              accent="actual"
            />
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col justify-center rounded-lg border px-3 py-2 sm:min-w-[148px] sm:px-4",
              surprisePanelClass(view.surpriseBps),
            )}
          >
            <p className="text-[9px] uppercase tracking-[0.12em] text-lab-dim">Surprise</p>
            <p className="font-mono text-2xl font-bold tabular-nums leading-none sm:text-[1.75rem]">
              {formatSurpriseBps(view.surpriseBps)}
            </p>
            <p className="mt-1 text-[9px] text-lab-muted">bps · факт − ожидание</p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 border-l border-lab-border/30 pl-0 lg:pl-3">
            {view.toneAfterLabel ? (
              <StatusChip
                label={view.toneAfterLabel}
                tone={toneAfterChipTone(view.toneAfterId)}
                className="w-fit max-w-full text-[9px] whitespace-normal text-left"
              />
            ) : null}
            <p className="text-[11px] leading-snug text-lab-text/90">{view.dayRiskRead}</p>
          </div>
        </div>
      </div>
    </LabGlassPanel>
  );
}

function ExpectationSourceBadge({ source, label }: { source: CbrExpectationSource; label: string }) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em]",
        source === "mock"
          ? "border-lab-border/50 bg-lab-bg-deep/50 text-lab-dim"
          : "border-lab-border/60 bg-lab-bg-deep/40 text-lab-muted",
      )}
      title={CBR_EXPECTATION_SOURCE_LABELS[source]}
    >
      {label}
    </span>
  );
}

function RateCell({
  label,
  value,
  muted,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: "expected" | "actual";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-lab-border/45 bg-lab-bg-deep/35 px-2 py-1.5",
        accent === "expected" && "border-violet-400/20 bg-violet-500/5",
        accent === "actual" && "border-lab-cyan/25 bg-lab-cyan/5",
        muted && "opacity-65",
      )}
    >
      <p className="text-[8px] uppercase tracking-[0.1em] text-lab-dim">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-lab-text sm:text-base">
        {value}
      </p>
    </div>
  );
}

function surprisePanelClass(surpriseBps: number | null): string {
  if (surpriseBps == null) return "border-lab-border/45 bg-lab-bg-deep/40 text-lab-muted";
  if (surpriseBps <= -CBR_SURPRISE_NEUTRAL_THRESHOLD_BPS) {
    return "border-cyan-400/35 bg-cyan-500/10 text-cyan-100";
  }
  if (surpriseBps >= CBR_SURPRISE_NEUTRAL_THRESHOLD_BPS) {
    return "border-rose-400/35 bg-rose-500/10 text-rose-100";
  }
  return "border-amber-400/30 bg-amber-500/8 text-amber-100";
}

function decisionChipTone(id: CbrExpectationDecisionId | null): "cyan" | "neutral" | "rose" {
  if (id === "softer-than-expected") return "cyan";
  if (id === "harder-than-expected") return "rose";
  return "neutral";
}

function toneAfterChipTone(id: CbrToneAfterStatementId | null): "cyan" | "neutral" | "rose" | "amber" {
  if (id === "soft-fact-hard-comment") return "rose";
  if (id === "soft-fact-and-tone") return "cyan";
  if (id === "expected-decision-press-only") return "amber";
  return "neutral";
}
