"use client";

import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { getMarketRadarReasonLabel, type MarketRadarReasonKey } from "@/lib/domain/market-radar-config";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import { formatVolXCompact, resolveStockVolumeRatio } from "@/lib/domain/stock-volume-ratio";
import { buildVolumeRatioTooltip } from "@/lib/domain/baseline-info";
import { formatRadarTrades } from "@/lib/domain/market-radar-selectors";
import { CopyTickerBadge } from "@/components/screener/copy-ticker-badge";
import { RadarRowTooltip, type RadarTooltipBlock } from "@/components/screener/radar-row-tooltip";
import { useRadarRowSparkline, useRadarSparklineContext } from "@/components/screener/radar-sparkline-context";
import { percentClass, useRadarRowHover } from "@/components/screener/radar-row-primitives";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

export function formatRadarTradesK(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—";
  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000)}m`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return k >= 100
      ? `${Math.round(k)}k`
      : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(k)}k`;
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

function MicroLhBar({ row }: { row: ScreenerRow }) {
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  if (position == null) return <span className="w-3 shrink-0" aria-hidden />;

  return (
    <span
      className="relative h-1 w-3 shrink-0 overflow-hidden rounded-full bg-white/[0.06]"
      title="Позиция в дневном диапазоне"
      aria-hidden
    >
      <span
        className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-cyan-400/80"
        style={{ left: `calc(${Math.round(position * 100)}% - 2px)` }}
      />
    </span>
  );
}

function VolXCell({ row, compact }: { row: ScreenerRow; compact?: boolean }) {
  const vol = resolveStockVolumeRatio(row);
  const tooltip = buildVolumeRatioTooltip(row);
  const label = vol != null ? formatVolXCompact(vol) : "—";
  const title = [tooltip.title, ...tooltip.lines].join("\n");

  return (
    <span
      className={cn(
        "shrink-0 font-mono tabular-nums",
        compact ? "w-[1.65rem] text-[8px]" : "w-[1.85rem] text-[8px]",
        vol != null ? "text-violet-300/90" : "text-slate-600",
      )}
      title={title}
    >
      {label}
    </span>
  );
}

export type RadarTradingRowVariant = "liquidity" | "active" | "inplay" | "shots";

const VARIANT_ROW_CLASS: Record<RadarTradingRowVariant, string> = {
  liquidity: "hover:bg-white/[0.03]",
  active: "hover:bg-cyan-950/20 border-b border-white/[0.03]",
  inplay:
    "border-l-2 border-emerald-400/50 bg-gradient-to-r from-emerald-950/40 via-violet-950/10 to-transparent shadow-[inset_0_0_12px_rgba(16,185,129,0.06)] hover:from-emerald-950/50",
  shots: "border-l border-amber-500/30 bg-amber-950/10 hover:bg-amber-950/18",
};

const SHOTS_REASON_ACCENT: Partial<Record<MarketRadarReasonKey, string>> = {
  breakoutHigh: "text-amber-300/95",
  breakoutLow: "text-rose-300/95",
  impulseUp: "text-emerald-300/90",
  impulseDown: "text-rose-300/90",
  wideRange: "text-amber-200/85",
};

