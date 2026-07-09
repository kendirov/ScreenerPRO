"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ScreenerRow } from "@screenerpro/shared";
import { computeMarketPriority } from "@/lib/screener/market-priority-engine";
import type { PriorityInstrument } from "@/lib/screener/market-priority-engine";
import { firstInPlayLeaderHref } from "@/lib/screener/market-priority-display";
import { selectTopFutures } from "@/lib/domain/screener-overview";
import { resolveScreenerEmptyState } from "@/lib/domain/screener-empty-state";
import { useScreenerQuery, isScreenerInitialLoading } from "@/lib/hooks/use-screener-query";
import { DataStatusBadge, screenerSourceToDataStatus } from "@/components/ui/metrics-minimalism";
import { CompactInstrumentRow } from "@/components/screener/market-now/compact-instrument-row";
import { MarketPulseStrip } from "@/components/screener/market-priority/market-pulse-strip";
import { LiquidityRail } from "@/components/screener/market-priority/liquidity-rail";
import { InPlayPanel } from "@/components/screener/market-priority/in-play-panel";
import { VolatilityPanel } from "@/components/screener/market-priority/volatility-panel";
import { useMarketPriorityMode } from "@/lib/hooks/use-market-priority-mode";
import {
  isMarketPriorityDebugVisible,
  MARKET_PRIORITY_DEBUG_QUERY_PARAM,
} from "@/lib/screener/market-priority-debug";
import { cn } from "@/lib/utils/cn";

function MarketLabDraftChrome() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-1.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">
        Лаборатория рынка · черновик
      </p>
      <Link
        href="/screener/stocks"
        className="rounded border border-cyan-900/35 bg-cyan-950/15 px-2 py-0.5 font-mono text-[10px] text-cyan-300/90 transition hover:border-cyan-700/45 hover:bg-cyan-950/25 hover:text-cyan-200"
      >
        Рабочий скринер акций →
      </Link>
    </header>
  );
}

