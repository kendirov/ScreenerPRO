"use client";

import type { ScreenerApiResponse, ScreenerDataStatus } from "@screenerpro/shared";
import type { MarketPriorityResult } from "@/lib/screener/market-priority-engine";
import type { MarketPriorityMode } from "@/lib/screener/market-priority-presets";
import { MARKET_PRIORITY_PRESETS } from "@/lib/screener/market-priority-presets";
import { DataQualityBadge } from "@/components/screener/data-quality-badge";
import { cn } from "@/lib/utils/cn";

function PulseStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "cyan" | "amber";
}) {
  const valueClass =
    tone === "cyan"
      ? "text-cyan-300/90"
      : tone === "amber"
        ? "text-amber-300/80"
        : "text-zinc-300/90";

  return (
    <span className="inline-flex items-baseline gap-1 font-mono text-[8px] tabular-nums">
      <span className="text-zinc-600">{label}</span>
      <span className={valueClass}>{value}</span>
    </span>
  );
}

export function MarketPulseStrip({
  status,
  diagnostics,
  isLoading,
  priority,
  mode,
  className,
}: {
  status?: ScreenerDataStatus | null;
  diagnostics?: ScreenerApiResponse["diagnostics"];
  isLoading?: boolean;
  priority?: MarketPriorityResult | null;
  mode?: MarketPriorityMode;
  className?: string;
}) {
  const updatedLabel = status
    ? new Date(status.fetchTimestamp || status.generatedAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const marketStatus = diagnostics?.marketStatus ?? status?.marketStatus ?? null;
  const marketLabel =
    marketStatus === "open"
      ? "открыт"
      : marketStatus === "closed"
        ? "закрыт"
        : marketStatus === "halted"
          ? "останов"
          : marketStatus === "auction"
            ? "аукцион"
            : null;

  const modeLabel = mode ? MARKET_PRIORITY_PRESETS[mode].label : null;
  const inPlayCount = priority?.inPlayLeaders.length ?? 0;
  const riskCount = priority?.volatilityLeaders.length ?? 0;

  return (
    <header
      className={cn(
        "flex flex-col gap-0.5 border-b border-lab-border/25 pb-1 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <h1 className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
          Пульт рынка
        </h1>
        <span className="text-zinc-700">·</span>
        <DataQualityBadge status={status} isLoading={isLoading} />
        {modeLabel ? (
          <>
            <span className="text-zinc-700">·</span>
            <span className="font-mono text-[8px] uppercase tracking-wide text-zinc-500">{modeLabel}</span>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {updatedLabel ? <PulseStat label="upd" value={updatedLabel} /> : null}
        {marketLabel ? <PulseStat label="mkt" value={marketLabel} /> : null}
        {priority && !isLoading ? (
          <>
            <PulseStat label="n" value={String(priority.stats.total)} />
            <PulseStat label="ok" value={String(priority.stats.eligible)} />
            <PulseStat
              label="play"
              value={String(inPlayCount)}
              tone={inPlayCount > 0 ? "cyan" : "neutral"}
            />
            <PulseStat label="risk" value={String(riskCount)} tone={riskCount > 0 ? "amber" : "neutral"} />
          </>
        ) : isLoading ? (
          <span className="font-mono text-[8px] text-zinc-600">…</span>
        ) : null}
      </div>
    </header>
  );
}
