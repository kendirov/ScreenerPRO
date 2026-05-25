"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { formatAnomalyReason, formatTurnoverCompact } from "@/lib/domain/screener-overview";
import {
  MARKET_CARD_STATE_STYLES,
  normalizeReasonTag,
  resolveStateFromRow,
} from "@/lib/domain/market-card-visual";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

const REASON_DOT: Record<string, string> = {
  оборот: "bg-lab-cyan",
  сделки: "bg-lab-blue",
  движение: "bg-lab-violet",
  аномалия: "bg-lab-amber",
  перекат: "bg-lab-violet",
  активность: "bg-lab-dim",
};

function reasonDotClass(reason: string): string {
  const id = normalizeReasonTag(reason);
  return REASON_DOT[id] ?? REASON_DOT.активность!;
}

function statusLabel(row: ScreenerRow): string {
  if (row.assetClass === "future") return "FORTS";
  return row.metrics.isInPlay ? "в игре" : "TQBR";
}

export function AnomalyRail({ rows, className }: { rows: ScreenerRow[]; className?: string }) {
  const displayRows = rows.slice(0, 4);

  if (!displayRows.length) {
    return (
      <LabGlassPanel
        depth={20}
        variant="amber"
        className={cn("relative flex flex-col justify-center px-3 py-4", className)}
      >
        <p className="lab-type-section text-[10px] text-lab-amber/90">Лента аномалий</p>
        <p className="lab-type-caption mt-2 text-xs leading-relaxed">Спокойный фон — явных всплесков нет</p>
      </LabGlassPanel>
    );
  }

  return (
    <LabGlassPanel depth={20} variant="amber" className={cn("relative flex flex-col px-2 py-2.5", className)}>
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-lab-amber/90">
        Лента аномалий
      </p>
      <ul className="space-y-1">
        {displayRows.map((row) => {
          const reason = formatAnomalyReason(row);
          const href = row.assetClass === "stock" ? `/stocks/${row.ticker}` : `/futures/${row.ticker}`;
          const state = resolveStateFromRow(row);

          return (
            <li key={`${row.assetClass}-${row.ticker}`}>
              <Link
                href={href}
                className={cn(
                  "grid grid-cols-[auto_1fr_auto] items-center gap-x-2 rounded-lg px-2 py-1.5 transition-colors duration-200",
                  "hover:bg-lab-surface-soft/80",
                  state === "warning" && "hover:bg-lab-amber/6",
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", reasonDotClass(reason))}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="lab-ticker text-xs">{row.ticker}</span>
                    <span className={cn("lab-number text-xs font-medium", MARKET_CARD_STATE_STYLES[state].percent)}>
                      {tradingFormat.formatSignedPercent(row.percentChange)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-lab-dim">
                    <span className="truncate">{reason}</span>
                    <span className="lab-number shrink-0">{formatTurnoverCompact(row.turnover)}</span>
                  </div>
                </div>
                <span className="lab-chip shrink-0 px-1 py-px text-[8px] text-lab-muted">{statusLabel(row)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </LabGlassPanel>
  );
}