export function RadarTradingRow({
  row,
  variant,
  reasonKey,
  onTickerSelect,
  selected,
  tooltipsEnabled = true,
  alsoInPlay,
  score,
  showVolX = true,
  showMicroBar = true,
  showReason = true,
  dense = false,
}: {
  row: ScreenerRow;
  variant: RadarTradingRowVariant;
  reasonKey: MarketRadarReasonKey;
  onTickerSelect?: (ticker: string) => void;
  selected?: boolean;
  tooltipsEnabled?: boolean;
  alsoInPlay?: boolean;
  score?: number;
  showVolX?: boolean;
  showMicroBar?: boolean;
  showReason?: boolean;
  dense?: boolean;
}) {
  const { rowRef, hovered, anchorRect, onMouseEnter, onMouseLeave } = useRadarRowHover();
  const { setHoveredTicker } = useRadarSparklineContext();
  const sparklineDisabled = !tooltipsEnabled || variant === "liquidity";
  const { series, isLoading: sparklineLoading } = useRadarRowSparkline(
    row.ticker,
    sparklineDisabled,
  );

  const handleEnter = React.useCallback(() => {
    setHoveredTicker(row.ticker.toUpperCase());
    onMouseEnter();
  }, [onMouseEnter, row.ticker, setHoveredTicker]);

  const handleLeave = React.useCallback(() => {
    setHoveredTicker(null);
    onMouseLeave();
  }, [onMouseLeave, setHoveredTicker]);

  const reasonLabel = getMarketRadarReasonLabel(reasonKey);
  const turnoverLabel = formatTurnoverCompact(row.turnover);
  const tradesLabel = variant === "active" ? formatRadarTrades(row) : formatRadarTradesK(row.tradesCount);
  const numClass = dense
    ? "font-mono text-[10px] font-medium tabular-nums leading-none"
    : "font-mono text-[10px] font-semibold tabular-nums leading-none";

  const tooltipBlock: RadarTooltipBlock =
    variant === "inplay" ? "inplay" : variant === "shots" ? "shots" : "active";

  const rowClass = cn(
    "group flex w-full min-w-0 items-center gap-1 rounded-sm px-0.5 py-[2px] text-left transition-colors",
    VARIANT_ROW_CLASS[variant],
    selected && "ring-1 ring-inset ring-cyan-500/25 bg-cyan-500/[0.06]",
  );

  return (
    <>
      <div
        ref={rowRef}
        role={onTickerSelect ? "button" : undefined}
        tabIndex={onTickerSelect ? 0 : undefined}
        className={rowClass}
        onClick={onTickerSelect ? () => onTickerSelect(row.ticker) : undefined}
        onKeyDown={
          onTickerSelect
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onTickerSelect(row.ticker);
                }
              }
            : undefined
        }
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        aria-pressed={onTickerSelect ? selected : undefined}
      >
        <CopyTickerBadge
          ticker={row.ticker}
          size="compact"
          className={cn(
            "shrink-0",
            variant === "active" ? "w-[2.5rem] text-[10px] font-bold" : "w-[2.35rem]",
          )}
        />
        {alsoInPlay ? (
          <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-950/40 px-0.5 text-[6px] font-semibold uppercase tracking-wide text-emerald-300/90">
            в игре
          </span>
        ) : null}
        <span className={cn(numClass, "w-[2.55rem] shrink-0", percentClass(row.percentChange))}>
          {tradingFormat.formatSignedPercent(row.percentChange)}
        </span>
        {score != null ? (
          <span
            className="w-[1.2rem] shrink-0 text-center font-mono text-[9px] font-bold tabular-nums text-emerald-200/90"
            title="inPlay score"
          >
            {score}
          </span>
        ) : null}
        <span
          className={cn(
            numClass,
            "min-w-0 flex-1 truncate text-right",
            variant === "active" ? "text-cyan-100/90" : "text-slate-300/85",
          )}
        >
          {turnoverLabel}
        </span>
        <span className="w-[2rem] shrink-0 truncate text-right font-mono text-[9px] tabular-nums text-slate-500">
          {tradesLabel}
        </span>
        {showVolX ? <VolXCell row={row} compact={dense} /> : null}
        {showMicroBar ? <MicroLhBar row={row} /> : null}
        {showReason ? (
          <span
            className={cn(
              "max-w-[3.25rem] shrink-0 truncate text-right text-[7.5px] font-medium leading-none",
              variant === "shots"
                ? (SHOTS_REASON_ACCENT[reasonKey] ?? "text-amber-200/70")
                : variant === "active"
                  ? "text-cyan-400/75"
                  : "text-emerald-200/75",
            )}
            title={reasonLabel}
          >
            {reasonLabel}
          </span>
        ) : null}
      </div>
      {tooltipsEnabled ? (
        <RadarRowTooltip
          row={row}
          series={series}
          sparklineLoading={sparklineLoading}
          anchorRect={anchorRect}
          visible={hovered}
          block={tooltipBlock}
          reasonKey={reasonKey}
          alsoInPlay={alsoInPlay}
          onTooltipEnter={handleEnter}
          onTooltipLeave={handleLeave}
        />
      ) : null}
    </>
  );
}
