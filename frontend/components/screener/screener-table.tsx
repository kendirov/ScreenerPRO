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
import type { ScreenerRow } from "@screenerpro/shared";
import { EmptyState } from "@/components/ui/primitives";
import { isStockInPlay } from "@/lib/domain/stock-screener-display";
import { cn } from "@/lib/utils/cn";

export function ScreenerTable({
  rows,
  columns,
  emptyTitle = "Нет данных",
  emptyText = "Источник данных временно недоступен.",
}: {
  rows: ScreenerRow[];
  columns: ColumnDef<ScreenerRow>[];
  emptyTitle?: string;
  emptyText?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "turnover", desc: true }]);

  // TanStack Table manages its own internal memoization model.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowsModel = table.getRowModel().rows;

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-[linear-gradient(180deg,rgba(2,6,23,0.68),rgba(2,6,23,0.58))] shadow-[0_14px_34px_rgba(2,6,23,0.3)] backdrop-blur-md">
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title={emptyTitle} text={emptyText} />
        </div>
      ) : (
        <table className="w-full min-w-[840px] table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/88 backdrop-blur-md">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-white/5 text-[11px] uppercase tracking-[0.08em] text-slate-400">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-2.5 text-left font-medium">
                    {header.isPlaceholder ? null : (
                      (() => {
                        const sorted = header.column.getIsSorted();
                        const sortMark = sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "•";
                        return (
                          <button
                            className={cn(
                              "flex w-full items-center gap-1.5 text-left transition",
                              sorted ? "font-semibold text-indigo-100" : "text-slate-300 hover:text-slate-100",
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            <span className={cn("text-[10px]", sorted ? "text-indigo-300" : "text-slate-500")}>{sortMark}</span>
                          </button>
                        );
                      })()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rowsModel.map((row, rowIndex) => (
              (() => {
                const inPlayStrong = row.original.assetClass === "stock" && isStockInPlay(row.original);
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-white/5 transition duration-150 hover:bg-slate-800/40 focus-within:bg-slate-800/40",
                      rowIndex % 2 === 1 ? "bg-white/[0.02]" : "bg-transparent",
                      inPlayStrong ? "bg-emerald-950/18" : "",
                    )}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-4 py-2.5 align-top text-slate-200",
                      inPlayStrong && cellIndex === 0 ? "border-l-2 border-emerald-500/50 pl-3.5" : "",
                      (row.original.percentChange ?? 0) > 0 && cell.column.id === "percentChange" ? "text-emerald-300" : "",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                    ))}
                  </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
