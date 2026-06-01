"use client";

import Link from "next/link";
import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildFuturesBaseMap,
  formatDataSourceLabel,
  selectAnomalyRail,
  selectInPlayStocks,
  selectPrimaryInPlayStock,
  selectTopFutures,
} from "@/lib/domain/screener-overview";
import { useSparklineHistories } from "@/lib/hooks/use-sparkline-histories";
import { useSelectedTradingDate } from "@/lib/hooks/use-selected-trading-date";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { TradingDateControl } from "@/components/screener/trading-date-control";
import { MarketIndexStatusBlock } from "@/components/screener/market-index-status-block";
import { AnomalyRail } from "./anomaly-rail";
import { FutureFocusHeroCard } from "./future-focus-hero-card";
import { LabsLaunchGrid } from "./labs-launch-grid";
import { SessionPulseCard } from "./session-pulse-card";
import { FuturesRadarMosaic, StockRadarMosaic } from "./signal-mosaic";
import { UiViewModeToggle } from "@/components/screener/ui-view-mode-toggle";
import { SignalHeroCard } from "./signal-hero-card";

function SectionHead({ title, href, hrefLabel }: { title: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
      <h2 className="lab-type-section text-xs text-lab-text">{title}</h2>
      {href ? (
        <Link href={href} className="lab-type-caption text-[11px] transition hover:text-lab-cyan">
          {hrefLabel ?? "Подробнее →"}
        </Link>
      ) : null}
    </div>
  );
}

function HeaderPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="lab-chip inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px]">
      <span className="text-lab-dim">{label}</span>
      <span className="lab-number text-lab-text">{value}</span>
    </span>
  );
}

function collectSparklineTickers(input: {
  primary: ScreenerRow | null;
  heroFuture: ScreenerRow | null;
  inPlay: ScreenerRow[];
  futures: ScreenerRow[];
  anomalies: ScreenerRow[];
}): string[] {
  const list: string[] = [];
  if (input.primary) list.push(input.primary.ticker);
  if (input.heroFuture) list.push(input.heroFuture.ticker);
  for (const row of input.inPlay) list.push(row.ticker);
  for (const row of input.futures) list.push(row.ticker);
  for (const row of input.anomalies) list.push(row.ticker);
  return list;
}

