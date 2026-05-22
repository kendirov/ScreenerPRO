"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ScreenerRow } from "@screenerpro/shared";
import {
  getStockActivityDisplayLabel,
  isStockInPlay,
  STOCK_ILLIQUID_TURNOVER_FLOOR,
  stockActivityDisplayBadgeClass,
} from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";

const numberCellClass = "text-right font-mono tabular-nums text-[13px] text-slate-200";

function formatTurnoverCompact(value: number | null): string {
  const formatted = tradingFormat.formatTurnoverRub(value);
  return formatted.replace(/\s?₽/g, "");
}

export function createStockColumns(maxTurnover: number): ColumnDef<ScreenerRow>[] {
  return [
    {
      accessorKey: "ticker",
      header: "Тикер",
      cell: ({ row }) => {
        const hasInPlay = isStockInPlay(row.original);
        return (
          <div className="flex items-center gap-1.5" title={row.original.shortName}>
            <p className="font-semibold tracking-[0.04em] text-white">{row.original.ticker}</p>
            {hasInPlay ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-emerald-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300/90" />
                В ИГРЕ
              </span>
            ) : null}
          </div>
        );
      },
    },
    { accessorKey: "lastPrice", header: "Цена", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatDynamicPrice(getValue<number | null>())}</span> },
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
      header: "Оборот, ₽",
      cell: ({ getValue }) => (
        <div className="ml-auto w-[180px] rounded-md bg-white/[0.02] px-2 py-1.5 text-right shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          <div className={numberCellClass}>{formatTurnoverCompact(getValue<number | null>())}</div>
        </div>
      ),
    },
    { accessorKey: "tradesCount", header: "Сделки", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span> },
    { accessorKey: "metrics.dayRangePct", header: "Диапазон %", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatSignedPercent(row.original.metrics.dayRangePct)}</span> },
    {
      id: "activity",
      header: "Активность",
      cell: ({ row }) => {
        const label = getStockActivityDisplayLabel(row.original, maxTurnover);
        return (
          <div className="text-right">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${stockActivityDisplayBadgeClass[label]}`}>
              {label}
            </span>
          </div>
        );
      },
    },
  ];
}

export const stockColumns = createStockColumns(STOCK_ILLIQUID_TURNOVER_FLOOR);

export const futuresColumns: ColumnDef<ScreenerRow>[] = [
  {
    accessorKey: "ticker",
    header: "Контракт",
    cell: ({ row }) => (
      <div className="space-y-1">
        <p className="font-semibold tracking-[0.04em] text-white">{row.original.ticker}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{row.original.shortName}</p>
      </div>
    ),
  },
  { accessorKey: "lastPrice", header: "Цена", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatDynamicPrice(getValue<number | null>())}</span> },
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
    header: "Оборот, ₽",
    cell: ({ getValue }) => (
      <div className="ml-auto w-[180px] rounded-md bg-white/[0.02] px-2 py-1.5 text-right shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className={numberCellClass}>{formatTurnoverCompact(getValue<number | null>())}</div>
      </div>
    ),
  },
  { accessorKey: "openInterest", header: "ОИ", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span> },
  { accessorKey: "metrics.dayRangePct", header: "Диапазон %", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatSignedPercent(row.original.metrics.dayRangePct)}</span> },
];
