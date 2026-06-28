"use client";

import type { ScreenerBenchmark } from "@screenerpro/shared";
import { DayRangeBar } from "@/components/screener/stocks/day-range-bar";
import { MarketBreadthMini } from "@/components/screener/stocks/market-breadth-mini";
import {
  formatIndex,
  formatPct,
  formatRangePct,
  formatRubTurnover,
  formatTrades,
  formatDayPositionLabel,
} from "@/lib/screener/formatters";
import { metricChangeClass, metricColors } from "@/lib/screener/metric-styles";
import type { StocksMarketSummary } from "@/lib/screener/stocks-radar";
import { cn } from "@/lib/utils/cn";

function pickBenchmark(benchmarks: ScreenerBenchmark[] | undefined): ScreenerBenchmark | null {
  if (!benchmarks?.length) return null;
  return benchmarks.find((b) => b.code === "IMOEX2") ?? benchmarks.find((b) => b.code === "IMOEX") ?? benchmarks[0] ?? null;
}

function MarketStatLine({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5 font-mono text-[9px] tabular-nums">
      <span className={metricColors.muted}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

export function StocksIndexStrip({
  benchmarks,
  summary,
  universeCount,
  visibleCount,
  isLoading,
  className,
}: {
  benchmarks?: ScreenerBenchmark[];
  summary: StocksMarketSummary;
  universeCount: number;
  visibleCount: number;
  isLoading?: boolean;
  className?: string;
}) {
  const benchmark = pickBenchmark(benchmarks);
  const hasIndex = benchmark?.lastValue != null;
  const changePct = benchmark?.percentChange ?? summary.indexChangePct;
  const indexPos = summary.indexPositionPct;
  const positionLabel = formatDayPositionLabel(indexPos);

  return (
    <div className={cn("rounded-md border border-white/[0.06] bg-slate-950/55 px-2 py-0.5", className)}>
      <div className="flex flex-col gap-0.5 lg:flex-row lg:items-stretch lg:gap-1.5">
        <div className="min-w-[8.5rem] shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-medium text-lab-text-main">Индекс МосБиржи</span>
            <span className="font-mono text-[9px] text-lab-text-dim">{benchmark?.code ?? "—"}</span>
          </div>
          {hasIndex && !isLoading ? (
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-base font-semibold tabular-nums text-lab-text-main">
                {formatIndex(benchmark?.lastValue ?? null)}
              </span>
              <span className={cn("font-mono text-[11px] font-medium tabular-nums", metricChangeClass(changePct))}>
                {formatPct(changePct)}
              </span>
            </div>
          ) : (
            <p className="mt-0.5 text-[9px] text-lab-text-dim">{isLoading ? "загрузка…" : "индекс недоступен"}</p>
          )}
          {summary.indexBreadth.available ? (
            <p className="mt-0.5 font-mono text-[9px] tabular-nums">
              <span className={metricColors.muted}>В индексе: </span>
              <span className={metricColors.breadthUp}>↑ {summary.indexBreadth.rising}</span>
              <span className={metricColors.muted}> </span>
              <span className={metricColors.breadthDown}>↓ {summary.indexBreadth.falling}</span>
              <span className={metricColors.muted}> </span>
              <span className={metricColors.breadthFlat}>→ {summary.indexBreadth.flat}</span>
              <span className={metricColors.muted}> / {summary.indexBreadth.matchedCount}</span>
            </p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 border-l border-white/[0.04] pl-2">
          <p className="text-[9px] text-lab-text-dim">Диапазон дня</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[9px] tabular-nums text-lab-text-dim">
            <span>L {formatIndex(benchmark?.low ?? null)}</span>
            <DayRangeBar position={indexPos} size="sm" className="mx-0.5 min-w-[4rem]" />
            <span>H {formatIndex(benchmark?.high ?? null)}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[9px] tabular-nums">
            <span className={metricColors.muted}>
              Диапазон <span className={metricColors.range}>{formatRangePct(benchmark?.dayRangePct ?? null)}</span>
            </span>
            {indexPos != null ? (
              <span className={metricColors.muted}>{positionLabel.compact}</span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-l border-white/[0.04] pl-2 lg:min-w-[9rem]">
          <p className="text-[9px] font-medium text-lab-text-dim">Данные рынка</p>
          <div className="mt-0.5 space-y-px">
            <MarketStatLine label="Оборот" value={formatRubTurnover(summary.totalTurnover)} valueClass={metricColors.turnover} />
            <MarketStatLine label="Сделки" value={formatTrades(summary.totalTrades)} valueClass={metricColors.trades} />
            <MarketStatLine
              label="Показано"
              value={`${visibleCount} из ${universeCount}`}
              valueClass={metricColors.shown}
            />
          </div>
        </div>

        <MarketBreadthMini summary={summary} universeCount={universeCount} className="shrink-0 lg:min-w-[7rem]" />
      </div>
    </div>
  );
}