export function MarketCommandCenter() {
  const tradingDate = useSelectedTradingDate();
  const stocksQuery = useScreenerQuery("stock", tradingDate.apiDateParam);
  const futuresQuery = useScreenerQuery("future");
  const stocks = React.useMemo(() => stocksQuery.data?.rows ?? [], [stocksQuery.data?.rows]);
  const futures = React.useMemo(() => futuresQuery.data?.rows ?? [], [futuresQuery.data?.rows]);
  const status = stocksQuery.data?.status ?? futuresQuery.data?.status;

  const primaryStock = React.useMemo(() => selectPrimaryInPlayStock(stocks), [stocks]);
  const inPlayStocks = React.useMemo(() => selectInPlayStocks(stocks, 7), [stocks]);
  const topFutures = React.useMemo(() => selectTopFutures(futures, 5), [futures]);
  const heroFuture = topFutures[0] ?? null;
  const baseByTicker = React.useMemo(() => buildFuturesBaseMap(futures), [futures]);

  const anomalyRows = React.useMemo(
    () =>
      selectAnomalyRail([...stocks, ...futures], {
        limit: 4,
        excludeTickers: [primaryStock?.ticker, heroFuture?.ticker].filter(Boolean) as string[],
      }),
    [stocks, futures, primaryStock, heroFuture],
  );

  const sparklineTickers = React.useMemo(
    () =>
      collectSparklineTickers({
        primary: primaryStock,
        heroFuture,
        inPlay: inPlayStocks,
        futures: topFutures,
        anomalies: anomalyRows,
      }),
    [primaryStock, heroFuture, inPlayStocks, topFutures, anomalyRows],
  );
  const { seriesByTicker } = useSparklineHistories(sparklineTickers);
  const lookup = React.useMemo(
    () => ({
      get: (ticker: string) => seriesByTicker.get(ticker.toUpperCase()) ?? null,
    }),
    [seriesByTicker],
  );

  const updatedAt = status
    ? new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "—";
  const sourceLabel = formatDataSourceLabel(status?.source);

  const isLoading = stocksQuery.isLoading || futuresQuery.isLoading;
  const stocksHistoricalEmpty = stocksQuery.data?.status?.historicalEmpty === true;

  const resolvedHintDate =
    stocksQuery.data?.status?.resolvedTradingDateKey &&
    stocksQuery.data?.status?.tradingDateKey &&
    stocksQuery.data.status.resolvedTradingDateKey !== stocksQuery.data.status.tradingDateKey
      ? stocksQuery.data.status.resolvedTradingDateKey
      : null;

  const stocksUpdatedAt =
    stocksQuery.data?.status?.fetchTimestamp ?? stocksQuery.data?.status?.generatedAt ?? null;

  return (
    <div className="space-y-3">
      <LabGlassPanel depth={20} className="relative overflow-hidden px-4 py-3">
        <div className="lab-accent-line absolute inset-x-0 top-0 opacity-60" aria-hidden />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[200px]">
            <h1 className="lab-type-display text-lg">Пульт рынка</h1>
            <p className="lab-type-caption mt-1 max-w-xl text-xs leading-relaxed">
              Главный сигнал, фьючерс в фокусе и лента аномалий — live-радар MOEX.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="lab-status-chip lab-chip-moex">{sourceLabel}</span>
            <span className="lab-chip">
              <span className="text-lab-dim">обновлено </span>
              <span className="lab-number text-lab-text">{updatedAt}</span>
            </span>
            <HeaderPill label="Акции" value={String(stocks.length)} />
            <HeaderPill label="Фьючерсы" value={String(futures.length)} />
            <HeaderPill label="В игре" value={String(inPlayStocks.length)} />
            <UiViewModeToggle className="ui-mode-hide-presentation" />
          </div>
        </div>
        <div className="relative mt-2.5 space-y-2 border-t border-white/[0.05] pt-2.5">
          <TradingDateControl
            selectedDateKey={tradingDate.selectedDateKey}
            isLive={tradingDate.isLive}
            mode={tradingDate.mode}
            onToday={tradingDate.setToday}
            onYesterday={tradingDate.setYesterday}
            onPickDate={tradingDate.setPickedDate}
            resolvedDateKey={resolvedHintDate}
            updatedAtLabel={stocksUpdatedAt}
            isLoading={stocksQuery.isLoading}
            dataEmpty={stocksHistoricalEmpty}
          />
          <MarketIndexStatusBlock
            benchmarks={stocksQuery.data?.benchmarks}
            status={stocksQuery.data?.status}
            isLive={tradingDate.isLive}
            isLoading={stocksQuery.isLoading}
          />
        </div>
      </LabGlassPanel>

      {stocksHistoricalEmpty ? (
        <LabGlassPanel depth={10} className="border-dashed px-4 py-6 text-center">
          <p className="text-sm text-lab-muted">Нет данных за выбранную дату</p>
          <p className="mt-1 text-xs text-lab-dim">{stocksQuery.data?.status?.message}</p>
        </LabGlassPanel>
      ) : null}

      {isLoading ? (
        <LabGlassPanel depth={10} className="border-dashed px-4 py-10 text-center">
          <p className="text-sm text-lab-muted">Загрузка данных MOEX…</p>
        </LabGlassPanel>
      ) : stocksHistoricalEmpty ? null : (
        <>
          <section className="grid gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(188px,0.42fr)]">
            <SignalHeroCard
              row={primaryStock}
              sparklineValues={primaryStock ? lookup.get(primaryStock.ticker) : null}
            />
            <FutureFocusHeroCard
              row={heroFuture}
              baseLabel={heroFuture ? (baseByTicker.get(heroFuture.ticker) ?? heroFuture.shortName ?? "—") : "—"}
              sparklineValues={heroFuture ? lookup.get(heroFuture.ticker) : null}
            />
            <AnomalyRail rows={anomalyRows} className="min-h-[11.5rem] lg:min-h-[12rem]" />
          </section>

          <SessionPulseCard />

          <section>
            <SectionHead title="Радар акций" href="/screener/stocks" hrefLabel="Скринер акций →" />
            <StockRadarMosaic
              rows={inPlayStocks}
              seriesByTicker={lookup}
              maxTurnover={stocks.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0)}
            />
          </section>

          <section>
            <SectionHead title="Радар фьючерсов" href="/screener/futures" hrefLabel="Скринер фьючерсов →" />
            <FuturesRadarMosaic rows={topFutures} baseByTicker={baseByTicker} seriesByTicker={lookup} />
          </section>

          <section>
            <SectionHead title="Черновики в работе" />
            <LabsLaunchGrid />
          </section>
        </>
      )}
    </div>
  );
}
