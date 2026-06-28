"use client";

import * as React from "react";
import type { NormalizedStockRow, TableSortDir, TableSortKey } from "@/lib/screener/stocks-radar";
import { DayRangeBar } from "@/components/screener/stocks/day-range-bar";
import { MetricHelp } from "@/components/screener/stocks/metric-help";
import {
  formatPct,
  formatPositionPct,
  formatRangePct,
  formatRubTurnover,
  formatTrades,
} from "@/lib/screener/formatters";
import { metricChangeClass, metricColors } from "@/lib/screener/metric-styles";
import { cn } from "@/lib/utils/cn";

type SortState = { key: TableSortKey; dir: TableSortDir };

const COLUMNS: {
  key: TableSortKey;
  label: string;
  help?: string;
  align?: "left" | "right";
}[] = [
  { key: "ticker", label: "Тикер" },
  { key: "last", label: "Цена", align: "right" },
  { key: "changePct", label: "Изм. %", align: "right" },
  { key: "turnover", label: "Оборот", align: "right" },
  { key: "trades", label: "Сделки", align: "right" },
  { key: "rangePct", label: "Диапазон", align: "right", help: "Диапазон дня: расстояние от минимума до максимума дня в процентах." },
  { key: "positionInDayRange", label: "Положение", help: "Где текущая цена внутри диапазона дня: 0% — минимум дня, 100% — максимум дня." },
];

function nextSort(prev: SortState | null, key: TableSortKey): SortState {
  if (prev?.key === key) {
    return { key, dir: prev.dir === "desc" ? "asc" : "desc" };
  }
  return { key, dir: key === "ticker" ? "asc" : "desc" };
}

function SortIndicator({ active, dir }: { active: boolean; dir: TableSortDir }) {
  if (!active) return null;
  return <span className="ml-0.5 text-cyan-300/80">{dir === "desc" ? "↓" : "↑"}</span>;
}

export function StocksRadarTable({
  rows,
  onClick,
  highlightedTicker,
  emptyTitle,
  emptyText,
  sort,
  onSortChange,
}: {
  rows: NormalizedStockRow[];
  onClick?: (ticker: string) => void;
  highlightedTicker?: string | null;
  emptyTitle?: string;
  emptyText?: string;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-4 py-8 text-center">
        <p className="text-sm font-medium text-lab-text-main">{emptyTitle ?? "Нет строк"}</p>
        {emptyText ? <p className="mt-1 text-xs text-lab-text-dim">{emptyText}</p> : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.06] bg-slate-950/35">
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.06] text-[9px] text-lab-text-dim">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "cursor-pointer select-none px-2 py-1.5 font-medium transition hover:text-lab-text-main",
                  col.align === "right" && "text-right",
                )}
                onClick={() => onSortChange(nextSort(sort, col.key))}
              >
                <span className="inline-flex items-center">
                  {col.label}
                  {col.help ? <MetricHelp text={col.help} /> : null}
                  <SortIndicator active={sort.key === col.key} dir={sort.dir} />
                </span>
              </th>
            ))}
            <th className="px-2 py-1.5 font-medium">Почему</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const change = row.changePct;
            const isActive = highlightedTicker === row.ticker;
            return (
              <tr
                key={row.ticker}
                className={cn(
                  "border-b border-white/[0.03] transition hover:bg-white/[0.03]",
                  isActive && "bg-white/[0.05]",
                )}
                onClick={() => onClick?.(row.ticker)}
              >
                <td className="px-2 py-1">
                  <span className="font-mono text-[11px] font-semibold text-lab-text-main">{row.ticker}</span>
                </td>
                <td className="px-2 py-1 text-right font-mono text-[10px] tabular-nums text-lab-text-main">
                  {row.last != null ? formatIndexCell(row.last) : "—"}
                </td>
                <td className={cn("px-2 py-1 text-right font-mono text-[10px] tabular-nums", metricChangeClass(change))}>
                  {formatPct(change, 2)}
                </td>
                <td className={cn("px-2 py-1 text-right font-mono text-[10px] tabular-nums", metricColors.turnover)}>
                  {formatRubTurnover(row.turnover)}
                </td>
                <td className={cn("px-2 py-1 text-right font-mono text-[10px] tabular-nums", metricColors.trades)}>
                  {formatTrades(row.trades)}
                </td>
                <td className={cn("px-2 py-1 text-right font-mono text-[10px] tabular-nums", metricColors.range)}>
                  {formatRangePct(row.rangePct)}
                </td>
                <td className="px-2 py-1">
                  <div className="flex items-center justify-end gap-1">
                    <DayRangeBar position={row.positionInDayRange} size="sm" />
                    <span className="w-[2rem] text-right font-mono text-[9px] tabular-nums text-lab-text-dim">
                      {formatPositionPct(row.positionInDayRange)}
                    </span>
                  </div>
                </td>
                <td className="max-w-[9rem] truncate px-2 py-1 text-[9px] text-lab-text-dim">{row.tableReason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatIndexCell(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}
