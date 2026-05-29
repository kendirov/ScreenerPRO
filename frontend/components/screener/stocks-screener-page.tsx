"use client";

import * as React from "react";
import { MarketRadar } from "@/components/screener/market-radar";
import { ScreenerPageHeader, ScreenerPanel } from "@/components/screener/screener-page-chrome";
import { StocksScreenerTable } from "@/components/screener/stocks/stocks-screener-table";
import { createStockColumns } from "@/components/screener/columns";
import { ScreenerDataSourceStrip } from "@/components/screener/screener-data-source-strip";
import { DataStatusBadge, screenerSourceToDataStatus } from "@/components/ui/metrics-minimalism";
import { selectInPlayForRadar } from "@/lib/domain/stocks-screener-signals";
import { useInPlayStockCandles } from "@/lib/hooks/use-in-play-stock-candles";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { useScreenerStocksShowTooltips } from "@/lib/hooks/use-screener-stocks-show-tooltips";

const ILLIQUID_RATIO = 0.02;
const ILLIQUID_TURNOVER_FLOOR = 35_000_000;
const ILLIQUID_MIN_TRADES = 1_200;

function tradingThresholdText(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value)} ₽`;
}

export function StocksScreenerPage() {
  const [hideIlliquid, setHideIlliquid] = React.useState(true);
  const { showTooltips, setShowTooltips } = useScreenerStocksShowTooltips();
  const stocksQuery = useScreenerQuery("stock");

  const stocks = React.useMemo(() => {
    const rows = stocksQuery.data?.rows ?? [];
    const maxTurnoverNow = rows.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
    const illiquidThresholdTurnover = Math.max(maxTurnoverNow * ILLIQUID_RATIO, ILLIQUID_TURNOVER_FLOOR);

    if (!hideIlliquid) return rows;

    return rows.filter((row) => {
      const turnover = row.turnover ?? 0;
      const tradesCount = row.tradesCount ?? 0;
      const isIlliquid = turnover < illiquidThresholdTurnover && tradesCount < ILLIQUID_MIN_TRADES;
      return !isIlliquid;
    });
  }, [stocksQuery.data?.rows, hideIlliquid]);

  const illiquidHint = React.useMemo(() => {
    const rows = stocksQuery.data?.rows ?? [];
    const maxTurnoverNow = rows.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
    const threshold = Math.max(maxTurnoverNow * ILLIQUID_RATIO, ILLIQUID_TURNOVER_FLOOR);
    return tradingThresholdText(threshold);
  }, [stocksQuery.data?.rows]);

  const stockUniverse = stocksQuery.data?.rows ?? [];
  const status = stocksQuery.data?.status;

  const dataBadge = screenerSourceToDataStatus(status?.source, {
    isLoading: stocksQuery.isLoading,
    fallbackReason: status?.fallbackReason,
    degraded: status?.degraded,
    isDemo: status?.isDemo,
  });

  const maxTurnover = React.useMemo(
    () => stockUniverse.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0),
    [stockUniverse],
  );

  const columns = React.useMemo(() => createStockColumns(maxTurnover), [maxTurnover]);

  const inPlayTickers = React.useMemo(
    () => selectInPlayForRadar(stocks).slice(0, 8).map((row) => row.ticker),
    [stocks],
  );

  const { seriesByTicker } = useInPlayStockCandles(inPlayTickers);

  const candleLookup = React.useMemo(
    () => ({
      get: (ticker: string) => seriesByTicker.get(ticker.toUpperCase()) ?? null,
    }),
    [seriesByTicker],
  );

  const emptyTitle = stocksQuery.isLoading
    ? "Загрузка акций…"
    : stocksQuery.error
      ? "Данные временно недоступны"
      : "По фильтру ничего нет";

  const emptyText = stocksQuery.isLoading
    ? "Подключаемся к MOEX ISS"
    : stocksQuery.error
      ? "Используется резервный набор — проверьте соединение"
      : hideIlliquid
        ? "Ослабьте фильтр «Скрыть неликвиды» или дождитесь активности"
        : "В ленте пока нет торгуемых бумаг";

  return (
    <div className="space-y-2">
      <ScreenerPageHeader
        title="Рынок · Акции"
        right={
          <>
            <ScreenerDataSourceStrip status={status} isLoading={stocksQuery.isLoading} visibleCount={stocks.length} />
            <DataStatusBadge kind={dataBadge.kind} label={dataBadge.label} />
            <span className="lab-chip font-mono text-[11px] tabular-nums">{stocks.length} бумаг</span>
          </>
        }
      />

      <div className="sticky top-[4.05rem] z-30 mb-1.5 space-y-1 border-b border-lab-border/35 bg-lab-bg-deep/88 pb-1 backdrop-blur-md">
        <MarketRadar rows={stocks} allRows={stockUniverse} candlesByTicker={candleLookup} />
      </div>

      <ScreenerPanel className="mb-2.5 flex flex-wrap items-center gap-2">
        <label
          className="lab-chip inline-flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-lab-text-main"
          title={`Порог: оборот &lt; 2% от лидера и сделки &lt; ${ILLIQUID_MIN_TRADES.toLocaleString("ru-RU")} (${illiquidHint})`}
        >
          <input
            type="checkbox"
            checked={hideIlliquid}
            onChange={(event) => setHideIlliquid(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-lab-border-soft bg-lab-surface-1 accent-lab-green"
          />
          <span className="font-medium">Скрыть неликвиды</span>
        </label>

        <label
          className="lab-chip inline-flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-lab-text-main"
          title="Показывать карточку инструмента при наведении."
        >
          <input
            type="checkbox"
            checked={showTooltips}
            onChange={(event) => setShowTooltips(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-lab-border-soft bg-lab-surface-1 accent-lab-cyan"
          />
          <span className="font-medium">Подсказки</span>
        </label>
      </ScreenerPanel>

      <StocksScreenerTable
        rows={stocks}
        columns={columns}
        maxTurnover={maxTurnover}
        dataStatus={status}
        hideIlliquid={hideIlliquid}
        candlesByTicker={candleLookup}
        showTooltips={showTooltips}
        emptyTitle={emptyTitle}
        emptyText={emptyText}
      />
    </div>
  );
}
