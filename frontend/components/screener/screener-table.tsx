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
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title={emptyTitle} text={emptyText} />
        </div>
      ) : (
        <table className="w-full min-w-[840px] table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-800 text-xs text-slate-400">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left font-medium">
                    {header.isPlaceholder ? null : (
                      <button
                        className="w-full text-left transition hover:text-slate-200"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rowsModel.map((row) => (
              <tr key={row.id} className="border-b border-slate-800/50 transition hover:bg-slate-800/50 focus-within:bg-slate-800/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn("px-4 py-3 align-top", (row.original.percentChange ?? 0) > 0 && cell.column.id === "percentChange" ? "text-emerald-300" : "")}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