function DrillDownSection({
  focusFutures,
  className,
}: {
  focusFutures: ScreenerRow[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5 border-t border-lab-border/20 pt-2", className)}>
      <details className="group rounded border border-lab-border/25 bg-slate-950/30">
        <summary className="cursor-pointer list-none px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-zinc-600 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="group-open:text-zinc-400">Все инструменты</span>
        </summary>
        <div className="border-t border-lab-border/15 px-2 py-2">
          <div className="flex flex-wrap gap-3 text-[10px]">
            <Link href="/screener/stocks" className="text-zinc-400 hover:text-zinc-200">
              Таблица акций →
            </Link>
            <Link href="/screener/futures" className="text-zinc-500 hover:text-zinc-300">
              Фьючерсы →
            </Link>
          </div>
        </div>
      </details>

      {focusFutures.length > 0 ? (
        <details className="group rounded border border-lab-border/25 bg-slate-950/30">
          <summary className="cursor-pointer list-none px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-zinc-600 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="group-open:text-zinc-400">Фьючерсы · {focusFutures.length}</span>
          </summary>
          <div className="border-t border-lab-border/20 px-2 py-2">
            <div className="mb-2 flex justify-end">
              <Link href="/screener/futures" className="text-[10px] text-zinc-500 hover:text-zinc-300">
                Все фьючерсы →
              </Link>
            </div>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {focusFutures.map((row) => (
                <CompactInstrumentRow
                  key={row.ticker}
                  row={row}
                  detailHref={`/futures/${row.ticker}`}
                />
              ))}
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function OpenFirstBar({
  inPlayLeaders,
  isLoading,
}: {
  inPlayLeaders: PriorityInstrument[];
  isLoading: boolean;
}) {
  if (isLoading) return null;

  const topHref = firstInPlayLeaderHref(inPlayLeaders);
  const topTicker = inPlayLeaders[0]?.secid;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-lab-border/20 px-1 py-1 font-mono text-[8px]">
      <span className="uppercase tracking-[0.12em] text-zinc-600">Открыть</span>
      {topHref && topTicker ? (
        <Link href={topHref} className="text-cyan-300/90 hover:text-cyan-200">
          {topTicker} →
        </Link>
      ) : (
        <Link href="/screener/stocks" className="text-zinc-500 hover:text-zinc-300">
          таблица →
        </Link>
      )}
    </div>
  );
}

export function MarketPriorityPage() {
  const [inPlayMode, setInPlayMode] = useMarketPriorityMode();
  const searchParams = useSearchParams();
  const showGateDebug = isMarketPriorityDebugVisible(
    searchParams.get(MARKET_PRIORITY_DEBUG_QUERY_PARAM),
  );
  const stocksQuery = useScreenerQuery("stock");
  const futuresQuery = useScreenerQuery("future");
  const stocks = stocksQuery.data?.rows ?? [];
  const futures = futuresQuery.data?.rows ?? [];
  const status = stocksQuery.data?.status ?? futuresQuery.data?.status;
  const diagnostics = stocksQuery.data?.diagnostics ?? futuresQuery.data?.diagnostics;

  const isLoading = isScreenerInitialLoading(stocksQuery) || isScreenerInitialLoading(futuresQuery);

  const priority = React.useMemo(
    () =>
      stocks.length > 0
        ? computeMarketPriority<ScreenerRow>(stocks, {
            maxLiquidity: 10,
            maxVolatility: 8,
            mode: inPlayMode,
          })
        : null,
    [stocks, inPlayMode],
  );

  const focusFutures = React.useMemo(() => selectTopFutures(futures, 6), [futures]);

  const empty = resolveScreenerEmptyState({
    isLoading,
    error: Boolean(stocksQuery.error || futuresQuery.error),
    status,
    diagnostics,
    visibleCount: stocks.length,
    apiRowCount: status?.stockRows ?? stocks.length,
  });

  const dataStatus = screenerSourceToDataStatus(status?.source, {
    isLoading,
    fallbackReason: status?.fallbackReason,
    degraded: status?.degraded,
    isDemo: status?.isDemo,
  });

  const gateDebugStats =
    showGateDebug && priority && !isLoading
      ? {
          mode: priority.stats.mode,
          total: priority.stats.total,
          eligible: priority.stats.eligible,
          inPlayCandidates: priority.stats.inPlayCandidates,
          finalInPlayCount: priority.stats.finalInPlayCount,
          confirmedActivityCount: priority.stats.confirmedActivityCount,
          confirmedRangeCount: priority.stats.confirmedRangeCount,
          fallbackOnlyRejected: priority.stats.fallbackOnlyRejected,
        }
      : null;

  const deckPanels = (
    <>
      <div className="flex flex-col gap-2 lg:hidden">
        <InPlayPanel
          leaders={priority?.inPlayLeaders ?? []}
          mode={inPlayMode}
          onModeChange={setInPlayMode}
          gateDebugStats={gateDebugStats}
        />
        <LiquidityRail leaders={priority?.liquidityLeaders ?? []} />
        <VolatilityPanel leaders={priority?.volatilityLeaders ?? []} />
      </div>

      <div className="hidden gap-2 lg:grid lg:grid-cols-[9.5rem_minmax(0,1fr)_9.5rem] lg:items-start xl:grid-cols-[10.5rem_minmax(0,1.15fr)_10.5rem]">
        <LiquidityRail leaders={priority?.liquidityLeaders ?? []} />
        <InPlayPanel
          leaders={priority?.inPlayLeaders ?? []}
          mode={inPlayMode}
          onModeChange={setInPlayMode}
          gateDebugStats={gateDebugStats}
        />
        <VolatilityPanel leaders={priority?.volatilityLeaders ?? []} />
      </div>
    </>
  );

  return (
    <div className="space-y-2">
      <MarketLabDraftChrome />

      <MarketPulseStrip
        status={status}
        diagnostics={diagnostics}
        isLoading={isLoading}
        priority={priority}
        mode={inPlayMode}
      />

      {empty ? (
        <div className="rounded border border-dashed border-lab-border/50 bg-slate-950/40 px-4 py-8 text-center">
          <div className="mb-3 flex justify-center">
            <DataStatusBadge kind={dataStatus.kind} label={dataStatus.label} />
          </div>
          <p className="text-sm text-lab-muted">{empty.title}</p>
          <p className="mt-1 text-xs text-lab-dim">{empty.text}</p>
          <Link
            href="/screener/stocks"
            className="mt-4 inline-block font-mono text-[10px] text-cyan-300/85 hover:text-cyan-200"
          >
            Рабочий скринер акций →
          </Link>
        </div>
      ) : (
        <>
          {(status?.source === "demo" ||
            status?.source === "fallback" ||
            status?.isDemo ||
            status?.degraded) && (
            <div className="flex flex-wrap items-center gap-2">
              <DataStatusBadge kind={dataStatus.kind} label={dataStatus.label} />
              {status?.message ? (
                <span className="text-[10px] text-lab-dim">{status.message}</span>
              ) : null}
            </div>
          )}

          <section aria-label="Market Command Deck · draft">{deckPanels}</section>

          <OpenFirstBar inPlayLeaders={priority?.inPlayLeaders ?? []} isLoading={isLoading} />

          <DrillDownSection focusFutures={focusFutures} />
        </>
      )}
    </div>
  );
}
