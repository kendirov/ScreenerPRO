"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { CbrRateReactionSummary } from "@/lib/domain/cbr-rate-reaction-summary";
import { cn } from "@/lib/utils/cn";

const ROWS: Array<{ key: keyof CbrRateReactionSummary; label: string; market?: boolean }> = [
  { key: "fact", label: "Факт" },
  { key: "reaction", label: "Реакция", market: true },
  { key: "confirmation", label: "Подтверждение", market: true },
  { key: "nextWatch", label: "Следующий раз" },
];

export function CbrRateReactionSummary({ summary }: { summary: CbrRateReactionSummary }) {
  const insufficient =
    summary.availabilityMode === "insufficient" || summary.availabilityMode === "no_data";

  return (
    <LabGlassPanel depth={10} className="divide-y divide-lab-border/30">
      <div className="border-b border-lab-border/35 bg-lab-bg-deep/50 px-3 py-1.5">
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-lab-dim">
          Summary
        </p>
      </div>

      {summary.availabilityMessage ? (
        <div
          className={cn(
            "border-b px-3 py-2",
            insufficient
              ? "border-rose-400/25 bg-rose-500/8"
              : "border-amber-400/25 bg-amber-500/8",
          )}
        >
          <p
            className={cn(
              "text-[10px] leading-snug",
              insufficient ? "text-rose-100/90" : "text-amber-100/90",
            )}
          >
            {summary.availabilityMessage}
          </p>
        </div>
      ) : null}

      {ROWS.map(({ key, label, market }) => (
        <SummaryRow
          key={key}
          label={label}
          value={summary[key] as string}
          accent={key === "nextWatch"}
          muted={Boolean(insufficient && market && (key === "reaction" || key === "confirmation"))}
        />
      ))}
    </LabGlassPanel>
  );
}

function SummaryRow({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
      <span
        className={cn(
          "shrink-0 text-[9px] font-medium uppercase tracking-[0.12em] sm:w-[5.5rem]",
          accent ? "text-lab-cyan/70" : "text-lab-dim",
        )}
      >
        {label}
      </span>
      <p
        className={cn(
          "min-w-0 text-[11px] leading-snug",
          accent ? "text-lab-text/90" : muted ? "text-lab-dim" : "text-lab-muted",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** @deprecated use CbrRateReactionSummary */
export const CbrRateReplaySummary = CbrRateReactionSummary;
