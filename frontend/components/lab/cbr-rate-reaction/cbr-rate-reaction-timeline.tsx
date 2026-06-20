"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { buildEventTimeline, formatRatePct, type CbrRateEvent } from "@/lib/domain/cbr-rate-reaction";
import { cn } from "@/lib/utils/cn";

export function CbrRateReactionTimeline({
  event,
  activePhase,
  onPhaseSelect,
}: {
  event: CbrRateEvent;
  activePhase?: number;
  onPhaseSelect?: (offsetMin: number) => void;
}) {
  const isUpcoming = event.status === "upcoming";
  const phases = buildEventTimeline(event);

  return (
    <LabGlassPanel depth={20} className="p-2.5">
      <h3 className="mb-2 text-xs font-semibold text-lab-text">Ход дня</h3>
      <div className="relative">
        <div className="absolute left-[18px] top-2 bottom-2 w-px bg-lab-border/60" aria-hidden />
        <ul className="space-y-1.5">
          {phases.map((phase, index) => {
            const active = activePhase === phase.offsetMin;
            const past = isUpcoming ? phase.kind === "open" : true;
            const isDecision = phase.kind === "decision";

            return (
              <li key={`${phase.kind}-${phase.timeMsk}`}>
                <button
                  type="button"
                  disabled={!onPhaseSelect}
                  onClick={() => onPhaseSelect?.(phase.offsetMin)}
                  className={cn(
                    "group flex w-full items-start gap-2 rounded-md px-1 py-1 text-left transition-colors",
                    onPhaseSelect && "hover:bg-lab-bg-deep/40",
                    active && "bg-lab-violet/10",
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 flex h-[9px] w-[9px] shrink-0 rounded-full border",
                      isDecision ? "border-lab-amber bg-lab-amber/80" : "border-lab-cyan/60 bg-lab-bg-deep",
                      active && "ring-2 ring-lab-violet/30",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[10px] tabular-nums text-lab-amber">{phase.timeMsk}</span>
                      <span className="text-[11px] font-medium text-lab-text">{phase.label}</span>
                      {!isUpcoming && index === 1 ? (
                        <span className="font-mono text-[9px] text-lab-dim">
                          факт {formatRatePct(event.actualRate)}
                        </span>
                      ) : null}
                    </div>
                    <p className={cn("text-[10px] text-lab-muted", !past && isUpcoming && "opacity-60")}>
                      {phase.hint}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </LabGlassPanel>
  );
}
