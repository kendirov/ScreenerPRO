"use client";

import * as React from "react";
import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildFuturesBaseMap,
  selectInPlayStocks,
  selectStrongMovement,
  selectTopFutures,
} from "@/lib/domain/screener-overview";
import { selectHardInPlayInstruments } from "@/lib/domain/market-radar-selectors";
import { classifyStockTradingState, filterStocksByTradingState } from "@/lib/domain/stock-trading-state";
import { useScreenerQuery, isScreenerInitialLoading } from "@/lib/hooks/use-screener-query";
import { tradingFormat } from "@/lib/formatters/trading";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { MarketFocusPanel } from "@/components/screener/market-now/market-focus-panel";
import { MarketKpiCard } from "@/components/screener/market-now/market-kpi-card";
import { MarketStatusStrip } from "@/components/screener/market-now/market-status-strip";
import { CompactInstrumentRow } from "@/components/screener/market-now/compact-instrument-row";
import { resolveScreenerEmptyState } from "@/lib/domain/screener-empty-state";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";

function InPlayTable({ rows, maxTurnover }: { rows: ScreenerRow[]; maxTurnover: number }) {
  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-[11px] text-lab-dim">
        Жёстких in-play сейчас нет — это нормальное состояние рынка
      </p>
    );
  }

  return (
    <div className="divide-y divide-lab-border/30">
      {rows.map((row) => {
        const range = row.metrics.dayRangePct;
        const volX = row.metrics.volumeRatioNow ?? row.metrics.turnoverVsAverage;
        return (
          <Link
            key={row.ticker}
            href={`/stocks/${row.ticker}`}
            className="grid grid-cols-[4rem_1fr_auto] items-center gap-2 px-2 py-1.5 text-[11px] transition hover:bg-lab-surface-1/40"
          >
            <span className="font-mono font-semibold text-lab-cyan">{row.ticker}</span>
            <span className="truncate text-lab-dim">{row.shortName}</span>
            <span className="font-mono tabular-nums text-lab-text">
              {tradingFormat.formatDynamicPrice(row.lastPrice)}{" "}
              <span className={row.percentChange && row.percentChange > 0 ? "text-emerald-400" : "text-rose-400"}>
                {row.percentChange != null ? tradingFormat.formatSignedPercent(row.percentChange) : "—"}
              </span>
            </span>
            <span className="col-span-3 flex flex-wrap gap-2 font-mono text-[9px] text-lab-dim">
              <span>{tradingFormat.formatTurnoverRub(row.turnover)}</span>
              <span>{row.tradesCount ? `${Math.round(row.tradesCount / 1000)}k сд.` : "—"}</span>
              <span>{range != null ? `rng ${tradingFormat.formatDayRangeMagnitude(range)}` : "—"}</span>
              <span>{volX != null ? `vol ${volX.toFixed(1)}x` : "—"}</span>
              <span>{classifyStockTradingState(row, maxTurnover) === "in_play" ? "в игре" : ""}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function MarketNowPage() {
  const stocksQuery = useScreenerQuery("stock");
  const futuresQuery = useScreenerQuery("future");
  const stocks = stocksQuery.data?.rows ?? [];
  const futures = futuresQuery.data?.rows ?? [];
  const status = stocksQuery.data?.status ?? futuresQuery.data?.status;
  const diagnostics = stocksQuery.data?.diagnostics ?? futuresQuery.data?.diagnostics;

  const maxTurnover = React.useMemo(
    () => stocks.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0),
    [stocks],
  );

  const hardInPlay = React.useMemo(() => selectHardInPlayInstruments(stocks, stocks).slice(0, 12), [stocks]);
  const activeCount = React.useMemo(
    () => stocks.filter((r) => classifyStockTradingState(r, maxTurnover) === "active").length,
    [stocks, maxTurnover],
  );
  const momentumCount = React.useMemo(
    () => stocks.filter((r) => classifyStockTradingState(r, maxTurnover) === "momentum").length,
    [stocks, maxTurnover],
  );
  const topTurnoverStock = stocks[0] ? [...stocks].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))[0] : null;
  const totalTurnover = stocks.reduce((s, r) => s + (r.turnover ?? 0), 0) + futures.reduce((s, r) => s + (r.turnover ?? 0), 0);

  const topTurnover = React.useMemo(
    () => [...stocks].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 6),
    [stocks],
  );
  const impulses = React.useMemo(() => selectStrongMovement(stocks, 5), [stocks]);
  const nearExtreme = React.useMemo(
    () =>
      stocks
        .filter((r) => {
          const pos = computePositionInRange(r.lastPrice, r.low, r.high);
          return pos != null && (pos >= 0.88 || pos <= 0.12);
        })
        .slice(0, 5),
    [stocks],
  );
  const dangerous = React.useMemo(
    () => filterStocksByTradingState(stocks, "dangerous", maxTurnover).slice(0, 5),
    [stocks, maxTurnover],
  );
  const focusFutures = React.useMemo(() => selectTopFutures(futures, 10), [futures]);
  const baseMap = React.useMemo(() => buildFuturesBaseMap(futures), [futures]);

  const isLoading = isScreenerInitialLoading(stocksQuery) || isScreenerInitialLoading(futuresQuery);
  const empty = resolveScreenerEmptyState({
    isLoading,
    error: Boolean(stocksQuery.error || futuresQuery.error),
    status,
    diagnostics,
    visibleCount: stocks.length + futures.length,
    apiRowCount: (status?.stockRows ?? 0) + (status?.futuresRows ?? 0),
  });

  return (
    <div className="space-y-2">
      <LabGlassPanel depth={20} className="px-3 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="lab-type-display text-lg">Лаборатория рынка</h1>
            <p className="lab-type-caption mt-0.5 text-xs text-lab-dim">MOEX · акции и фьючерсы · интрадей</p>
          </div>
          <MarketStatusStrip
            status={status}
            diagnostics={diagnostics}
            isLoading={isLoading}
            visibleCount={stocks.length + futures.length}
          />
        </div>
      </LabGlassPanel>

      {empty ? (
        <LabGlassPanel depth={10} className="border-dashed px-4 py-8 text-center">
          <p className="text-sm text-lab-muted">{empty.title}</p>
          <p className="mt-1 text-xs text-lab-dim">{empty.text}</p>
        </LabGlassPanel>
      ) : (
        <>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
            <MarketKpiCard
              label="Оборот рынка"
              value={totalTurnover > 0 ? tradingFormat.formatTurnoverRub(totalTurnover) : "—"}
              tone="money"
            />
            <MarketKpiCard label="Акции в игре" value={String(hardInPlay.length)} tone="in_play" />
            <MarketKpiCard label="Активные" value={String(activeCount)} />
            <MarketKpiCard label="Импульсы" value={String(momentumCount)} tone="warning" />
            <MarketKpiCard
              label="Ликвидность"
              value={topTurnoverStock?.ticker ?? "—"}
              hint={topTurnoverStock ? tradingFormat.formatTurnoverRub(topTurnoverStock.turnover) : undefined}
            />
          </div>

          <div className="grid gap-2 lg:grid-cols-[3fr_2fr]">
            <LabGlassPanel depth={10} className="min-h-[280px] overflow-hidden">
              <div className="border-b border-lab-border/30 px-2 py-1.5">
                <h2 className="text-[10px] uppercase tracking-[0.14em] text-lab-muted">Акции в игре</h2>
              </div>
              <InPlayTable rows={hardInPlay} maxTurnover={maxTurnover} />
            </LabGlassPanel>
            <div className="grid min-h-[280px] grid-rows-2 gap-2">
              <MarketFocusPanel title="Топ оборота" rows={topTurnover} href="/screener/stocks" />
              <MarketFocusPanel title="Импульсы" rows={impulses} href="/screener/stocks" emptyText="Импульсов нет" />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <MarketFocusPanel title="У high / low дня" rows={nearExtreme} href="/screener/stocks" />
            <MarketFocusPanel
              title="Слабая ликвидность"
              rows={dangerous}
              href="/screener/stocks"
              emptyText="Опасных движений нет"
            />
          </div>

          <LabGlassPanel depth={10} className="px-2 py-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[10px] uppercase tracking-[0.14em] text-lab-muted">Фьючерсы в фокусе</h2>
              <Link href="/screener/futures" className="text-[10px] text-lab-dim hover:text-lab-cyan">
                Все →
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
              {focusFutures.length === 0 ? (
                <p className="col-span-full px-1 py-2 text-[10px] text-lab-dim">Фьючерсы не загружены</p>
              ) : null}
            </div>
            {focusFutures.length > 0 ? (
              <p className="mt-2 text-[9px] text-lab-dim">
                {focusFutures
                  .slice(0, 3)
                  .map((r) => baseMap.get(r.ticker) ?? r.ticker)
                  .join(" · ")}
              </p>
            ) : null}
          </LabGlassPanel>
        </>
      )}
    </div>
  );
}
