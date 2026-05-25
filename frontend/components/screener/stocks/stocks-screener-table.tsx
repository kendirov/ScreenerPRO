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
import type { ScreenerDataStatus, ScreenerRow } from "@screenerpro/shared";
import { ChevronUp, LineChart } from "lucide-react";
import { STOCK_TABLE_COLUMN_WIDTHS } from "@/components/screener/columns";
import { StockExpandedCard } from "@/components/screener/stocks/stock-expanded-card";
import {
  StockRowHoverCard,
  buildHoverAnchorFromEvent,
  isNoStockTooltipTarget,
  patchHoverAnchorPosition,
  type StockRowHoverAnchor,
} from "@/components/screener/stocks/stock-row-hover-card";
import { EmptyState } from "@/components/ui/primitives";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isStockInPlay } from "@/lib/domain/stock-screener-display";
import type { StockSparklineSeries } from "@/lib/domain/stock-sparkline";
import { useInPlayStockCandles } from "@/lib/hooks/use-in-play-stock-candles";
import { cn } from "@/lib/utils/cn";

const HOVER_SHOW_MS = 300;
const HOVER_HIDE_MS = 160;

function dismissHover(
  clearTimers: () => void,
  setHoverAnchor: React.Dispatch<React.SetStateAction<StockRowHoverAnchor | null>>,
) {
  clearTimers();
  setHoverAnchor(null);
}

interface CandleSeriesLookup {
  get: (ticker: string) => StockSparklineSeries | null | undefined;
}

function headerAlignClass(align: "left" | "right" | undefined): string {
  return align === "right" ? "text-right" : "text-left";
}

function isDetailsColumn(column: ColumnDef<ScreenerRow>): boolean {
  return column.id === "details";
}

