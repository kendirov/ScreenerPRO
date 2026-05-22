"use client";

import Link from "next/link";
import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildBriefingCard,
  buildFuturesBaseMap,
  formatDataSourceLabel,
  selectInPlayStocks,
  selectPrimaryInPlayStock,
  selectStrongMovement,
  selectTopFutures,
} from "@/lib/domain/screener-overview";
import { useSparklineHistories } from "@/lib/hooks/use-sparkline-histories";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { cn } from "@/lib/utils/cn";
import { BriefingCard } from "./briefing-card";
import { auraPill, commandHeaderShell, sectionShell } from "./dashboard-styles";
import { FutureFocusHeroCard } from "./future-focus-hero-card";
import { MovementRail } from "./movement-rail";
import { FuturesFocusMosaic, StockRadarMosaic } from "./signal-mosaic";
import { SignalHeroCard } from "./signal-hero-card";
import { SignalRail } from "./signal-rail";

function SectionHead({ title, href, hrefLabel }: { title: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 px-1">
      <h2 className="text-sm font-semibold tracking-wide text-white/90">{title}</h2>
      {href ? (
        <Link href={href} className="text-[11px] text-white/40 transition hover:text-white/70">
          {hrefLabel ?? "Подробнее →"}
        </Link>
      ) : null}
    </div>
  );
}

function HeaderPill({ label, value }: { label: string; value: string }) {
  return (
    <span className={auraPill}>
      <span className="text-white/40">{label}</span>
      <span className="font-mono tabular-nums text-white/80">{value}</span>
    </span>
  );
}

function collectSparklineTickers(input: {
  primary: ScreenerRow | null;
  heroFuture: ScreenerRow | null;
  inPlay: ScreenerRow[];
  futures: ScreenerRow[];
}): string[] {
  const list: string[] = [];
  if (input.primary) list.push(input.primary.ticker);
  if (input.heroFuture) list.push(input.heroFuture.ticker);
  for (const row of input.inPlay) list.push(row.ticker);
  for (const row of input.futures) list.push(row.ticker);
  return list;
}

export function MarketCommandCenter() {
  const stocksQuery = useScreenerQuery("stock");
  const futuresQuery = useScreenerQuery("future");
  const stocks = React.useMemo(() => stocksQuery.data?.rows ?? [], [stocksQuery.data?.rows]);
  const futures = React.useMemo(() => futuresQuery.data?.rows ?? [], [futuresQuery.data?.rows]);
  const status = stocksQuery.data?.status ?? futuresQuery.data?.status;

  const primaryStock = React.useMemo(() => selectPrimaryInPlayStock(stocks), [stocks]);
  const inPlayStocks = React.useMemo(() => selectInPlayStocks(stocks, 4), [stocks]);
  const topFutures = React.useMemo(() => selectTopFutures(futures, 4), [futures]);
  const heroFuture = topFutures[0] ?? null;
  const baseByTicker = React.useMemo(() => buildFuturesBaseMap(futures), [futures]);
  const strongMovement = React.useMemo(() => selectStrongMovement([...stocks, ...futures], 10), [stocks, futures]);

  const briefing = React.useMemo(
    () => buildBriefingCard({ inPlayStocks, topFutures, baseByTicker }),
    [inPlayStocks, topFutures, baseByTicker],
  );

  const sparklineTickers = React.useMemo(
    () => collectSparklineTickers({ primary: primaryStock, heroFuture, inPlay: inPlayStocks, futures: topFutures }),
    [primaryStock, heroFuture, inPlayStocks, topFutures],
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

  const maxStockTurnover = React.useMemo(
    () => stocks.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0),
    [stocks],
  );

  const radarStocks = React.useMemo(() => {
    if (!primaryStock) return inPlayStocks;
    return inPlayStocks.filter((row) => row.ticker !== primaryStock.ticker);
  }, [inPlayStocks, primaryStock]);

  const signalRailRows = React.useMemo(() => {
    const pool = primaryStock
      ? inPlayStocks.filter((row) => row.ticker !== primaryStock.ticker)
      : inPlayStocks;
    return pool.slice(0, 5);
  }, [inPlayStocks, primaryStock]);

  const mosaicFutures = React.useMemo(() => {
    if (!heroFuture) return topFutures;
    return topFutures.filter((row) => row.ticker !== heroFuture.ticker).slice(0, 4);
  }, [topFutures, heroFuture]);

  return (
    <div className="space-y-4">
      <header className={cn(commandHeaderShell, "flex flex-wrap items-center justify-between gap-3 px-4 py-3")}>
        <h1 className="text-base font-semibold tracking-wide text-white">Пульт рынка</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-white/45">
            {sourceLabel}
            <span className="mx-1.5 text-white/20">·</span>
            <span className="font-mono tabular-nums text-white/55">{updatedAt}</span>
          </span>
          <HeaderPill label="Акции" value={String(stocks.length)} />
          <HeaderPill label="Фьючерсы" value={String(futures.length)} />
          <HeaderPill label="В игре" value={String(inPlayStocks.length)} />
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(200px,0.5fr)]">
        <SignalHeroCard
          row={primaryStock}
          sparklineValues={primaryStock ? lookup.get(primaryStock.ticker) : null}
          maxTurnover={maxStockTurnover}
        />
        <FutureFocusHeroCard
          row={heroFuture}
          baseLabel={heroFuture ? (baseByTicker.get(heroFuture.ticker) ?? heroFuture.shortName ?? "—") : "—"}
          sparklineValues={heroFuture ? lookup.get(heroFuture.ticker) : null}
        />
        <SignalRail rows={signalRailRows} className="lg:min-h-[9.5rem]" />
      </section>

      <section className={sectionShell}>
        <SectionHead title="Радар акций" href="/screener/stocks" hrefLabel="Скринер акций →" />
        {radarStocks.length > 0 ? (
          <StockRadarMosaic rows={radarStocks} seriesByTicker={lookup} />
        ) : primaryStock ? (
          <p className="px-1 text-sm text-white/45">Один лидер — смотрите блок «Главный сигнал».</p>
        ) : (
          <StockRadarMosaic rows={[]} seriesByTicker={lookup} />
        )}
      </section>

      <section className={sectionShell}>
        <SectionHead title="Фьючерсы в фокусе" href="/screener/futures" hrefLabel="Скринер фьючерсов →" />
        {mosaicFutures.length > 0 ? (
          <FuturesFocusMosaic rows={mosaicFutures} baseByTicker={baseByTicker} seriesByTicker={lookup} />
        ) : heroFuture ? (
          <p className="px-1 text-sm text-white/45">Топ контракт — в блоке «Фьючерс в фокусе».</p>
        ) : (
          <FuturesFocusMosaic rows={[]} baseByTicker={baseByTicker} seriesByTicker={lookup} />
        )}
      </section>

      <section className={sectionShell}>
        <SectionHead title="Лента движения" />
        <MovementRail rows={strongMovement} />
      </section>

      <BriefingCard briefing={briefing} />
    </div>
  );
}
