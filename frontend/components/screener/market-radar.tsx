"use client";

import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import { StockMiniSparkline } from "@/components/screener/stocks/stock-mini-sparkline";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  MetricTooltipPanel,
  MetricTooltipRow,
  StatusChip,
} from "@/components/ui/metrics-minimalism";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import {
  computePositionInRange,
  formatSparklineSourceLabel,
  labelRangePosition,
  type StockSparklineSeries,
} from "@/lib/domain/stock-sparkline";
import {
  buildInPlayInclusionReason,
  buildInPlaySurfaceChips,
  buildStockImpulseSignals,
  formatRelativeTurnoverLabel,
  formatTradesCompact,
  getMoneyRowStatus,
  selectInPlayForRadar,
  selectMoneyLeaders,
  type StockImpulseSignal,
} from "@/lib/domain/stocks-screener-signals";
import { getStockTableStatus, STOCK_DAY_RANGE_COLUMN_LABEL } from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

interface CandleSeriesLookup {
  get: (ticker: string) => StockSparklineSeries | null | undefined;
}

function RadarTooltip({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipContent
      side="bottom"
      className="max-w-[14rem] border-lab-border bg-lab-bg-deep/95 p-0 text-lab-text-main shadow-[0_8px_24px_rgba(2,6,23,0.45)]"
    >
      <MetricTooltipPanel title={title}>{children}</MetricTooltipPanel>
    </TooltipContent>
  );
}

function percentClass(value: number | null): string {
  if ((value ?? 0) > 0) return "text-lab-green";
  if ((value ?? 0) < 0) return "text-lab-red";
  return "text-lab-text-dim";
}

function formatMoneyRowStatus(status: ReturnType<typeof getMoneyRowStatus>): string {
  if (status === "ликвид") return "Ликвидность";
  if (status === "в игре") return "В игре";
  return "Лидер оборота";
}

function RadarSectionHead({
  title,
  subtitle,
  tone,
}: {
  title: string;
  subtitle?: string;
  tone: "money" | "inplay" | "impulse";
}) {
  const toneDot = {
    money: "bg-lab-green shadow-[0_0_6px_rgba(52,211,153,0.28)]",
    inplay: "bg-lab-cyan shadow-[0_0_6px_rgba(34,211,238,0.25)]",
    impulse: "bg-lab-amber shadow-[0_0_6px_rgba(251,191,36,0.25)]",
  }[tone];

  const toneTitle = {
    money: "text-emerald-100/95",
    inplay: "text-cyan-100/95",
    impulse: "text-amber-100/95",
  }[tone];

  return (
    <div className="mb-1 flex items-start justify-between gap-2 px-0.5">
      <div className="min-w-0">
        <p className={cn("text-[11px] font-medium uppercase tracking-[0.16em]", toneTitle)}>{title}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[9px] normal-case tracking-normal text-lab-text-dim">{subtitle}</p>
        ) : null}
      </div>
      <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full", toneDot)} />
    </div>
  );
}

