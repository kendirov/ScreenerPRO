"use client";

import * as React from "react";
import type { ScreenerDataStatus, ScreenerRow } from "@screenerpro/shared";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import {
  MARKET_RADAR_CONFIG,
  getMarketRadarReasonLabel,
  type MarketRadarReasonKey,
} from "@/lib/domain/market-radar-config";
import {
  formatRadarTrades,
  resolveInPlayRadarReasonKey,
  resolveVolatilityRadarReasonKey,
  rowHasHistoricalBaseline,
  selectInPlayInstruments,
  selectLiquidityLeaders,
  selectVolatileInstruments,
} from "@/lib/domain/market-radar-selectors";
import { tradingFormat } from "@/lib/formatters/trading";
import { ScreenerDateModeMessages, historicalFeatureMessage } from "@/lib/domain/screener-date-mode";
import { cn } from "@/lib/utils/cn";

const LAYOUT = MARKET_RADAR_CONFIG.layout;

type RadarTone = "liquidity" | "inplay" | "volatility";

const COLUMN_CLASS: Record<RadarTone, string> = {
  liquidity: "market-radar-column--liquidity",
  inplay: "market-radar-column--inplay",
  volatility: "market-radar-column--volatility",
};

const TITLE_CLASS: Record<RadarTone, string> = {
  liquidity: "text-cyan-300/90",
  inplay: "text-emerald-300/90",
  volatility: "text-amber-300/90",
};

const STAT_CLASS: Record<RadarTone, string> = {
  liquidity: "text-cyan-400/75",
  inplay: "text-emerald-400/75",
  volatility: "text-amber-400/75",
};

const ROW_HOVER: Record<RadarTone, string> = {
  liquidity: "hover:bg-white/[0.03]",
  inplay: "hover:bg-white/[0.03]",
  volatility: "hover:bg-white/[0.03]",
};

const REASON_BADGE_CLASS: Record<MarketRadarReasonKey, string> = {
  liquidity: "border-cyan-500/20 bg-cyan-950/25 text-cyan-200/80",
  highTurnover: "border-emerald-500/20 bg-emerald-950/25 text-emerald-200/80",
  manyTrades: "border-emerald-500/18 bg-emerald-950/22 text-emerald-200/75",
  wideRange: "border-violet-500/20 bg-violet-950/25 text-violet-200/80",
  nearHigh: "border-cyan-500/20 bg-cyan-950/25 text-cyan-200/80",
  nearLow: "border-rose-500/20 bg-rose-950/25 text-rose-200/80",
  breakoutHigh: "border-violet-500/22 bg-violet-950/28 text-violet-100/90",
  breakoutLow: "border-rose-500/22 bg-rose-950/28 text-rose-100/90",
  strongMove: "border-rose-500/20 bg-rose-950/22 text-rose-200/80",
  illiquidRisk: "border-rose-500/22 bg-rose-950/28 text-rose-200/85",
};

function percentClass(value: number | null): string {
  if ((value ?? 0) > 0) return "text-emerald-400";
  if ((value ?? 0) < 0) return "text-rose-400";
  return "text-slate-500";
}

function scrollAreaMaxHeightPx(itemCount: number, scrollWhenAbove: number): number | undefined {
  if (itemCount <= scrollWhenAbove) return undefined;
  return LAYOUT.visibleRowsInScroll * LAYOUT.rowHeightPx;
}

function RadarStat({ label, value, tone }: { label: string; value: string; tone: RadarTone }) {
  return (
    <span className={cn("font-mono text-[9px] tabular-nums", STAT_CLASS[tone])}>
      <span className="text-slate-600">{label} </span>
      {value}
    </span>
  );
}

function RadarBadge({ reasonKey }: { reasonKey: MarketRadarReasonKey }) {
  const label = getMarketRadarReasonLabel(reasonKey);
  return (
    <span
      title={label}
      className={cn(
        "max-w-[4.75rem] shrink-0 truncate rounded px-1 py-px text-[6.5px] font-medium leading-none text-slate-300/90",
        REASON_BADGE_CLASS[reasonKey],
      )}
    >
      {label}
    </span>
  );
}

