"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ScreenerRow } from "@screenerpro/shared";
import {
  StockPercentCell,
  StockPriceCell,
  StockRangeCell,
  StockTickerCell,
  StockTradesCell,
  StockTurnoverCell,
  formatTurnoverCompact,
} from "@/components/screener/stocks/stock-table-cells";
import {
  STOCK_DAY_RANGE_COLUMN_LABEL,
  STOCK_DAY_RANGE_HEADER_TOOLTIP,
  STOCK_ILLIQUID_TURNOVER_FLOOR,
  getStockReasonSummary,
} from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: "left" | "right";
    headerTooltip?: string;
  }
}

/** Фиксированные доли ширины для table-fixed — данные + Причина + Детали. */
export const STOCK_TABLE_COLUMN_WIDTHS = [
  "14%",
  "9%",
  "7%",
  "13%",
  "11%",
  "9%",
  "16%",
  "12%",
  "9%",
] as const;

const futuresNumberClass = "text-right font-mono tabular-nums text-[13px] text-slate-200";

export function createStockColumns(maxTurnover: number): ColumnDef<ScreenerRow>[] {
  return [
    {
      accessorKey: "ticker",
      header: "Тикер",
      size: 88,
      meta: { align: "left" },
      cell: ({ row }) => <StockTickerCell row={row.original} maxTurnover={maxTurnover} />,
    },
    {
      accessorKey: "lastPrice",
      header: "Цена",
      size: 72,
      meta: { align: "right" },
      cell: ({ getValue }) => <StockPriceCell value={getValue<number | null>()} />,
    },
    {
      accessorKey: "percentChange",
      header: "%",
      size: 64,
      meta: { align: "right" },
      cell: ({ getValue }) => <StockPercentCell value={getValue<number | null>()} />,
    },
    {
      accessorKey: "turnover",
      header: "Оборот",
      size: 96,
      meta: { align: "right" },
      cell: ({ getValue }) => (
        <StockTurnoverCell value={getValue<number | null>()} maxTurnover={maxTurnover} />
      ),
    },
    {
      accessorKey: "tradesCount",
      header: "Сделки",
      size: 80,
      meta: { align: "right" },
      cell: ({ row }) => <StockTradesCell row={row.original} />,
    },
    {
      id: "dayRange",
      accessorFn: (row) => row.metrics.dayRangePct,
      header: STOCK_DAY_RANGE_COLUMN_LABEL,
      size: 72,
      meta: {
        align: "right",
        headerTooltip: STOCK_DAY_RANGE_HEADER_TOOLTIP,
      },
      cell: ({ row }) => <StockRangeCell row={row.original} />,
    },
    {
      id: "reason",
      header: "Причина",
      enableSorting: false,
      meta: { align: "left" },
      cell: ({ row }) => {
        const summary = getStockReasonSummary(row.original, maxTurnover);
        if (summary === "—") {
          return <span className="text-[11px] text-lab-text-dim">—</span>;
        }
        return (
          <span
            className="line-clamp-2 text-[11px] leading-snug text-lab-text-muted"
            title={summary}
          >
            {summary}
          </span>
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
  {
    accessorKey: "lastPrice",
    header: "Цена",
    cell: ({ getValue }) => (
      <span className={futuresNumberClass}>{tradingFormat.formatDynamicPrice(getValue<number | null>())}</span>
    ),
  },
  {
    accessorKey: "percentChange",
    header: "%",
    cell: ({ getValue }) => {
      const value = getValue<number | null>();
      const cls =
        value !== null && value > 0
          ? "text-emerald-400"
          : value !== null && value < 0
            ? "text-rose-400"
            : "text-slate-300";
      return (
        <span className={`${futuresNumberClass} ${cls}`}>{tradingFormat.formatSignedPercent(value)}</span>
      );
    },
  },
  {
    accessorKey: "turnover",
    header: "Оборот, ₽",
    cell: ({ getValue }) => (
      <div className="ml-auto w-[180px] rounded-md bg-white/[0.02] px-2 py-1.5 text-right shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className={futuresNumberClass}>{formatTurnoverCompact(getValue<number | null>())}</div>
      </div>
    ),
  },
  {
    accessorKey: "openInterest",
    header: "ОИ",
    cell: ({ getValue }) => (
      <span className={futuresNumberClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span>
    ),
  },
  {
    accessorKey: "metrics.dayRangePct",
    header: "Диапазон %",
    cell: ({ row }) => (
      <span className={futuresNumberClass}>{tradingFormat.formatSignedPercent(row.original.metrics.dayRangePct)}</span>
    ),
  },
];
