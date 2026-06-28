"use client";

import type { NormalizedStockRow } from "@/lib/screener/stocks-radar";
import {
  formatPct,
  formatRangeParen,
  formatTurnoverCompact,
  formatTrades,
} from "@/lib/screener/formatters";
import { metricChangeClass, metricColors } from "@/lib/screener/metric-styles";
import { cn } from "@/lib/utils/cn";

/** Card row semantics: ticker | change % | (day range %) | trades | [turnover] */
export type TapeRowVariant = "liquidity" | "inGame" | "volatility";

const GRID_LIQUIDITY =
  "grid-cols-[minmax(34px,40px)_minmax(38px,46px)_minmax(48px,56px)_minmax(36px,44px)_minmax(36px,44px)]";
const GRID_COMPACT =
  "grid-cols-[minmax(34px,40px)_minmax(38px,46px)_minmax(48px,56px)_minmax(36px,44px)]";
const GRID_IN_GAME_WIDE =
  "grid-cols-[minmax(34px,40px)_minmax(38px,46px)_minmax(48px,56px)_minmax(36px,44px)_minmax(36px,44px)]";

function gridClass(variant: TapeRowVariant, showTurnover: boolean): string {
  if (variant === "liquidity") return GRID_LIQUIDITY;
  if (variant === "volatility") return GRID_COMPACT;
  return showTurnover ? GRID_IN_GAME_WIDE : GRID_COMPACT;
}

export function StockTapeRow({
  row,
  variant = "liquidity",
  showTurnover,
  onClick,
  active,
  className,
}: {
  row: Pick<
    NormalizedStockRow,
    "ticker" | "changePct" | "rangePct" | "trades" | "turnover"
  >;
  variant?: TapeRowVariant;
  showTurnover?: boolean | "responsive";
  onClick?: (ticker: string) => void;
  active?: boolean;
  className?: string;
}) {
  const turnoverResponsive = showTurnover === "responsive";
  const turnoverVisible =
    showTurnover === true ||
    (showTurnover == null && variant === "liquidity");

  return (
    <button
      type="button"
      className={cn(
        "box-border grid w-full max-w-full min-w-0 items-center gap-x-1 overflow-hidden rounded px-0.5 text-left font-mono text-[11px] tabular-nums leading-none",
        turnoverResponsive ? GRID_COMPACT : gridClass(variant, turnoverVisible),
        turnoverResponsive && GRID_IN_GAME_WIDE.replace("grid-cols-", "2xl:grid-cols-"),
        "h-[22px]",
        active && "bg-white/[0.06]",
        className,
      )}
      onClick={() => onClick?.(row.ticker)}
    >
      <span className={cn("min-w-0 truncate font-bold", metricColors.ticker)}>{row.ticker}</span>
      <span className={cn("min-w-0 truncate text-right", metricChangeClass(row.changePct))}>
        {formatPct(row.changePct, 1)}
      </span>
      <span className={cn("min-w-0 truncate text-right", metricColors.range)}>
        {formatRangeParen(row.rangePct)}
      </span>
      <span className={cn("min-w-0 truncate text-right", metricColors.trades)}>{formatTrades(row.trades)}</span>
      {turnoverVisible ? (
        <span className={cn("min-w-0 truncate text-right", metricColors.turnover)}>
          {formatTurnoverCompact(row.turnover)}
        </span>
      ) : turnoverResponsive ? (
        <span
          className={cn(
            "hidden min-w-0 truncate text-right 2xl:block",
            metricColors.turnover,
          )}
        >
          {formatTurnoverCompact(row.turnover)}
        </span>
      ) : null}
    </button>
  );
}

export const IN_GAME_COLUMN_SPLIT = 6;