function RadarSectionHead({
  title,
  count,
  tone,
}: {
  title: string;
  count?: number;
  tone: RadarTone;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-1 border-b border-white/[0.05] px-1 py-0.5">
      <p className={cn("truncate text-[9px] font-medium uppercase tracking-[0.12em]", TITLE_CLASS[tone])}>
        {title}
      </p>
      {count != null && count > 0 ? (
        <span className="font-mono text-[9px] tabular-nums text-slate-500">{count}</span>
      ) : null}
    </div>
  );
}

function RadarListBody({
  itemCount,
  scrollWhenAbove,
  emptyText,
  historicalUnavailable,
  children,
}: {
  itemCount: number;
  scrollWhenAbove: number;
  emptyText: string;
  historicalUnavailable?: boolean;
  children: React.ReactNode;
}) {
  if (itemCount === 0) {
    return (
      <p className="px-1 py-2 text-center text-[9px] leading-snug text-slate-600">
        {historicalUnavailable ? ScreenerDateModeMessages.historicalBlockNotConnected : emptyText}
      </p>
    );
  }

  const maxHeight = scrollAreaMaxHeightPx(itemCount, scrollWhenAbove);
  const needsScroll = maxHeight != null;

  return (
    <div
      className={cn("min-h-0 px-0.5 py-px", needsScroll && "market-radar-scroll overflow-y-auto overscroll-contain")}
      style={maxHeight != null ? { maxHeight } : undefined}
    >
      {children}
    </div>
  );
}

function RadarColumn({
  tone,
  title,
  itemCount,
  scrollWhenAbove,
  emptyText,
  historicalUnavailable,
  children,
}: {
  tone: RadarTone;
  title: string;
  itemCount: number;
  scrollWhenAbove: number;
  emptyText: string;
  historicalUnavailable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("market-radar-column flex min-h-0 flex-col overflow-hidden rounded-md", COLUMN_CLASS[tone])}>
      <RadarSectionHead title={title} count={itemCount} tone={tone} />
      <div className="min-h-0 flex-1">
        <RadarListBody
          itemCount={itemCount}
          scrollWhenAbove={scrollWhenAbove}
          emptyText={emptyText}
          historicalUnavailable={historicalUnavailable}
        >
          {children}
        </RadarListBody>
      </div>
    </div>
  );
}

function RadarRowShell({
  tone,
  ticker,
  selected,
  onTickerSelect,
  children,
}: {
  tone: RadarTone;
  ticker: string;
  selected?: boolean;
  onTickerSelect?: (ticker: string) => void;
  children: React.ReactNode;
}) {
  const rowClass = cn(
    "flex w-full items-center gap-0.5 rounded px-0.5 py-px text-left transition-colors duration-100",
    ROW_HOVER[tone],
    selected && "bg-cyan-500/[0.08] ring-1 ring-inset ring-cyan-500/20",
  );

  if (!onTickerSelect) {
    return <li className={rowClass}>{children}</li>;
  }

  return (
    <li>
      <button type="button" className={rowClass} onClick={() => onTickerSelect(ticker)} aria-pressed={selected}>
        {children}
      </button>
    </li>
  );
}

const TICKER_CLASS = "w-[2.5rem] shrink-0 truncate text-[10px] font-semibold tracking-wide text-slate-200";
const NUM_CLASS = "shrink-0 font-mono text-[10px] font-medium tabular-nums leading-none";

