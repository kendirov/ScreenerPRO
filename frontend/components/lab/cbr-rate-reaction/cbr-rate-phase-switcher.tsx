"use client";

import {
  CBR_COCKPIT_PHASES,
  type CbrCockpitPhaseId,
} from "@/lib/domain/cbr-rate-cockpit";
import { cn } from "@/lib/utils/cn";

export function CbrRatePhaseSwitcher({
  activePhase,
  onPhaseChange,
  disabled,
}: {
  activePhase: CbrCockpitPhaseId;
  onPhaseChange: (phase: CbrCockpitPhaseId) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-lg border border-lab-border/50 bg-lab-bg-deep/50 p-1"
      role="tablist"
      aria-label="Фазы дня"
    >
      {CBR_COCKPIT_PHASES.map((phase) => {
        const active = phase.id === activePhase;
        return (
          <button
            key={phase.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onPhaseChange(phase.id)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-left transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "bg-lab-cyan/15 text-lab-text ring-1 ring-lab-cyan/30"
                : "text-lab-muted hover:bg-lab-bg-deep/60 hover:text-lab-text",
            )}
          >
            <span className="block text-[11px] font-medium leading-none">{phase.label}</span>
            <span className="mt-0.5 block font-mono text-[8px] text-lab-dim">{phase.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
