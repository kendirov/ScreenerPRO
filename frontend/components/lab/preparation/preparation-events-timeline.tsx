"use client";

import { CalendarDays } from "lucide-react";
import { BriefingSelectionButton } from "@/components/lab/preparation/briefing-selection-button";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  EVENT_CATEGORY_LABELS,
  EVENT_IMPACT_LABELS,
  driverStateToneClass,
  formatEventDateLabel,
  sortEventsByDateTime,
  type PreparationEvent,
} from "@/lib/domain/preparation-events";
import { isSmartLabEvent } from "@/lib/domain/smartlab-calendar";
import { cn } from "@/lib/utils/cn";

const TIMELINE_STATE_LABEL: Record<PreparationEvent["driverState"], string> = {
  active: "горячее",
  fading: "остывает",
  potential: "потенциальное",
  sleeping: "спит",
  unknown: "—",
};

export function PreparationEventsTimeline({
  events,
  selectedEventIds,
  onToggleEvent,
  smartLabStatus,
  limit = 5,
  className,
}: {
  events: PreparationEvent[];
  selectedEventIds: ReadonlySet<string>;
  onToggleEvent: (id: string) => void;
  smartLabStatus?: "ok" | "empty" | "error" | "loading";
  limit?: number;
  className?: string;
}) {
  const visible = sortEventsByDateTime(events).slice(0, limit);

  const emptyHint =
    smartLabStatus === "loading"
      ? "Smart-Lab · загрузка…"
      : smartLabStatus === "error" || smartLabStatus === "empty"
        ? "Smart-Lab недоступен — добавьте события вручную"
        : "Нет событий — ручной импорт или Smart-Lab";

  return (
    <LabGlassPanel depth={20} className={cn("flex h-full flex-col p-2.5", className)}>
      <div className="mb-2 flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 text-lab-amber/80" />
        <h3 className="text-xs font-semibold text-lab-text">Ближайшие события</h3>
      </div>

      {visible.length === 0 ? (
        <p className="text-[11px] text-lab-muted">{emptyHint}</p>
      ) : (
        <ul className="space-y-1">
          {visible.map((event) => {
            const timeLabel = event.timeMsk && event.timeMsk !== "—" ? event.timeMsk : "—";
            const affects = event.affectedInstruments.slice(0, 3).join(" · ");
            const selected = selectedEventIds.has(event.id);
            const fromSmartLab = isSmartLabEvent(event);

            return (
              <li
                key={event.id}
                className={cn(
                  "rounded-md border border-lab-border/50 bg-lab-bg-deep/30 px-2 py-1.5",
                  selected && "border-lab-violet/35 ring-1 ring-lab-violet/15",
                  (event.impact === "critical" || event.impact === "high") &&
                    "border-lab-amber/30 bg-lab-amber/5",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="shrink-0 text-center">
                    <span className="block font-mono text-[9px] text-lab-dim">
                      {formatEventDateLabel(event.date)}
                    </span>
                    <span className="block font-mono text-[10px] tabular-nums text-lab-amber">
                      {timeLabel}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[11px] font-medium leading-snug text-lab-text">
                      {event.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className="rounded border border-lab-border/60 px-1 py-px font-mono text-[8px] text-lab-muted">
                        {EVENT_CATEGORY_LABELS[event.category]}
                      </span>
                      <span className="font-mono text-[8px] text-lab-dim">
                        {EVENT_IMPACT_LABELS[event.impact]}
                      </span>
                      {fromSmartLab ? (
                        <span className="rounded border border-lab-cyan/25 bg-lab-cyan/10 px-1 py-px font-mono text-[8px] text-lab-cyan">
                          Smart-Lab
                        </span>
                      ) : (
                        <span className="rounded border border-lab-amber/30 bg-lab-amber/10 px-1 py-px font-mono text-[8px] text-lab-amber">
                          ручной
                        </span>
                      )}
                    </div>
                    {affects ? (
                      <p className="mt-0.5 line-clamp-1 text-[9px] text-lab-dim">{affects}</p>
                    ) : null}
                    {fromSmartLab && event.sourceUrl ? (
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-lab-cyan/80 underline-offset-2 hover:underline"
                      >
                        Источник
                      </a>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 lab-status-chip px-1 py-px text-[8px]",
                      driverStateToneClass(event.driverState),
                    )}
                  >
                    {TIMELINE_STATE_LABEL[event.driverState]}
                  </span>
                </div>
                <div className="mt-1 flex justify-end">
                  <BriefingSelectionButton
                    selected={selected}
                    onToggle={() => onToggleEvent(event.id)}
                    compact
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </LabGlassPanel>
  );
}