function LiquidityRow({
  row,
  rank,
  onTickerSelect,
  selected,
}: {
  row: ScreenerRow;
  rank: number;
  onTickerSelect?: (ticker: string) => void;
  selected?: boolean;
}) {
  const trades = formatRadarTrades(row);
  return (
    <RadarRowShell tone="liquidity" ticker={row.ticker} selected={selected} onTickerSelect={onTickerSelect}>
      <span className="w-3 shrink-0 font-mono text-[8px] tabular-nums text-slate-600">{rank}</span>
      <span className={TICKER_CLASS}>{row.ticker}</span>
      <span className={cn(NUM_CLASS, "w-[2.6rem]", percentClass(row.percentChange))}>
        {tradingFormat.formatSignedPercent(row.percentChange)}
      </span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[9px] tabular-nums text-slate-500">
        {formatTurnoverCompact(row.turnover)}
        <span className="text-slate-700">·</span>
        {trades}
      </span>
    </RadarRowShell>
  );
}

function InPlayRow({
  row,
  onTickerSelect,
  selected,
}: {
  row: ScreenerRow;
  onTickerSelect?: (ticker: string) => void;
  selected?: boolean;
}) {
  const reasonKey = resolveInPlayRadarReasonKey(row);
  const score = row.metrics.inPlayScore;
  const scoreLabel = score != null && Number.isFinite(score) ? Math.round(score) : "—";

  return (
    <RadarRowShell tone="inplay" ticker={row.ticker} selected={selected} onTickerSelect={onTickerSelect}>
      <span className={TICKER_CLASS}>{row.ticker}</span>
      <span className={cn(NUM_CLASS, "w-5 text-emerald-400/85")}>{scoreLabel}</span>
      <span className={cn(NUM_CLASS, "w-[2.6rem]", percentClass(row.percentChange))}>
        {tradingFormat.formatSignedPercent(row.percentChange)}
      </span>
      <RadarBadge reasonKey={reasonKey} />
    </RadarRowShell>
  );
}

function VolatilityRow({
  row,
  onTickerSelect,
  selected,
}: {
  row: ScreenerRow;
  onTickerSelect?: (ticker: string) => void;
  selected?: boolean;
}) {
  const reasonKey = resolveVolatilityRadarReasonKey(row);
  const range = row.metrics.dayRangePct;

  return (
    <RadarRowShell tone="volatility" ticker={row.ticker} selected={selected} onTickerSelect={onTickerSelect}>
      <span className={TICKER_CLASS}>{row.ticker}</span>
      <span className={cn(NUM_CLASS, "w-[2.2rem] text-amber-300/85")}>
        {range != null ? tradingFormat.formatDayRangeMagnitude(range) : "—"}
      </span>
      <span className={cn(NUM_CLASS, "w-[2.6rem]", percentClass(row.percentChange))}>
        {tradingFormat.formatSignedPercent(row.percentChange)}
      </span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[9px] tabular-nums text-slate-600">
        {formatTurnoverCompact(row.turnover)}
      </span>
      <RadarBadge reasonKey={reasonKey} />
    </RadarRowShell>
  );
}

