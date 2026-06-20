"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { DataStatusBadge, StatusChip } from "@/components/ui/metrics-minimalism";
import {
  CBR_DECISION_LABELS,
  formatCbrEventDate,
  formatRatePct,
  formatSurpriseBps,
  type CbrRateEvent,
} from "@/lib/domain/cbr-rate-reaction";
import { cn } from "@/lib/utils/cn";

export type CbrEventListMode = "upcoming" | "history";

export function CbrRateReactionEventSelector({
  events,
  mode,
  onModeChange,
  selectedId,
  onSelect,
}: {
  events: CbrRateEvent[];
  mode: CbrEventListMode;
  onModeChange: (mode: CbrEventListMode) => void;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <LabGlassPanel depth={20} className="flex h-full flex-col p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-lab-text">Заседания ЦБ</h3>
        <ModeToggle mode={mode} onChange={onModeChange} />
      </div>

      {events.length === 0 ? (
        <p className="text-[11px] text-lab-muted">
          {mode === "upcoming" ? "Нет предстоящих заседаний" : "История пуста"}
        </p>
      ) : (
        <ul className="space-y-1 overflow-y-auto pr-0.5">
          {events.map((event) => {
            const selected = event.id === selectedId;
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onSelect(event.id)}
                  className={cn(
                    "w-full rounded-md border border-lab-border/50 bg-lab-bg-deep/30 px-2 py-1.5 text-left transition-colors",
                    "hover:border-lab-violet/30 hover:bg-lab-bg-deep/50",
                    selected && "border-lab-violet/40 ring-1 ring-lab-violet/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-lab-text">
                        {formatCbrEventDate(event.date)}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-lab-dim">
                        {formatRatePct(event.previousRate)} →{" "}
                        {event.actualRate != null
                          ? formatRatePct(event.actualRate)
                          : event.expectedRate != null
                            ? `ожид. ${formatRatePct(event.expectedRate)}`
                            : "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      {event.status === "upcoming" ? (
                        <StatusChip label="скоро" tone="amber" />
                      ) : event.decisionType ? (
                        <StatusChip
                          label={CBR_DECISION_LABELS[event.decisionType]}
                          tone="muted"
                          className="text-[8px]"
                        />
                      ) : null}
                      <DataStatusBadge kind="fallback" label={event.dataStatus} className="text-[8px]" />
                    </div>
                  </div>
                  {event.surpriseBps != null && event.surpriseBps !== 0 ? (
                    <p className="mt-1 font-mono text-[9px] text-lab-amber">
                      сюрприз {formatSurpriseBps(event.surpriseBps)}
                    </p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </LabGlassPanel>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: CbrEventListMode;
  onChange: (mode: CbrEventListMode) => void;
}) {
  return (
    <div className="flex rounded-md border border-lab-border/55 bg-lab-bg-deep/50 p-0.5">
      {(
        [
          { id: "upcoming" as const, label: "Предстоящее" },
          { id: "history" as const, label: "История" },
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors",
            mode === item.id ? "bg-lab-violet/25 text-lab-text" : "text-lab-muted hover:text-lab-text",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
