"use client";

import * as React from "react";
import { ListOrdered } from "lucide-react";
import {
  BRIEFING_SECTION_ORDER,
  BRIEFING_STATUS_LABELS,
  type BriefingOutlineItem,
} from "@/lib/domain/preparation-briefing-outline";
import { cn } from "@/lib/utils/cn";

const COMPACT_TITLES: Partial<Record<(typeof BRIEFING_SECTION_ORDER)[number], string>> = {
  context: "Контекст",
  events: "События",
  external: "Внешний фон",
  commodities: "Товары",
  currency: "Валюта",
  index: "Индекс",
  bluechips: "Фишки",
  sectors: "Сектора",
  inplay: "В игре",
  summary: "Итог",
};

const STATUS_DOT = {
  ready: "bg-lab-green",
  no_data: "bg-lab-dim",
  needs_fill: "bg-lab-amber",
};

type AirOrderRowItem =
  | { kind: "section"; item: BriefingOutlineItem }
  | { kind: "inflation"; line: string };

export function PreparationAirOrderCompact({
  outline,
  inflationAirOrderLine,
  className,
}: {
  outline: BriefingOutlineItem[];
  inflationAirOrderLine: string;
  className?: string;
}) {
  const rows = React.useMemo(() => {
    const ordered = BRIEFING_SECTION_ORDER.map(
      (section) => outline.find((item) => item.section === section)!,
    ).filter(Boolean);

    const result: AirOrderRowItem[] = [];
    for (const item of ordered) {
      result.push({ kind: "section", item });
      if (item.section === "context") {
        result.push({ kind: "inflation", line: inflationAirOrderLine });
      }
    }
    return result;
  }, [outline, inflationAirOrderLine]);

  return (
    <div className={cn("lab-glass-panel flex h-full flex-col p-2.5", className)}>
      <div className="mb-2 flex items-center gap-1.5">
        <ListOrdered className="h-3.5 w-3.5 text-lab-violet/80" />
        <h3 className="text-xs font-semibold text-lab-text">Порядок эфира</h3>
      </div>

      <ol className="space-y-0.5">
        {rows.map((row, index) =>
          row.kind === "section" ? (
            <SectionRow key={row.item.id} item={row.item} index={index + 1} />
          ) : (
            <InflationRow key="inflation-rate" line={row.line} index={index + 1} />
          ),
        )}
      </ol>
    </div>
  );
}

function SectionRow({ item, index }: { item: BriefingOutlineItem; index: number }) {
  return (
    <li className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-lab-surface-2/30">
      <span className="w-4 shrink-0 font-mono text-[9px] text-lab-dim">{index}</span>
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[item.status])}
        title={BRIEFING_STATUS_LABELS[item.status]}
      />
      <span className="min-w-0 flex-1 truncate text-[11px] text-lab-text">
        {COMPACT_TITLES[item.section] ?? item.title}
      </span>
      {item.instruments.length > 0 ? (
        <span className="hidden max-w-[72px] truncate font-mono text-[9px] text-lab-dim sm:inline">
          {item.instruments.slice(0, 2).join(" ")}
        </span>
      ) : null}
    </li>
  );
}

function InflationRow({ line, index }: { line: string; index: number }) {
  const isEmpty = line.includes("не загружены");

  return (
    <li className="rounded-md px-1.5 py-1.5 hover:bg-lab-surface-2/30">
      <div className="flex items-start gap-2">
        <span className="w-4 shrink-0 font-mono text-[9px] text-lab-dim">{index}</span>
        <span
          className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", isEmpty ? "bg-lab-dim" : "bg-lab-violet")}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-lab-text">Инфляция / ставка</p>
          <p className="mt-0.5 text-[10px] leading-snug text-lab-muted">{line}</p>
        </div>
      </div>
    </li>
  );
}