export function MarketRadar({
  rows,
  allRows,
  dataStatus,
  selectedTicker,
  onTickerSelect,
}: {
  rows: ScreenerRow[];
  allRows?: ScreenerRow[];
  imoexRangePct?: number | null;
  dataStatus?: ScreenerDataStatus | null;
  candlesByTicker?: unknown;
  selectedTicker?: string | null;
  onTickerSelect?: (ticker: string) => void;
}) {
  const stockRows = rows.filter((row) => row.assetClass === "stock");
  const stockUniverse = (allRows ?? rows).filter((row) => row.assetClass === "stock");
  const isHistorical = dataStatus?.dataMode === "historical";

  const maxTurnover = React.useMemo(
    () => stockUniverse.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0),
    [stockUniverse],
  );

  const radarRows = isHistorical ? stockUniverse : stockRows;

  const liquidity = React.useMemo(() => selectLiquidityLeaders(stockUniverse), [stockUniverse]);
  const inPlay = React.useMemo(() => selectInPlayInstruments(radarRows), [radarRows]);
  const volatile = React.useMemo(
    () => selectVolatileInstruments(radarRows, maxTurnover),
    [radarRows, maxTurnover],
  );

  const liquidityHistUnavailable = isHistorical && historicalFeatureMessage("liquidity") != null;
  const inPlayHistUnavailable = isHistorical && historicalFeatureMessage("inPlay") != null;
  const volatilityHistUnavailable = isHistorical && historicalFeatureMessage("volatility") != null;

  const handleTickerSelect = React.useCallback(
    (ticker: string) => {
      onTickerSelect?.(ticker);
    },
    [onTickerSelect],
  );

  const isSelected = React.useCallback(
    (ticker: string) => selectedTicker != null && selectedTicker === ticker,
    [selectedTicker],
  );

  const baselineMissing = React.useMemo(() => {
    if (isHistorical) return false;
    if (dataStatus?.baselineStatus === "skipped" || dataStatus?.baselineStatus === "error") return true;
    if (dataStatus?.degraded) return true;
    if (stockUniverse.length === 0) return false;
    const withBaseline = stockUniverse.filter(rowHasHistoricalBaseline).length;
    return withBaseline < stockUniverse.length * 0.25;
  }, [dataStatus, isHistorical, stockUniverse]);

  return (
    <section
      className="market-radar flex flex-col overflow-hidden rounded-lg"
      style={{
        height: LAYOUT.maxHeightPx,
        minHeight: LAYOUT.minHeightPx,
        maxHeight: LAYOUT.maxHeightPx,
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.05] px-1 py-0.5">
        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">Радар</span>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0">
          <RadarStat label="Liq" value="5" tone="liquidity" />
          <RadarStat label="Play" value={String(inPlay.length)} tone="inplay" />
          <RadarStat label="Vol" value={String(volatile.length)} tone="volatility" />
          {isHistorical ? (
            <span className="text-[8px] text-violet-400/80" title="Исторический срез MOEX ISS">
              {ScreenerDateModeMessages.historicalRadarSlice}
            </span>
          ) : baselineMissing ? (
            <span
              className="text-[8px] text-amber-500/80"
              title="Сравнение с прошлыми сессиями недоступно"
            >
              ∅ baseline
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-1 p-1">
        <RadarColumn
          tone="liquidity"
          title="Где ликвидность"
          itemCount={liquidity.length}
          scrollWhenAbove={Number.POSITIVE_INFINITY}
          emptyText="Нет оборота за день"
          historicalUnavailable={liquidityHistUnavailable}
        >
          <ul className="space-y-0">
            {liquidity.map((row, index) => (
              <LiquidityRow
                key={row.ticker}
                row={row}
                rank={index + 1}
                onTickerSelect={onTickerSelect ? handleTickerSelect : undefined}
                selected={isSelected(row.ticker)}
              />
            ))}
          </ul>
        </RadarColumn>

        <RadarColumn
          tone="inplay"
          title="Кто в игре"
          itemCount={inPlay.length}
          scrollWhenAbove={LAYOUT.scrollAfterCount}
          emptyText="Нет инструментов выше порога"
          historicalUnavailable={inPlayHistUnavailable}
        >
          <ul className="space-y-0">
            {inPlay.map((row) => (
              <InPlayRow
                key={row.ticker}
                row={row}
                onTickerSelect={onTickerSelect ? handleTickerSelect : undefined}
                selected={isSelected(row.ticker)}
              />
            ))}
          </ul>
        </RadarColumn>

        <RadarColumn
          tone="volatility"
          title="Где волатильность"
          itemCount={volatile.length}
          scrollWhenAbove={LAYOUT.scrollAfterCount}
          emptyText="Нет повышенной волатильности"
          historicalUnavailable={volatilityHistUnavailable}
        >
          <ul className="space-y-0">
            {volatile.map((row) => (
              <VolatilityRow
                key={row.ticker}
                row={row}
                onTickerSelect={onTickerSelect ? handleTickerSelect : undefined}
                selected={isSelected(row.ticker)}
              />
            ))}
          </ul>
        </RadarColumn>
      </div>
    </section>
  );
}
