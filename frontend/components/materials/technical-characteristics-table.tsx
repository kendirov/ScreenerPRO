"use client";

import * as React from "react";
import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";
import { TechnicalCharacteristicsColumnHeader } from "@/components/materials/technical-characteristics-column-header";
import { TC_UI } from "@/lib/domain/technical-characteristics-labels";
import type { PresetEvaluation, TechnicalPreset } from "@/lib/domain/technical-characteristics-presets";
import {
  COLUMN_DEFS,
  getDefaultColumnsForMode,
  MODE_CONFIGS,
  TABLE_PRESETS,
  type ColumnKey,
  type DensityMode,
  type TechnicalMode,
} from "@/lib/materials/technical-characteristics-view";
import { cn } from "@/lib/utils/cn";

export function TechnicalCharacteristicsTable({
  mode,
  rows,
  density,
  heatMode,
  selectedTicker,
  onSelectTicker,
  onSummaryChange,
  tradingPreset,
  presetEvaluations,
  presetRankByTicker,
}: {
  mode: TechnicalMode;
  rows: TechnicalCharacteristicsRow[];
  density: DensityMode;
  heatMode: boolean;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  onSummaryChange?: (summary: { count: number; medianSpread: number | null; totalTurnoverMln: number | null; avgTrades: number | null }) => void;
  tradingPreset?: TechnicalPreset | null;
  presetEvaluations?: Map<string, PresetEvaluation>;
  presetRankByTicker?: Map<string, number>;
}) {
  const modeConfig = MODE_CONFIGS[mode];
  const [sortBy, setSortBy] = React.useState<{ key: ColumnKey; desc: boolean }>(modeConfig.defaultSort);
  const [visibleColumns, setVisibleColumns] = React.useState<ColumnKey[]>(() => getDefaultColumnsForMode(mode, density));
  const presetActive = Boolean(tradingPreset && presetEvaluations);
  const useShortHeaders = density === "compact";

  React.useEffect(() => {
    setSortBy(modeConfig.defaultSort);
    setVisibleColumns(getDefaultColumnsForMode(mode, density));
  }, [mode, density, modeConfig.defaultSort]);

  const optionalColumns = React.useMemo(() => {
    const all = Object.keys(COLUMN_DEFS) as ColumnKey[];
    return all.filter((key) => !visibleColumns.includes(key));
  }, [visibleColumns]);

  const columns = React.useMemo(() => visibleColumns.map((key) => COLUMN_DEFS[key]), [visibleColumns]);

  const sortedRows = React.useMemo(() => {
    if (presetActive && presetEvaluations) {
      return [...rows].sort((a, b) => {
        const scoreA = presetEvaluations.get(a.ticker)?.presetScore ?? -1;
        const scoreB = presetEvaluations.get(b.ticker)?.presetScore ?? -1;
        return scoreB - scoreA;
      });
    }
    const column = COLUMN_DEFS[sortBy.key];
    if (!column) return rows;
    return [...rows].sort((a, b) => {
      const left = column.sortValue(a);
      const right = column.sortValue(b);
      if (typeof left === "number" && typeof right === "number") return sortBy.desc ? right - left : left - right;
      return sortBy.desc ? String(right).localeCompare(String(left), "ru") : String(left).localeCompare(String(right), "ru");
    });
  }, [rows, sortBy, presetActive, presetEvaluations]);

  const [activeIndex, setActiveIndex] = React.useState(0);
  const clampedActive = Math.min(activeIndex, Math.max(0, sortedRows.length - 1));

  React.useEffect(() => {
    setActiveIndex(0);
  }, [rows.length, tradingPreset]);

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
        {optionalColumns.length > 0 ? (
          <details className="text-[11px] text-slate-400">
            <summary className="cursor-pointer rounded px-2 py-1 hover:bg-slate-800 hover:text-slate-200">
              Добавить колонки ({optionalColumns.length})
            </summary>
            <div className="mt-1.5 flex max-w-full flex-wrap gap-1">
              {optionalColumns.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleColumn(key)}
                  className="rounded border border-slate-700/80 bg-slate-950/70 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
                >
                  + {COLUMN_DEFS[key].shortLabel}
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {presetActive ? (
        <p className="text-[11px] text-cyan-300/80">
          Сортировка по оценке подбора. Топ-3 строки подсвечены — удобны для наблюдения в рамках выбранной задачи.
        </p>
      ) : null}

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
          <div className="p-6 text-center text-sm text-slate-400">{TC_UI.noRows}</div>
        ) : (
          <table className="w-full min-w-[1280px] table-fixed border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
              <tr className="border-b border-slate-800/90 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                {columns.map((column) => {
                  const isSorted = !presetActive && sortBy.key === column.key;
                  return (
                    <th
                      key={column.key}
                      className={cn(
                        "px-3 py-2 font-medium",
                        column.align === "right" ? "text-right" : "text-left",
                        column.sticky && "sticky z-20 bg-slate-900/95",
                        column.key === "instrument" && "left-0 min-w-[220px]",
                        column.key === "ticker" && "left-[220px] min-w-[100px]",
                      )}
                    >
                      <TechnicalCharacteristicsColumnHeader
                        label={useShortHeaders ? column.shortLabel : column.label}
                        tooltip={column.tooltip}
                        sorted={isSorted}
                        sortDesc={sortBy.desc}
                        align={column.align}
                        onSort={() => setSortBy((prev) => ({ key: column.key, desc: prev.key === column.key ? !prev.desc : true }))}
                      />
                    </th>
                  );
                })}
                {presetActive ? (
                  <>
                    <th className="min-w-[56px] px-3 py-2 text-right font-medium">{TC_UI.presetScoreColumn}</th>
                    <th className="min-w-[180px] px-3 py-2 text-left font-medium">{TC_UI.presetMatchColumn}</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => {
                const rank = presetRankByTicker?.get(row.ticker);
                const isTopThree = rank !== undefined && rank <= 3;
                const evaluation = presetEvaluations?.get(row.ticker);
                return (
                  <tr
                    key={row.ticker}
                    className={cn(
                      "cursor-pointer border-b border-slate-800/50 hover:bg-slate-800/40",
                      row.ticker === selectedTicker && "bg-slate-800/45",
                      idx === clampedActive && "outline outline-1 outline-cyan-500/30",
                      isTopThree && "bg-amber-500/[0.06]",
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
                          heatMode && !presetActive && sortBy.key === column.key && "bg-cyan-500/5",
                        )}
                      >
                        <span title={column.cellMeta?.(row)?.title}>{column.value(row)}</span>
                      </td>
                    ))}
                    {presetActive && evaluation ? (
                      <>
                        <td className={cn("px-3 py-2 text-right font-mono text-cyan-200/90", density === "comfortable" && "py-2.5")}>
                          {evaluation.presetScore}
                        </td>
                        <td className={cn("px-3 py-2 align-top", density === "comfortable" && "py-2.5")}>
                          <ul className="space-y-0.5 font-sans text-[11px] text-slate-400">
                            {evaluation.presetReasonTags.slice(0, 4).map((tag) => (
                              <li key={tag}>· {tag}</li>
                            ))}
                          </ul>
                        </td>
                      </>
                    ) : presetActive ? (
                      <>
                        <td className="px-3 py-2 text-right text-slate-500">—</td>
                        <td className="px-3 py-2 text-slate-500">—</td>
                      </>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-slate-500">{TC_UI.tableFootnote}</p>
    </div>
  );
}