export function StocksScreenerTable({
  rows,
  columns,
  maxTurnover,
  dataStatus,
  hideIlliquid,
  candlesByTicker,
  showTooltips = true,
  emptyTitle = "Нет данных",
  emptyText = "Источник данных временно недоступен.",
}: {
  rows: ScreenerRow[];
  columns: ColumnDef<ScreenerRow>[];
  maxTurnover: number;
  dataStatus?: ScreenerDataStatus | null;
  hideIlliquid?: boolean;
  candlesByTicker?: CandleSeriesLookup;
  showTooltips?: boolean;
  emptyTitle?: string;
  emptyText?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "turnover", desc: true }]);
  const [expandedTicker, setExpandedTicker] = React.useState<string | null>(null);
  const [highlightedTicker, setHighlightedTicker] = React.useState<string | null>(null);
  const [hoverAnchor, setHoverAnchor] = React.useState<StockRowHoverAnchor | null>(null);
  const showTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hoverTicker = showTooltips ? (hoverAnchor?.ticker ?? null) : null;
  const activeTicker = expandedTicker ? null : hoverTicker;

  const hoverFetchTickers = React.useMemo(() => {
    if (!showTooltips || !hoverTicker || expandedTicker) return [];
    const cached = candlesByTicker?.get(hoverTicker.toUpperCase()) ?? candlesByTicker?.get(hoverTicker);
    if (cached?.status === "ok") return [];
    return [hoverTicker];
  }, [showTooltips, hoverTicker, expandedTicker, candlesByTicker]);

  const { seriesByTicker: hoverSeriesByTicker } = useInPlayStockCandles(hoverFetchTickers);

  const resolveSeries = React.useCallback(
    (ticker: string): StockSparklineSeries | null | undefined => {
      const key = ticker.toUpperCase();
      return (
        candlesByTicker?.get(key) ??
        candlesByTicker?.get(ticker) ??
        hoverSeriesByTicker.get(key) ??
        null
      );
    },
    [candlesByTicker, hoverSeriesByTicker],
  );

  const clearTimers = React.useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    showTimerRef.current = null;
    hideTimerRef.current = null;
  }, []);

  const scheduleHide = React.useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setHoverAnchor(null);
    }, HOVER_HIDE_MS);
  }, []);

  const cancelHide = React.useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const showHover = React.useCallback(
    (ticker: string, event: React.MouseEvent) => {
      if (!showTooltips || expandedTicker === ticker || isNoStockTooltipTarget(event.target)) return;
      cancelHide();
      if (showTimerRef.current) clearTimeout(showTimerRef.current);

      const nextAnchor = buildHoverAnchorFromEvent(ticker, event);
      const reveal = () => setHoverAnchor(nextAnchor);

      if (hoverAnchor?.ticker && hoverAnchor.ticker !== ticker) {
        reveal();
        return;
      }

      showTimerRef.current = setTimeout(reveal, HOVER_SHOW_MS);
    },
    [showTooltips, expandedTicker, hoverAnchor?.ticker, cancelHide],
  );

  const updateHoverPosition = React.useCallback((event: React.MouseEvent) => {
    setHoverAnchor((prev) =>
      prev ? patchHoverAnchorPosition(prev, event.clientX, event.clientY) : prev,
    );
  }, []);

  const handleRowMouseMove = React.useCallback(
    (ticker: string, event: React.MouseEvent) => {
      if (isNoStockTooltipTarget(event.target)) {
        if (hoverAnchor?.ticker === ticker) {
          dismissHover(clearTimers, setHoverAnchor);
        }
        return;
      }
      if (hoverTicker === ticker) {
        updateHoverPosition(event);
      }
    },
    [hoverAnchor?.ticker, hoverTicker, updateHoverPosition, clearTimers],
  );

  const toggleExpanded = React.useCallback(
    (ticker: string) => {
      clearTimers();
      setHoverAnchor(null);
      setExpandedTicker((prev) => (prev === ticker ? null : ticker));
    },
    [clearTimers],
  );

  React.useEffect(() => () => clearTimers(), [clearTimers]);

  React.useEffect(() => {
    if (!showTooltips) {
      clearTimers();
      setHoverAnchor(null);
    }
  }, [showTooltips, clearTimers]);

  const tableColumns = React.useMemo<ColumnDef<ScreenerRow>[]>(
    () => [
      ...columns,
      {
        id: "details",
        header: "Детали",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => {
          const isExpanded = expandedTicker === row.original.ticker;
          return (
            <div className="flex items-center justify-end" data-no-stock-tooltip="true">
              <button
                type="button"
                title={isExpanded ? "Свернуть график" : "Открыть график"}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Свернуть график инструмента" : "Открыть график инструмента"}
                onMouseEnter={() => dismissHover(clearTimers, setHoverAnchor)}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleExpanded(row.original.ticker);
                }}
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition",
                  isExpanded
                    ? "border-lab-cyan/40 bg-lab-cyan/10 text-lab-cyan"
                    : "border-transparent text-lab-text-dim hover:border-lab-border-soft/50 hover:bg-white/[0.03] hover:text-lab-cyan",
                )}
              >
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <LineChart className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>
          );
        },
      },
    ],
    [columns, expandedTicker, toggleExpanded, clearTimers],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rowsModel = table.getRowModel().rows;

  const activeRow = React.useMemo(() => {
    if (!activeTicker) return null;
    return rows.find((row) => row.ticker === activeTicker) ?? null;
  }, [rows, activeTicker]);

  const expandedRow = React.useMemo(() => {
    if (!expandedTicker) return null;
    return rows.find((row) => row.ticker === expandedTicker) ?? null;
  }, [rows, expandedTicker]);

  const columnCount = tableColumns.length;

  return (
    <div className="relative min-w-0 flex-1">
      <div className="overflow-x-auto rounded-xl border border-lab-border/30 bg-lab-bg-deep/35 shadow-[0_6px_20px_rgba(2,6,23,0.18)] backdrop-blur-md">
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title={emptyTitle} text={emptyText} />
          </div>
        ) : (
          <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
            <colgroup>
              {STOCK_TABLE_COLUMN_WIDTHS.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-lab-bg-deep/92 backdrop-blur-md">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-lab-border-soft/25 text-[10px] uppercase tracking-[0.1em] text-lab-text-dim"
                >
                  {headerGroup.headers.map((header) => {
                    const align = header.column.columnDef.meta?.align;
                    const headerTooltip = header.column.columnDef.meta?.headerTooltip;
                    const sorted = header.column.getIsSorted();
                    const sortMark = sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "";
                    const isDetails = header.column.id === "details";

                    const headerLabel = header.isPlaceholder ? null : isDetails ? (
                      <span className="inline-flex w-full items-center justify-end text-[10px] uppercase tracking-[0.1em] text-lab-text-dim">
                        Детали
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          "inline-flex w-full items-center gap-1 transition",
                          align === "right" ? "justify-end" : "justify-start",
                          sorted ? "font-semibold text-lab-cyan" : "text-lab-text-dim hover:text-lab-text-main",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        {sortMark ? <span className="text-[9px] text-lab-cyan/80">{sortMark}</span> : null}
                      </button>
                    );

                    return (
                      <th
                        key={header.id}
                        className={cn("px-2.5 py-1.5 font-medium sm:px-3", headerAlignClass(align))}
                      >
                        {header.isPlaceholder ? null : headerTooltip && !isDetails ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{headerLabel}</TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-xs leading-snug">
                              {headerTooltip}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          headerLabel
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {rowsModel.map((row, rowIndex) => {
                const inPlay = row.original.assetClass === "stock" && isStockInPlay(row.original);
                const isExpanded = expandedTicker === row.original.ticker;
                const isHighlighted = highlightedTicker === row.original.ticker || isExpanded;

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      className={cn(
                        "border-b border-lab-border-soft/20 transition duration-150",
                        rowIndex % 2 === 1 ? "bg-white/[0.012]" : "bg-transparent",
                        isHighlighted ? "bg-lab-cyan/[0.05]" : "hover:bg-white/[0.025]",
                        inPlay ? "bg-cyan-950/8" : "",
                      )}
                      onMouseEnter={(event) => {
                        setHighlightedTicker(row.original.ticker);
                        if (showTooltips) showHover(row.original.ticker, event);
                      }}
                      onMouseMove={(event) => handleRowMouseMove(row.original.ticker, event)}
                      onMouseLeave={() => {
                        setHighlightedTicker((prev) => (prev === row.original.ticker ? null : prev));
                        scheduleHide();
                      }}
                    >
                      {row.getVisibleCells().map((cell, cellIndex) => {
                        const align = cell.column.columnDef.meta?.align;
                        const isDetails = isDetailsColumn(cell.column.columnDef);

                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              "px-2.5 py-1.5 align-middle sm:px-3",
                              headerAlignClass(align),
                              inPlay && cellIndex === 0 ? "border-l border-lab-cyan/35 pl-2 sm:pl-2.5" : "",
                            )}
                            {...(isDetails ? { "data-no-stock-tooltip": "true" } : {})}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && expandedRow ? (
                      <tr className="border-b border-lab-border-soft/30 bg-black/10" data-no-stock-tooltip="true">
                        <td colSpan={columnCount} className="p-0" data-no-stock-tooltip="true">
                          <StockExpandedCard
                            row={expandedRow}
                            maxTurnover={maxTurnover}
                            dataStatus={dataStatus}
                            hideIlliquid={hideIlliquid}
                            onClose={() => setExpandedTicker(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showTooltips && activeRow && hoverAnchor ? (
        <StockRowHoverCard
          row={activeRow}
          maxTurnover={maxTurnover}
          series={resolveSeries(activeRow.ticker)}
          anchor={hoverAnchor}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      ) : null}
    </div>
  );
}
