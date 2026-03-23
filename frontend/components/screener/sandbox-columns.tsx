"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { ScreenerRow } from "@screenerpro/shared";
import { tradingFormat } from "@/lib/formatters/trading";

const numberCellClass = "text-right font-mono tabular-nums";

export const sandboxStockColumns: ColumnDef<ScreenerRow>[] = [
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
  { accessorKey: "percentChange", header: "%", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatSignedPercent(getValue<number | null>())}</span> },
  { accessorKey: "turnover", header: "Оборот", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatTurnoverRub(getValue<number | null>())}</span> },
  { accessorKey: "volume", header: "Объём (raw)", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span> },
  { accessorKey: "tradesCount", header: "Сделки", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span> },
  { accessorKey: "metrics.dayRangePct", header: "Диапазон %", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatSignedPercent(row.original.metrics.dayRangePct)}</span> },
  { accessorKey: "metrics.turnoverVsAverage", header: "Оборот/ср", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatDynamicPrice(row.original.metrics.turnoverVsAverage)}</span> },
  { accessorKey: "metrics.rangeVsAverage", header: "Диапазон/ср", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatDynamicPrice(row.original.metrics.rangeVsAverage)}</span> },
  { accessorKey: "metrics.tradesVsAverage", header: "Сделки/ср", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatDynamicPrice(row.original.metrics.tradesVsAverage)}</span> },
  { accessorKey: "metrics.inPlayScore", header: "In Play Score", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatDynamicPrice(row.original.metrics.inPlayScore)}</span> },
  { accessorKey: "metrics.isInPlay", header: "In Play", cell: ({ row }) => <span className="text-xs text-slate-300">{row.original.metrics.isInPlay ? "да" : "нет"}</span> },
  { accessorKey: "tradingStatus", header: "Статус", cell: ({ getValue }) => <span className="text-xs text-slate-300">{getValue<string>()}</span> },
  { accessorKey: "liquidityClass", header: "Ликвидность", cell: ({ getValue }) => <span className="text-xs text-slate-300">{getValue<string>()}</span> },
  { accessorKey: "lotSize", header: "Лот", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span> },
];

export const sandboxFuturesColumns: ColumnDef<ScreenerRow>[] = [
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
  { accessorKey: "percentChange", header: "%", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatSignedPercent(getValue<number | null>())}</span> },
  { accessorKey: "turnover", header: "Оборот", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatTurnoverRub(getValue<number | null>())}</span> },
  { accessorKey: "volume", header: "Объём (raw)", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span> },
  { accessorKey: "openInterest", header: "ОИ", cell: ({ getValue }) => <span className={numberCellClass}>{tradingFormat.formatInteger(getValue<number | null>())}</span> },
  { accessorKey: "expiryDate", header: "Экспирация", cell: ({ getValue }) => <span className={numberCellClass}>{getValue<string | null>() ?? "—"}</span> },
  { accessorKey: "metrics.dayRangePct", header: "Диапазон %", cell: ({ row }) => <span className={numberCellClass}>{tradingFormat.formatSignedPercent(row.original.metrics.dayRangePct)}</span> },
  { accessorKey: "tradingStatus", header: "Статус", cell: ({ getValue }) => <span className="text-xs text-slate-300">{getValue<string>()}</span> },
  { accessorKey: "updatedAt", header: "Обновлено", cell: ({ getValue }) => <span className="text-xs text-slate-400">{new Date(getValue<string>()).toLocaleTimeString("ru-RU")}</span> },
];
