"use client";

import { ListOrdered } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import {
  BRIEFING_SECTION_ORDER,
  BRIEFING_STATUS_LABELS,
  type BriefingOutlineItem,
} from "@/lib/domain/preparation-briefing-outline";
import { cn } from "@/lib/utils/cn";

const STATUS_CLASS = {
  ready: "border-lab-green/35 bg-lab-green/10 text-lab-green",
  no_data: "border-lab-border text-lab-dim bg-lab-surface-2/40",
  needs_fill: "border-lab-amber/35 bg-lab-amber/10 text-lab-amber",
};

export function BriefingOutlinePanel({
  outline,
  className,
}: {
  outline: BriefingOutlineItem[];
  className?: string;
}) {
  const ordered = BRIEFING_SECTION_ORDER.map(
    (section) => outline.find((item) => item.section === section)!,
  ).filter(Boolean);

  return (
    <section className={cn("lab-glass-panel relative overflow-hidden p-3", className)}>
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-30" aria-hidden />
      <LabSectionHeading className="mb-1 flex items-center gap-1.5 text-lab-amber/90">
        <ListOrdered className="h-3.5 w-3.5" />
        Порядок брифинга
      </LabSectionHeading>
      <p className="text-[11px] text-lab-muted">
        Структура рассказа из выбранных событий и инструментов.
      </p>

      <ol className="mt-3 space-y-2">
        {ordered.map((item, index) => (
          <li
            key={item.id}
            className="lab-glass-card border border-lab-border/70 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-lab-amber/30 bg-lab-amber/10 font-mono text-[10px] text-lab-amber">
                  {index + 1}
                </span>
                <p className="text-sm font-medium text-lab-text">{item.title}</p>
              </div>
              <span className={cn("lab-status-chip px-1.5 py-px text-[9px]", STATUS_CLASS[item.status])}>
                {BRIEFING_STATUS_LABELS[item.status]}
              </span>
            </div>

            {item.instruments.length > 0 ? (
              <p className="mt-2 text-[10px] text-lab-dim">
                <span className="uppercase tracking-wide">Инструменты: </span>
                <span className="font-mono text-lab-muted">{item.instruments.join(" · ")}</span>
              </p>
            ) : null}

            {item.eventIds.length > 0 && item.section === "events" ? (
              <p className="mt-1 text-[10px] text-lab-dim">
                Событий в блоке: {item.eventIds.length}
              </p>
            ) : null}

            <ul className="mt-2 space-y-1">
              {item.talkingPoints.slice(0, 3).map((point) => (
                <li key={point} className="flex gap-1.5 text-[11px] leading-snug text-lab-muted">
                  <span className="text-lab-amber/70">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
