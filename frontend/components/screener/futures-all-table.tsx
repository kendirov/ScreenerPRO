"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { ScreenerRow } from "@screenerpro/shared";
import { ScreenerTable } from "@/components/screener/screener-table";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";
import { futureActivityBadgeClass, getFutureActivityLabel } from "@/lib/domain/futures-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";

const numberCellClass = "text-right font-mono tabular-nums text-[13px] text-slate-200";

function compactRub(value: number | null): string {
  return tradingFormat.formatTurnoverRub(value).replace(/\s?₽/g, "");
}

export function FuturesAllTable({
  rows,
  highlightedTicker,
  onRowSelect,
}: {
  rows: ScreenerRow[];
  highlightedTicker?: string | null;
  onRowSelect?: (ticker: string) => void;
}) {
  const families = React.useMemo(() => buildFuturesFamilies(rows), [rows]);
  const metaByTicker = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const family of families) {
      for (const item of family.contracts) {
        map.set(item.ticker, family.familyLabel);
      }
    }
    return map;
  }, [families]);

  const activityCtx = React.useMemo(() => {
    const maxTurnover = rows.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
    const maxTrades = rows.reduce((max, row) => Math.max(max, row.tradesCount ?? 0), 0);
    return { maxTurnover, maxTrades };
  }, [rows]);

  const columns = React.useMemo<ColumnDef<ScreenerRow>[]>(
    () => [
      {
        accessorKey: "ticker",
        header: "Контракт",
        cell: ({ row }) => <span className="font-semibold tracking-wide text-white">{row.original.ticker}</span>,
      },
      {
        id: "base",
        header: "База",
        accessorFn: (row) => metaByTicker.get(row.ticker) ?? "—",
        cell: ({ row }) => <span className="text-slate-300">{metaByTicker.get(row.original.ticker) ?? "—"}</span>,
      },
      {
        accessorKey: "lastPrice",
        header: "Цена",
        cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatDynamicPrice(getValue<number | null>())}</span>,
      },
      {
        accessorKey: "percentChange",
        header: "%",
        cell: ({ getValue }) => {
          const value = getValue<number | null>();
          const cls = value !== null && value > 0 ? "text-emerald-400" : value !== null && value < 0 ? "text-rose-400" : "text-slate-300";
          return <span className={`${numberCellClass} ${cls}`}>{tradingFormat.formatSignedPercent(value)}</span>;
        },
      },
      {
        accessorKey: "turnover",
        header: "Оборот",
        cell: ({ getValue }) => <span className={numberCellClass}>{compactRub(getValue<number | null>())}</span>,
      },
      {
        accessorKey: "tradesCount",
        header: "Сделки",
        cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span>,
      },
      {
        accessorKey: "openInterest",
        header: "ОИ",
        cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span>,
      },
      {
        accessorKey: "metrics.dayRangePct",
        header: "Диапазон %",
        cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatSignedPercent(row.original.metrics.dayRangePct)}</span>,
      },
      {
        id: "activity",
        header: "Статус",
        cell: ({ row }) => {
          const label = getFutureActivityLabel(row.original, activityCtx);
          return (
            <div className="text-right">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${futureActivityBadgeClass[label]}`}>
                {label}
              </span>
            </div>
          );
        },
      },
    ],
    [metaByTicker, activityCtx],
  );

  return (
    <ScreenerTable
      rows={rows}
      columns={columns}
      emptyTitle="Нет доступных фьючерсов"
      emptyText="По текущему фильтру ничего не найдено."
      highlightedTicker={highlightedTicker}
      onRowSelect={onRowSelect}
    />
  );
}
