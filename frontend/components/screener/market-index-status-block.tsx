"use client";

import type { ScreenerBenchmark, ScreenerDataStatus } from "@screenerpro/shared";
import {
  interpretMarketIndex,
  resolveMarketIndexDataStatus,
  type MarketIndexDataStatus,
} from "@/lib/domain/market-index-status";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

type MarketIndexStatusBlockProps = {
  benchmarks?: ScreenerBenchmark[];
  benchmark?: ScreenerBenchmark | null;
  status?: ScreenerDataStatus | null;
  isLive: boolean;
  isLoading?: boolean;
  className?: string;
};

function pickPrimaryIndexBenchmark(benchmarks: ScreenerBenchmark[]): ScreenerBenchmark | null {
  if (!benchmarks.length) return null;
  return benchmarks.find((b) => b.code === "IMOEX2") ?? benchmarks.find((b) => b.code === "IMOEX") ?? benchmarks[0] ?? null;
}

function MetricPill({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1 font-mono text-[10px] tabular-nums", className)}>
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-300/90">{value}</span>
    </span>
  );
}

function StatusBadge({ dataStatus }: { dataStatus: MarketIndexDataStatus }) {
  const styles: Record<MarketIndexDataStatus, string> = {
    LIVE: "border-emerald-500/30 bg-emerald-950/35 text-emerald-200/90",
    HIST: "border-violet-500/25 bg-violet-950/35 text-violet-200/85",
    "NO DATA": "border-amber-500/30 bg-amber-950/35 text-amber-100/90",
  };

  return (
    <span className={cn("rounded px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wide", styles[dataStatus])}>
      {dataStatus === "NO DATA" ? "NO DATA" : dataStatus}
    </span>
  );
}

function MoodChip({ label, tone }: { label: string; tone: "up" | "down" | "neutral" | "wide" | "pressure" | "strength" }) {
  const toneClass: Record<typeof tone, string> = {
    up: "border-emerald-500/25 bg-emerald-950/30 text-emerald-200/85",
    down: "border-rose-500/25 bg-rose-950/30 text-rose-200/85",
    neutral: "border-slate-600/40 bg-slate-900/40 text-slate-300/80",
    wide: "border-amber-500/25 bg-amber-950/25 text-amber-100/85",
    pressure: "border-rose-500/20 bg-rose-950/25 text-rose-200/75",
    strength: "border-emerald-500/20 bg-emerald-950/25 text-emerald-200/75",
  };

  return (
    <span className={cn("rounded px-1.5 py-px text-[9px] font-medium", toneClass[tone])}>
      {label}
    </span>
  );
}

export function MarketIndexStatusBlock({
  benchmarks,
  benchmark: benchmarkProp,
  status,
  isLive,
  isLoading,
  className,
}: MarketIndexStatusBlockProps) {
  const benchmark = benchmarkProp ?? pickPrimaryIndexBenchmark(benchmarks ?? []);
  const dataStatus = resolveMarketIndexDataStatus({ isLoading, isLive, benchmark });
  const mood = interpretMarketIndex(benchmark);

  const updatedLabel = status?.fetchTimestamp
    ? new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : benchmark?.updatedAt
      ? new Date(benchmark.updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : "—";

  const changePct = benchmark?.percentChange ?? null;
  const changeClass =
    changePct === null ? "text-slate-400" : changePct > 0 ? "text-emerald-400" : changePct < 0 ? "text-rose-400" : "text-slate-400";

  if (dataStatus === "NO DATA" && !isLoading) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/15 bg-amber-950/10 px-3 py-2",
          className,
        )}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-300/90">Индекс МосБиржи</p>
          <p className="text-[10px] text-amber-200/75">Нет данных по индексу MOEX ISS</p>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge dataStatus="NO DATA" />
          <span className="font-mono text-[9px] text-cyan-400/70">MOEX ISS</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-r from-slate-950/80 via-slate-950/50 to-cyan-950/15 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-cyan-500/35 to-transparent" aria-hidden />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-[9rem] shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] font-medium text-slate-200/95">Индекс МосБиржи</p>
            <StatusBadge dataStatus={dataStatus} />
          </div>
          <p className="mt-0.5 font-mono text-[10px] tabular-nums text-cyan-400/75">
            {benchmark?.code ?? "IMOEX2"} · MOEX ISS
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <MoodChip label={mood.directionLabel} tone={mood.direction} />
            {mood.tags.map((tag, idx) => (
              <MoodChip key={tag} label={mood.tagLabels[idx] ?? tag} tone={tag} />
            ))}
          </div>
        </div>

        <div className="flex min-w-[7rem] shrink-0 flex-col">
          <span className="font-mono text-[1.35rem] font-semibold leading-none tabular-nums text-slate-100">
            {isLoading ? "…" : tradingFormat.formatDynamicPrice(benchmark?.lastValue ?? null)}
          </span>
          <div className={cn("mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[11px] tabular-nums", changeClass)}>
            <span>{tradingFormat.formatSignedPoints(benchmark?.absoluteChange ?? null)}</span>
            <span>{tradingFormat.formatSignedPercent(changePct)}</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <MetricPill label="O" value={tradingFormat.formatDynamicPrice(benchmark?.open ?? null)} />
          <MetricPill label="H" value={tradingFormat.formatDynamicPrice(benchmark?.high ?? null)} className="text-emerald-300/80" />
          <MetricPill label="L" value={tradingFormat.formatDynamicPrice(benchmark?.low ?? null)} className="text-rose-300/80" />
          <MetricPill label="Pred" value={tradingFormat.formatDynamicPrice(benchmark?.previousClose ?? null)} />
          <MetricPill
            label="Range"
            value={tradingFormat.formatDayRangeMagnitude(benchmark?.dayRangePct ?? null)}
            className="text-violet-300/80"
          />
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-[9px] tabular-nums text-slate-500">
            {isLoading ? "обновление…" : updatedLabel}
          </p>
          <p className="text-[9px] text-cyan-400/65">MOEX ISS</p>
        </div>
      </div>
    </div>
  );
}
