"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { formatAnomalyReason, formatTurnoverCompact } from "@/lib/domain/screener-overview";
import {
  ANOMALY_REASON_MARKER,
  MARKET_CARD_STATE_STYLES,
  normalizeReasonTag,
  resolveStateFromRow,
} from "@/lib/domain/market-card-visual";
import { ReasonTagChip } from "@/components/screener/reason-tag-chip";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

function reasonMarkerClass(reason: string): string {
  const id = normalizeReasonTag(reason);
  return ANOMALY_REASON_MARKER[id] ?? ANOMALY_REASON_MARKER.активность!;
}

export function AnomalyRail({ rows, className }: { rows: ScreenerRow[]; className?: string }) {
  const displayRows = rows.slice(0, 5);

  if (!displayRows.length) {
    return (
      <aside
        className={cn(
          "lab-glass-panel relative flex flex-col overflow-hidden border-lab-border-amber/25 px-2.5 py-3",
          className,
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lab-amber/50 to-lab-violet/35 opacity-80" aria-hidden />
        <p className="lab-type-section text-[10px] text-lab-amber/90">Лента аномалий</p>
        <p className="lab-type-caption mt-3 text-xs leading-relaxed">Спокойный фон — явных всплесков нет</p>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "lab-glass-panel relative flex flex-col overflow-hidden border-lab-border-violet/25 px-2 py-2",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lab-amber/55 to-lab-violet/40 opacity-85" aria-hidden />
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-lab-amber/90">
        Лента аномалий
      </p>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
        {displayRows.map((row) => {
          const reason = formatAnomalyReason(row);
          const href = row.assetClass === "stock" ? `/stocks/${row.ticker}` : `/futures/${row.ticker}`;
          const state = resolveStateFromRow(row);

          return (
            <li key={`${row.assetClass}-${row.ticker}`}>
              <Link
                href={href}
                className={cn(
                  "flex items-start gap-2 rounded-md border border-transparent px-1.5 py-1.5 transition-all duration-200",
                  "hover:border-lab-border-hot hover:bg-lab-surface-hot/40",
                  state === "warning" && "hover:border-lab-amber/30 hover:bg-lab-amber/6",
                )}
              >
                <span
                  className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", reasonMarkerClass(reason))}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-1">
                    <span className="lab-ticker text-xs">{row.ticker}</span>
                    <span className={cn("lab-number text-xs font-medium", MARKET_CARD_STATE_STYLES[state].percent)}>
                      {tradingFormat.formatSignedPercent(row.percentChange)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-1">
                    <span className="lab-number text-[10px] text-lab-dim">
                      {formatTurnoverCompact(row.turnover)}
                    </span>
                    <ReasonTagChip tag={reason} />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
