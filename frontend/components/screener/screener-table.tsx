"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ScreenerRow } from "@/lib/types/market";
import { formatCompact, formatPct, formatPrice } from "@/lib/formatters/number";
import { StatusPill } from "@/components/ui/primitives";
import { cn } from "@/lib/utils/cn";

const FILTERS = ["all", "stock", "future", "high volume", "high volatility", "in play"] as const;
type FilterKey = (typeof FILTERS)[number];

export function ScreenerTable({ rows }: { rows: ScreenerRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "turnover", desc: true }]);
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const parentRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    switch (filter) {
      case "stock":
      case "future":
        return rows.filter((row) => row.assetClass === filter);
      case "high volume":
        return rows.filter((row) => (row.metrics.volumeRatio ?? 0) >= 1.3);
      case "high volatility":
        return rows.filter((row) => (row.metrics.relativeVolatility20d ?? 0) >= 1.2);
      case "in play":
        return rows.filter((row) => row.metrics.isInPlay);
      default:
        return rows;
    }
  }, [rows, filter]);

  const columns = React.useMemo<ColumnDef<ScreenerRow>[]>(
    () => [
      {
        accessorKey: "ticker",
        header: "Ticker",
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-slate-100">{row.original.ticker}</p>
            <p className="text-xs text-slate-500">{row.original.shortName}</p>
          </div>
        ),
      },
      { accessorKey: "assetClass", header: "Market" },
      { accessorKey: "lastPrice", header: "Last", cell: ({ getValue }) => formatPrice(getValue<number>() ?? 0) },
      { accessorKey: "percentChange", header: "Day %", cell: ({ getValue }) => formatPct(getValue<number>() ?? 0) },
      { accessorKey: "turnover", header: "Turnover", cell: ({ getValue }) => formatCompact(getValue<number>() ?? 0) },
      { accessorKey: "metrics.volumeRatio", header: "Vol Ratio", cell: ({ row }) => (row.original.metrics.volumeRatio ?? 0).toFixed(2) },
      { accessorKey: "metrics.relativeVolatility20d", header: "Volatility", cell: ({ row }) => `${(row.original.metrics.relativeVolatility20d ?? 0).toFixed(2)}x` },
      { accessorKey: "tradingStatus", header: "Status", cell: ({ getValue }) => <StatusPill status={getValue<ScreenerRow["tradingStatus"]>()} /> },
    ],
    [],
  );

  // TanStack Table manages its own internal memoization model.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowsModel = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rowsModel.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 p-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full px-3 py-1 text-xs capitalize transition",
                filter === item ? "bg-cyan-500/20 text-cyan-200" : "bg-slate-800 text-slate-300 hover:text-slate-100",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="sticky top-0 z-10 grid grid-cols-8 gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3 text-xs text-slate-400">
        {table.getHeaderGroups()[0].headers.map((header) => (
          <button
            key={header.id}
            className="text-left hover:text-slate-200"
            onClick={header.column.getToggleSortingHandler()}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
          </button>
        ))}
      </div>
      <div ref={parentRef} className="h-[440px] overflow-auto">
        <div style={{ height: rowVirtualizer.getTotalSize() }} className="relative">
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rowsModel[virtualRow.index];
            return (
              <div
                key={row.id}
                className="absolute left-0 top-0 grid w-full grid-cols-8 gap-3 border-b border-slate-800/50 px-4 py-3 text-sm transition hover:bg-slate-800/50 focus-within:bg-slate-800/50"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className={cn(cell.column.id === "percentChange" && (row.original.percentChange ?? 0) > 0 ? "text-emerald-300" : "")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
