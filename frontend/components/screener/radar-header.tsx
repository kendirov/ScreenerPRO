"use client";

import type { ScreenerBenchmark, ScreenerDataStatus } from "@screenerpro/shared";
import {
  interpretMarketIndex,
  resolveMarketIndexDataStatus,
} from "@/lib/domain/market-index-status";
import { tradingFormat } from "@/lib/formatters/trading";
import { RADAR_HEADER_COUNT, RADAR_METRIC_LABEL } from "@/lib/domain/radar-ui-labels";
import { ScreenerDateModeMessages } from "@/lib/domain/screener-date-mode";
import { cn } from "@/lib/utils/cn";

function pickPrimaryBenchmark(benchmarks: ScreenerBenchmark[]): ScreenerBenchmark | null {
  if (!benchmarks.length) return null;
  return (
    benchmarks.find((b) => b.code === "IMOEX2") ??
    benchmarks.find((b) => b.code === "IMOEX") ??
    benchmarks[0] ??
    null
  );
}

function RadarCountPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span className={cn("font-mono text-[9px] tabular-nums", className)}>
      <span className="text-slate-600">{label} </span>
      {value}
    </span>
  );
}

export function RadarHeader({
  benchmarks,
  dataStatus,
  isLive,
  baselineMissing,
  isHistorical,
  liqCount,
  playCount,
  actCount,
  shotCount,
  compact = false,
}: {
  benchmarks?: ScreenerBenchmark[];
  dataStatus?: ScreenerDataStatus | null;
  isLive?: boolean;
  baselineMissing: boolean;
  isHistorical: boolean;
  liqCount: number;
  playCount: number;
  actCount: number;
  shotCount: number;
  compact?: boolean;
}) {
  const benchmark = pickPrimaryBenchmark(benchmarks ?? []);
  const mood = interpretMarketIndex(benchmark);
  const indexStatus = resolveMarketIndexDataStatus({
    isLive: isLive ?? true,
    benchmark,
  });
  const changePct = benchmark?.percentChange ?? null;
  const changeClass =
    changePct === null ? "text-slate-400" : changePct > 0 ? "text-emerald-400" : changePct < 0 ? "text-rose-400" : "text-slate-400";

  const moodLabel = [mood.directionLabel, ...mood.tagLabels].filter(Boolean).join(" · ") || "—";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-0 border-b border-slate-800/40",
        compact ? "h-5 px-0 pb-1" : "px-1.5 py-1",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">Радар</span>
        {benchmark ? (
          <span className="inline-flex items-baseline gap-1 font-mono text-[9px] tabular-nums">
            <span className="text-slate-400">{benchmark.code}</span>
            <span className={cn("font-medium", changeClass)}>
              {tradingFormat.formatSignedPercent(changePct)}
            </span>
          </span>
        ) : (
          <span className="text-[9px] text-slate-600">индекс —</span>
        )}
        <span className="hidden text-[9px] text-slate-500 sm:inline" title="Режим по индексу">
          {moodLabel}
        </span>
        {isHistorical ? (
          <span className="text-[8px] text-violet-400/80">{ScreenerDateModeMessages.historicalRadarSlice}</span>
        ) : baselineMissing ? (
          <span className="text-[8px] text-amber-500/80" title="Нет надёжной базы сравнения к этому времени">
            {RADAR_METRIC_LABEL.noBaseline}
          </span>
        ) : (
          <span className="text-[8px] text-slate-600" title="База сравнения к этому времени доступна">
            {RADAR_METRIC_LABEL.baselineOk}
          </span>
        )}
        {indexStatus !== "NO DATA" ? (
          <span className="font-mono text-[8px] uppercase text-slate-600">{indexStatus}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0 font-mono text-[9px] tabular-nums">
        <RadarCountPill label={RADAR_HEADER_COUNT.liquidity} value={liqCount} className="text-cyan-400/75" />
        <span className="text-slate-700">·</span>
        <RadarCountPill label={RADAR_HEADER_COUNT.inPlay} value={playCount} className="text-emerald-400/75" />
        <span className="text-slate-700">·</span>
        <RadarCountPill label={RADAR_HEADER_COUNT.activity} value={actCount} className="text-cyan-400/70" />
        <span className="text-slate-700">·</span>
        <RadarCountPill label={RADAR_HEADER_COUNT.volatility} value={shotCount} className="text-amber-400/75" />
        {dataStatus?.fetchTimestamp ? (
          <span className="hidden text-[8px] text-slate-600 lg:inline">
            {new Date(dataStatus.fetchTimestamp).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
