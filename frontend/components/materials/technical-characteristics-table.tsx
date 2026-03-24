"use client";

import * as React from "react";
import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";
import { COLUMN_DEFS, MODE_CONFIGS, TABLE_PRESETS, type ColumnKey, type DensityMode, type TechnicalMode } from "@/lib/materials/technical-characteristics-view";
import { cn } from "@/lib/utils/cn";

export function TechnicalCharacteristicsTable({
  mode,
  rows,
  density,
  heatMode,
  selectedTicker,
  onSelectTicker,
  onSummaryChange,
}: {
  mode: TechnicalMode;
  rows: TechnicalCharacteristicsRow[];
  density: DensityMode;
  heatMode: boolean;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  onSummaryChange?: (summary: { count: number; medianSpread: number | null; totalTurnoverMln: number | null; avgTrades: number | null }) => void;
}) {
  const modeConfig = MODE_CONFIGS[mode];
  const [sortBy, setSortBy] = React.useState<{ key: ColumnKey; desc: boolean }>(modeConfig.defaultSort);
  const [visibleColumns, setVisibleColumns] = React.useState<ColumnKey[]>(modeConfig.defaultColumns);
  React.useEffect(() => {
    setSortBy(modeConfig.defaultSort);
    setVisibleColumns(modeConfig.defaultColumns);
  }, [mode, modeConfig.defaultColumns, modeConfig.defaultSort]);

  const columns = React.useMemo(() => visibleColumns.map((key) => COLUMN_DEFS[key]), [visibleColumns]);
  const sortedRows = React.useMemo(() => {
    const column = COLUMN_DEFS[sortBy.key];
    if (!column) return rows;
    return [...rows].sort((a, b) => {
      const left = column.sortValue(a);
      const right = column.sortValue(b);
      if (typeof left === "number" && typeof right === "number") return sortBy.desc ? right - left : left - right;
      return sortBy.desc ? String(right).localeCompare(String(left), "ru") : String(left).localeCompare(String(right), "ru");
    });
  }, [rows, sortBy]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const clampedActive = Math.min(activeIndex, Math.max(0, sortedRows.length - 1));

  React.useEffect(() => {
    setActiveIndex(0);
  }, [rows.length]);

  React.useEffect(() => {
    const target = sortedRows[clampedActive];
    if (target) onSelectTicker(target.ticker);
  }, [clampedActive, onSelectTicker, sortedRows]);

  React.useEffect(() => {
    if (!onSummaryChange) return;
    const spreads = sortedRows.map((r) => r.spreadPct.value).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const medianSpread = spreads.length === 0 ? null : spreads[Math.floor(spreads.length / 2)];
    const totalTurnover = sortedRows.reduce((acc, row) => acc + (row.turnoverRub.value ?? 0), 0);
    const trades = sortedRows.map((r) => r.tradesCount.value).filter((v): v is number => v !== null);
    const avgTrades = trades.length ? trades.reduce((a, b) => a + b, 0) / trades.length : null;
    onSummaryChange({
      count: sortedRows.length,
      medianSpread,
      totalTurnoverMln: totalTurnover > 0 ? totalTurnover / 1_000_000 : null,
      avgTrades,
    });
  }, [onSummaryChange, sortedRows]);

  function applyPreset(presetId: string) {
    const preset = TABLE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setVisibleColumns(preset.columns);
  }

  function toggleColumn(columnId: ColumnKey) {
    setVisibleColumns((prev) => (prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId]));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800/90 bg-slate-900/40 p-2">
        <div className="inline-flex rounded-md border border-slate-700/80 bg-slate-950/80 p-0.5 text-xs">
          {TABLE_PRESETS.map((preset) => (
            <button key={preset.id} className="rounded px-2 py-1 text-slate-300 hover:bg-slate-800" onClick={() => applyPreset(preset.id)} type="button">
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.values(COLUMN_DEFS).map((column) => {
            const active = visibleColumns.includes(column.key);
            return (
              <button
                key={column.key}
                type="button"
                onClick={() => toggleColumn(column.key)}
                className={cn(
                  "rounded border px-2 py-1 text-[11px] transition",
                  active ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "border-slate-700/80 bg-slate-950/70 text-slate-400 hover:text-slate-200",
                )}
              >
                {column.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/55"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, Math.max(0, sortedRows.length - 1)));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
          }
        }}
      >
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">Нет данных по выбранным фильтрам.</div>
        ) : (
          <table className="w-full min-w-[1280px] table-fixed border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
              <tr className="border-b border-slate-800/90 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                {columns.map((column) => {
                  const isSorted = sortBy.key === column.key;
                  return (
                    <th key={column.key} className={cn("px-3 py-2 font-medium", column.align === "right" ? "text-right" : "text-left", column.sticky && "sticky z-20 bg-slate-900/95", column.key === "instrument" && "left-0 min-w-[220px]", column.key === "ticker" && "left-[220px] min-w-[100px]")}>
                      <button
                        type="button"
                        className={cn("inline-flex items-center gap-1 transition hover:text-slate-200", isSorted && "text-cyan-300")}
                        onClick={() => setSortBy((prev) => ({ key: column.key, desc: prev.key === column.key ? !prev.desc : true }))}
                      >
                        {column.label}
                        {isSorted ? (sortBy.desc ? "↓" : "↑") : ""}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => (
                <tr
                  key={row.ticker}
                  className={cn(
                    "cursor-pointer border-b border-slate-800/50 hover:bg-slate-800/40",
                    row.ticker === selectedTicker && "bg-slate-800/45",
                    idx === clampedActive && "outline outline-1 outline-cyan-500/30",
                  )}
                  onClick={() => {
                    setActiveIndex(idx);
                    onSelectTicker(row.ticker);
                  }}
                >
                  {columns.map((column) => (
                    <td
                      key={`${row.ticker}-${column.key}`}
                      className={cn(
                        "px-3 align-top font-mono tabular-nums text-slate-100",
                        density === "compact" ? "py-1.5" : "py-2.5",
                        column.align === "right" ? "text-right" : "text-left",
                        column.priority === "secondary" && "text-slate-400",
                        column.sticky && "sticky z-10 bg-slate-900/96",
                        column.key === "instrument" && "left-0",
                        column.key === "ticker" && "left-[220px]",
                        heatMode && sortBy.key === column.key && "bg-cyan-500/5",
                      )}
                    >
                      <span>{column.value(row)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-slate-500">
        Единицы вынесены в заголовки столбцов. Значения в ячейках показаны в чистом виде для ускоренного сканирования.
      </p>
    </div>
  );
}
