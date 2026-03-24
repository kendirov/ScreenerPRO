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
    <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.68))] shadow-[0_12px_30px_rgba(2,6,23,0.3)]">
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title={emptyTitle} text={emptyText} />
        </div>
      ) : (
        <table className="w-full min-w-[840px] table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur-md">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-700/80 text-[11px] text-slate-300">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2.5 text-left font-medium">
                    {header.isPlaceholder ? null : (
                      (() => {
                        const sorted = header.column.getIsSorted();
                        const sortMark = sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "•";
                        return (
                          <button
                            className={cn(
                              "flex w-full items-center gap-1.5 text-left transition",
                              sorted ? "font-semibold text-cyan-100" : "text-slate-300 hover:text-slate-100",
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            <span className={cn("text-[10px]", sorted ? "text-cyan-300" : "text-slate-500")}>{sortMark}</span>
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
            {rowsModel.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-800/70 transition duration-150 hover:bg-[linear-gradient(90deg,rgba(15,23,42,0.9),rgba(15,23,42,0.78))] focus-within:bg-[linear-gradient(90deg,rgba(15,23,42,0.9),rgba(15,23,42,0.78))]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "px-3 py-3 align-top text-slate-200",
                      (row.original.percentChange ?? 0) > 0 && cell.column.id === "percentChange" ? "text-emerald-300" : "",
                    )}
                  >
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
