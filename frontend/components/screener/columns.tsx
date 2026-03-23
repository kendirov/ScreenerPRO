"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ScreenerRow } from "@screenerpro/shared";
import { tradingFormat } from "@/lib/formatters/trading";

const numberCellClass = "text-right font-mono tabular-nums";

export const stockColumns: ColumnDef<ScreenerRow>[] = [
  {
    accessorKey: "ticker",
    header: "Тикер",
    cell: ({ row }) => (
      <div>
        <p className="font-semibold text-slate-100">{row.original.ticker}</p>
        <p className="text-xs text-slate-500">{row.original.shortName}</p>
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
  { accessorKey: "turnover", header: "Оборот", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatTurnoverRub(getValue<number | null>())}</span> },
  { accessorKey: "tradesCount", header: "Сделки", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span> },
  { accessorKey: "metrics.dayRangePct", header: "Диапазон %", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatSignedPercent(row.original.metrics.dayRangePct)}</span> },
];

export const futuresColumns: ColumnDef<ScreenerRow>[] = [
  {
    accessorKey: "ticker",
    header: "Контракт",
    cell: ({ row }) => (
      <div>
        <p className="font-semibold text-slate-100">{row.original.ticker}</p>
        <p className="text-xs text-slate-500">{row.original.shortName}</p>
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
  { accessorKey: "turnover", header: "Оборот", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatTurnoverRub(getValue<number | null>())}</span> },
  { accessorKey: "openInterest", header: "ОИ", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span> },
  { accessorKey: "metrics.dayRangePct", header: "Диапазон %", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatSignedPercent(row.original.metrics.dayRangePct)}</span> },
];