function LiquidityBlock({
  rows,
  maxTurnover,
}: {
  rows: ScreenerRow[];
  maxTurnover: number;
}) {
  const leaders = selectMoneyLeaders(rows, 5);

  return (
    <LabGlassPanel depth={10} className="p-1.5">
      <RadarSectionHead title="Ликвидность" subtitle="Топ по обороту и сделкам" tone="money" />
      {leaders.length ? (
        <ul className="space-y-0.5">
          {leaders.map((row, index) => {
            const tradesLabel = formatTradesCompact(row.tradesCount);
            const status = getMoneyRowStatus(row, maxTurnover);
            const isLeader = index === 0;

            return (
              <Tooltip key={row.ticker} delayDuration={450}>
                <TooltipTrigger asChild>
                  <li
                    className={cn(
                      "flex cursor-default items-baseline gap-1.5 rounded-md px-1 py-0.5 transition hover:bg-white/[0.03]",
                      isLeader && "bg-emerald-950/12",
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 shrink-0 font-mono text-[10px] tabular-nums",
                        isLeader ? "text-lab-green" : "text-lab-green/70",
                      )}
                    >
                      #{index + 1}
                    </span>
                    <span className="w-11 shrink-0 font-semibold tracking-wide text-lab-text-main">{row.ticker}</span>
                    <span className={cn("min-w-[3.5rem] font-mono text-[11px] tabular-nums", percentClass(row.percentChange))}>
                      {tradingFormat.formatSignedPercent(row.percentChange)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-right font-mono text-[10px] tabular-nums text-lab-text-dim">
                      {formatTurnoverCompact(row.turnover)}
                      {tradesLabel ? ` · ${tradesLabel}` : null}
                    </span>
                  </li>
                </TooltipTrigger>
                <RadarTooltip title={row.ticker}>
                  <MetricTooltipRow label="Цена" value={tradingFormat.formatDynamicPrice(row.lastPrice)} />
                  <MetricTooltipRow label="Оборот" value={tradingFormat.formatTurnoverRub(row.turnover)} />
                  <MetricTooltipRow
                    label="Сделки"
                    value={
                      row.tradesCount != null && row.tradesCount > 0
                        ? tradingFormat.formatInteger(row.tradesCount)
                        : "сделки недоступны"
                    }
                  />
                  <MetricTooltipRow
                    label={STOCK_DAY_RANGE_COLUMN_LABEL}
                    value={
                      row.metrics.dayRangePct != null
                        ? tradingFormat.formatDayRangeMagnitude(row.metrics.dayRangePct)
                        : null
                    }
                  />
                  <MetricTooltipRow label="Статус" value={formatMoneyRowStatus(status)} />
                </RadarTooltip>
              </Tooltip>
            );
          })}
        </ul>
      ) : (
        <p className="py-1.5 text-center text-[11px] leading-snug text-lab-text-dim">
          Нет данных по обороту — дождитесь обновления MOEX
        </p>
      )}
    </LabGlassPanel>
  );
}

function InPlayCard({
  row,
  candlesByTicker,
  size,
}: {
  row: ScreenerRow;
  candlesByTicker: CandleSeriesLookup;
  size: "large" | "compact";
}) {
  const series = candlesByTicker.get(row.ticker);
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  const chips = buildInPlaySurfaceChips(row, position);
  const positionLabel = labelRangePosition(position);
  const candleLabel = formatSparklineSourceLabel(series);
  const inclusionReason = buildInPlayInclusionReason(row);

  return (
    <Tooltip delayDuration={450}>
      <TooltipTrigger asChild>
        <article
          className={cn(
            "flex flex-col gap-1 rounded-md bg-black/10 transition hover:bg-cyan-950/10",
            size === "large" ? "p-2" : "p-1.5",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("font-semibold tracking-wide text-lab-text-main", size === "large" ? "text-sm" : "text-xs")}>
                {row.ticker}
              </p>
              <p className={cn("lab-number font-mono tabular-nums", size === "large" ? "text-sm" : "text-[11px]", percentClass(row.percentChange))}>
                {tradingFormat.formatSignedPercent(row.percentChange)}
              </p>
            </div>
            <StockMiniSparkline
              series={series}
              dayHigh={row.high}
              dayLow={row.low}
              changePct={row.percentChange}
              size={size}
            />
          </div>
          {chips.length ? (
            <p className="truncate text-[9px] leading-snug text-lab-text-dim">
              {chips.map((chip, index) => (
                <React.Fragment key={chip}>
                  {index > 0 ? <span className="text-lab-text-dim/50"> · </span> : null}
                  <span className="font-mono tabular-nums">{chip}</span>
                </React.Fragment>
              ))}
            </p>
          ) : null}
        </article>
      </TooltipTrigger>
      <RadarTooltip title={row.ticker}>
        <MetricTooltipRow label="Цена" value={tradingFormat.formatDynamicPrice(row.lastPrice)} />
        <MetricTooltipRow label="Оборот" value={tradingFormat.formatTurnoverRub(row.turnover)} />
        <MetricTooltipRow
          label="Сделки"
          value={row.tradesCount != null && row.tradesCount > 0 ? tradingFormat.formatInteger(row.tradesCount) : null}
        />
        <MetricTooltipRow
          label={STOCK_DAY_RANGE_COLUMN_LABEL}
          value={
            row.metrics.dayRangePct != null ? tradingFormat.formatDayRangeMagnitude(row.metrics.dayRangePct) : null
          }
        />
        <MetricTooltipRow label="Положение" value={positionLabel} />
        <MetricTooltipRow
          label="Свечи"
          value={candleLabel ?? (series?.status === "no-data" ? "история недоступна" : null)}
        />
        <MetricTooltipRow label="Попадание" value={inclusionReason} />
      </RadarTooltip>
    </Tooltip>
  );
}

function InPlayBlock({
  rows,
  candlesByTicker,
}: {
  rows: ScreenerRow[];
  candlesByTicker: CandleSeriesLookup;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const inPlay = selectInPlayForRadar(rows);
  const visibleCount = inPlay.length <= 6 || expanded ? inPlay.length : 6;
  const visible = inPlay.slice(0, visibleCount);
  const hiddenCount = Math.max(0, inPlay.length - 6);

  const layout =
    inPlay.length === 0
      ? "empty"
      : inPlay.length <= 3
        ? "large"
        : inPlay.length <= 6
          ? "grid"
          : "grid-more";

  return (
    <LabGlassPanel depth={10} className="p-1.5">
      <RadarSectionHead title="В игре" subtitle="2–3 признака активности" tone="inplay" />
      {layout === "empty" ? (
        <p className="py-2 text-center text-[11px] leading-snug text-lab-text-dim">
          Активных бумаг нет — ждём рост оборота или сделок
        </p>
      ) : layout === "large" ? (
        <div className="space-y-1.5">
          {visible.map((row) => (
            <InPlayCard key={row.ticker} row={row} candlesByTicker={candlesByTicker} size="large" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {visible.map((row) => (
              <InPlayCard key={row.ticker} row={row} candlesByTicker={candlesByTicker} size="compact" />
            ))}
          </div>
          {hiddenCount > 0 && !expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1.5 w-full rounded-md border border-lab-border-soft/50 py-1 text-[10px] uppercase tracking-wide text-lab-cyan transition hover:border-lab-cyan/30 hover:bg-lab-cyan/[0.06]"
            >
              ещё {hiddenCount}
            </button>
          ) : null}
        </>
      )}
    </LabGlassPanel>
  );
}

function ImpulseRow({
  rank,
  signal,
  row,
  maxTurnover,
}: {
  rank: number;
  signal: StockImpulseSignal;
  row: ScreenerRow | undefined;
  maxTurnover: number;
}) {
  const relativeLabel = formatRelativeTurnoverLabel(signal.relativeTurnover);

  return (
    <Tooltip delayDuration={450}>
      <TooltipTrigger asChild>
        <li className="flex cursor-default items-baseline gap-1 rounded-md px-1 py-0.5 transition hover:bg-amber-950/12">
          <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-lab-amber/70">#{rank}</span>
          <span className="w-11 shrink-0 font-semibold tracking-wide text-lab-text-main">{signal.ticker}</span>
          <span className={cn("min-w-[3.5rem] font-mono text-[11px] tabular-nums", percentClass(signal.changePct))}>
            {tradingFormat.formatSignedPercent(signal.changePct)}
          </span>
          <span className="min-w-0 flex-1 truncate text-right text-[10px] text-lab-text-dim">
            {signal.eventLabel ? (
              <StatusChip
                label={signal.eventLabel}
                tone="amber"
                className="mr-1 inline-flex align-baseline text-[8px] uppercase tracking-wide"
              />
            ) : null}
            {signal.rangePct != null ? (
              <span className="font-mono tabular-nums">
                {signal.eventLabel ? <span className="text-lab-text-dim/50"> · </span> : null}
                диап. {tradingFormat.formatDayRangeMagnitude(signal.rangePct)}
              </span>
            ) : !signal.eventLabel ? (
              <span className="truncate">{signal.eventReason}</span>
            ) : null}
          </span>
        </li>
      </TooltipTrigger>
      <RadarTooltip title={signal.ticker}>
        <MetricTooltipRow label="Оборот" value={tradingFormat.formatTurnoverRub(signal.turnover)} />
        <MetricTooltipRow
          label="Сделки"
          value={signal.trades != null && signal.trades > 0 ? tradingFormat.formatInteger(signal.trades) : null}
        />
        <MetricTooltipRow
          label={STOCK_DAY_RANGE_COLUMN_LABEL}
          value={signal.rangePct != null ? tradingFormat.formatDayRangeMagnitude(signal.rangePct) : null}
        />
        <MetricTooltipRow
          label="Сила события"
          value={new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(signal.impulseScore)}
        />
        <MetricTooltipRow label="Событие" value={signal.eventReason} />
        <MetricTooltipRow label="От «В игре»" value={signal.differsFromInPlay} />
        <MetricTooltipRow
          label="К вчера"
          value={relativeLabel ?? (signal.dataStatus === "no-yesterday" ? "нет сравнения со вчера" : null)}
        />
        {row ? <MetricTooltipRow label="Статус" value={getStockTableStatus(row, maxTurnover)} /> : null}
      </RadarTooltip>
    </Tooltip>
  );
}

function ImpulseBlock({
  rows,
  rowByTicker,
  maxTurnover,
}: {
  rows: ScreenerRow[];
  rowByTicker: Map<string, ScreenerRow>;
  maxTurnover: number;
}) {
  const signals = buildStockImpulseSignals(rows, 5);

  return (
    <LabGlassPanel depth={10} className="p-1.5">
      <RadarSectionHead title="Импульс" subtitle="События ускорения и пробоя" tone="impulse" />
      {signals.length ? (
        <ul className="space-y-0.5">
          {signals.map((signal, index) => (
            <ImpulseRow
              key={signal.ticker}
              rank={index + 1}
              signal={signal}
              row={rowByTicker.get(signal.ticker)}
              maxTurnover={maxTurnover}
            />
          ))}
        </ul>
      ) : (
        <p className="py-1.5 text-center text-[11px] leading-snug text-lab-text-dim">
          Нет событий — ждём пробой или ускорение
        </p>
      )}
    </LabGlassPanel>
  );
}

export function MarketRadar({
  rows,
  allRows,
  candlesByTicker,
}: {
  rows: ScreenerRow[];
  allRows?: ScreenerRow[];
  imoexRangePct?: number | null;
  candlesByTicker?: CandleSeriesLookup;
}) {
  const stockRows = rows.filter((row) => row.assetClass === "stock");
  const stockUniverse = (allRows ?? rows).filter((row) => row.assetClass === "stock");

  const maxTurnover = React.useMemo(
    () => stockUniverse.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0),
    [stockUniverse],
  );

  const rowByTicker = React.useMemo(() => {
    const map = new Map<string, ScreenerRow>();
    for (const row of stockRows) map.set(row.ticker, row);
    return map;
  }, [stockRows]);

  const candleLookup = React.useMemo<CandleSeriesLookup>(
    () => ({
      get: (ticker: string) =>
        candlesByTicker?.get(ticker.toUpperCase()) ?? candlesByTicker?.get(ticker) ?? null,
    }),
    [candlesByTicker],
  );

  return (
    <section className="space-y-1 rounded-xl border border-lab-border/30 bg-lab-bg-deep/35 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.015)] backdrop-blur-md">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-lab-text-dim">Радар рынка</p>
      </div>
      <div className="grid gap-1 lg:grid-cols-3">
        <LiquidityBlock rows={stockUniverse} maxTurnover={maxTurnover} />
        <InPlayBlock rows={stockRows} candlesByTicker={candleLookup} />
        <ImpulseBlock rows={stockRows} rowByTicker={rowByTicker} maxTurnover={maxTurnover} />
      </div>
    </section>
  );
}
