"use client";

import * as React from "react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { StatusChip } from "@/components/ui/metrics-minimalism";
import type { CbrRateEvent } from "@/lib/cbr";
import {
  CBR_SELECTOR_YEARS,
  countSelectorYearEvents,
  formatChangeBpsRu,
  formatExpectationLine,
  formatRateArrow,
  formatSelectorMeetingDate,
  groupCbrEventsBySelectorYear,
  resolveDecisionBadgeLabel,
  resolveEventCardVisualState,
  resolveVerificationBadgeLabel,
  type CbrEventCardVisualState,
  type CbrSelectorYear,
} from "@/lib/cbr/cbr-rate-event-selector";
import { isUpcomingEvent } from "@/lib/cbr/cbr-rate-events";
import { cn } from "@/lib/utils/cn";

export function CbrRateEventSelector({
  events,
  selectedId,
  onSelect,
}: {
  events: CbrRateEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const byYear = React.useMemo(() => groupCbrEventsBySelectorYear(events), [events]);
  const selectedYear = Number((selectedId || events[0]?.date || "2026").slice(0, 4)) as CbrSelectorYear;
  const [year, setYear] = React.useState<CbrSelectorYear>(
    CBR_SELECTOR_YEARS.includes(selectedYear) ? selectedYear : 2026,
  );

  const yearEvents = byYear[year] ?? [];

  React.useEffect(() => {
    const y = Number(selectedId.slice(0, 4)) as CbrSelectorYear;
    if (CBR_SELECTOR_YEARS.includes(y)) setYear(y);
  }, [selectedId]);

  return (
    <LabGlassPanel depth={10} className="p-1.5">
      <div className="flex items-center gap-1 border-b border-lab-border/35 pb-1">
        {CBR_SELECTOR_YEARS.map((y) => {
          const count = countSelectorYearEvents(events, y);
          const empty = count === 0;
          const active = year === y;
          return (
            <button
              key={y}
              type="button"
              onClick={() => {
                setYear(y);
                const first = byYear[y]?.[0];
                if (first) onSelect(first.id);
              }}
              className={cn(
                "min-w-[3.25rem] rounded px-2 py-1 font-mono text-[11px] font-semibold tabular-nums transition-colors",
                active
                  ? "bg-lab-cyan/18 text-lab-text ring-1 ring-lab-cyan/35"
                  : empty
                    ? "text-lab-dim/70 hover:bg-lab-bg-deep/40 hover:text-lab-muted"
                    : "text-lab-muted hover:bg-lab-bg-deep/50 hover:text-lab-text",
              )}
            >
              {y}
            </button>
          );
        })}
        <span className="ml-auto pr-1 text-[9px] uppercase tracking-[0.14em] text-lab-dim">заседание</span>
      </div>

      {yearEvents.length === 0 ? (
        <p className="px-1 py-3 text-center font-mono text-[10px] text-lab-dim/80">
          Нет заседаний в каталоге за {year}
        </p>
      ) : (
        <div className="mt-1 flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
          {yearEvents.map((event) => (
            <MeetingCard
              key={event.id}
              event={event}
              selected={event.id === selectedId}
              onSelect={() => onSelect(event.id)}
            />
          ))}
        </div>
      )}
    </LabGlassPanel>
  );
}

function MeetingCard({
  event,
  selected,
  onSelect,
}: {
  event: CbrRateEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const upcoming = isUpcomingEvent(event);
  const visual = resolveEventCardVisualState(event, selected);
  const decisionLabel = resolveDecisionBadgeLabel(event);
  const verificationLabel = resolveVerificationBadgeLabel(event);

  return (
    <button
      type="button"
      onClick={onSelect}
      title={event.title}
      className={cn(
        "group shrink-0 rounded border px-2 py-1.5 text-left font-mono transition-all",
        selected ? "min-w-[7.5rem] max-w-[9rem]" : "min-w-[9.5rem] max-w-[11rem]",
        cardSurfaceClass(visual),
      )}
    >
      <p className="truncate text-[11px] font-semibold leading-none text-lab-text">
        {formatSelectorMeetingDate(event.date)}
      </p>

      {!selected ? (
        <>
          <p
            className={cn(
              "mt-1 truncate text-[10px] tabular-nums leading-none",
              upcoming ? "text-lab-dim" : "text-lab-muted",
            )}
          >
            {formatRateArrow(event.previousRate, event.actualRate)}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate text-[10px] tabular-nums leading-none",
              changeTone(event.changeBps, upcoming),
            )}
          >
            {formatChangeBpsRu(event.changeBps, upcoming)}
          </p>
          <p className="mt-0.5 truncate text-[9px] leading-none text-lab-dim">
            {formatExpectationLine(event.expectedRate)}
          </p>
        </>
      ) : (
        <p className="mt-1 truncate text-[9px] leading-none text-lab-dim">
          {formatChangeBpsRu(event.changeBps, upcoming)}
        </p>
      )}

      <div className="mt-1 flex flex-wrap gap-0.5">
        <StatusChip
          label={decisionLabel}
          tone={decisionTone(event, upcoming)}
          className="h-4 px-1 text-[7px] leading-none"
        />
        {verificationLabel ? (
          <StatusChip
            label={verificationLabel}
            tone="amber"
            className="h-4 px-1 text-[7px] leading-none"
          />
        ) : null}
      </div>
    </button>
  );
}

function cardSurfaceClass(visual: CbrEventCardVisualState): string {
  switch (visual) {
    case "selected":
      return cn(
        "border-lab-cyan/55 bg-lab-cyan/12 ring-1 ring-lab-cyan/40 shadow-[0_0_12px_rgba(34,211,238,0.12)]",
      );
    case "upcoming":
      return cn(
        "border-amber-400/35 bg-amber-500/6 hover:border-amber-400/50",
        "border-dashed",
      );
    case "no-data":
      return cn(
        "border-lab-border/30 bg-lab-bg-deep/25 opacity-55 hover:opacity-80",
      );
    case "historical":
    default:
      return cn(
        "border-lab-border/40 bg-lab-bg-deep/35 hover:border-lab-border/65 hover:bg-lab-bg-deep/55",
      );
  }
}

function decisionTone(
  event: CbrRateEvent,
  upcoming: boolean,
): "cyan" | "amber" | "rose" | "muted" {
  if (upcoming) return "amber";
  if (event.decisionType === "cut") return "cyan";
  if (event.decisionType === "hike") return "rose";
  if (event.decisionType === "hold") return "amber";
  return "muted";
}

function changeTone(bps: number | null, upcoming: boolean): string {
  if (upcoming || bps == null) return "text-lab-dim";
  if (bps < 0) return "text-cyan-300/90";
  if (bps > 0) return "text-rose-300/90";
  return "text-lab-muted";
}

/** @deprecated use CbrRateEventSelector */
export const CbrRateDateSelector = CbrRateEventSelector;
