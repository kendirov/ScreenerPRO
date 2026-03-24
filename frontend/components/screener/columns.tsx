"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ScreenerRow } from "@screenerpro/shared";
import { tradingFormat } from "@/lib/formatters/trading";

const numberCellClass = "text-right font-mono tabular-nums";
const badgeClass: Record<"active" | "has_activity" | "inactive" | "unknown", string> = {
  active: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
  has_activity: "border-cyan-400/30 bg-cyan-500/15 text-cyan-200",
  inactive: "border-slate-600/60 bg-slate-700/30 text-slate-300",
  unknown: "border-slate-700/60 bg-slate-800/40 text-slate-400",
};

function formatActivityRatio(ratio: number | null) {
  if (ratio === null) return "—";
  return `${(ratio * 100).toFixed(0)}% к вчерашнему`;
}

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
  {
    accessorKey: "metrics.activityRatio",
    header: "Активность",
    cell: ({ row }) => {
      const cls = row.original.stockActivityClass;
      const label = cls === "active" ? "Активные" : cls === "has_activity" ? "Есть активность" : cls === "inactive" ? "Низкая" : "Нет базы";
      const ratio = row.original.metrics.activityRatio;
      const required = row.original.metrics.requiredActivityRatio;
      return (
        <div className="space-y-1 text-right">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${badgeClass[cls]}`}>{label}</span>
          <p className="font-mono text-[11px] text-slate-200">{formatActivityRatio(ratio)}</p>
          {ratio !== null && required !== null ? (
            <p className="text-[10px] text-slate-500">порог {Math.round(required * 100)}%</p>
          ) : null}
        </div>
      );
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
