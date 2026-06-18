"use client";

import * as React from "react";
import { MarketRadar } from "@/components/screener/market-radar";
import { ScreenerPageHeader, ScreenerPanel } from "@/components/screener/screener-page-chrome";
import { StocksScreenerTable } from "@/components/screener/stocks/stocks-screener-table";
import { createStockColumns } from "@/components/screener/columns";
import { ScreenerDataSourceStrip } from "@/components/screener/screener-data-source-strip";
import { TradingDateControl } from "@/components/screener/trading-date-control";
import { MarketIndexStatusBlock } from "@/components/screener/market-index-status-block";
import { UiViewModeToggle } from "@/components/screener/ui-view-mode-toggle";
import { TRADING_DATE_MESSAGES } from "@/lib/domain/trading-calendar";
import { ScreenerDateModeMessages } from "@/lib/domain/screener-date-mode";
import { selectInPlayInstruments } from "@/lib/domain/market-radar-selectors";
import { useInPlayStockCandles } from "@/lib/hooks/use-in-play-stock-candles";
import { useSelectedTradingDate } from "@/lib/hooks/use-selected-trading-date";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { useScreenerStocksShowTooltips } from "@/lib/hooks/use-screener-stocks-show-tooltips";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";

const ILLIQUID_RATIO = 0.02;
const ILLIQUID_TURNOVER_FLOOR = 35_000_000;
const ILLIQUID_MIN_TRADES = 1_200;

function tradingThresholdText(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value)} ₽`;
}

export function StocksScreenerPage() {
  const [hideIlliquid, setHideIlliquid] = React.useState(true);
  const [focusedTicker, setFocusedTicker] = React.useState<string | null>(null);
  const { showTooltips, setShowTooltips } = useScreenerStocksShowTooltips();
  const tradingDate = useSelectedTradingDate();
  const stocksQuery = useScreenerQuery("stock", tradingDate.apiDateParam);

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
  const historicalEmpty = status?.historicalEmpty === true;

  const maxTurnover = React.useMemo(
    () => stockUniverse.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0),
    [stockUniverse],
  );

  const columns = React.useMemo(() => createStockColumns(maxTurnover), [maxTurnover]);

  const inPlayTickers = React.useMemo(() => {
    if (!tradingDate.isLive) return [];
    return selectInPlayInstruments(stocks, stockUniverse).slice(0, 8).map((row) => row.ticker);
  }, [stocks, stockUniverse, tradingDate.isLive]);

  const { seriesByTicker } = useInPlayStockCandles(inPlayTickers);

  const candleLookup = React.useMemo(
    () => ({
      get: (ticker: string) => seriesByTicker.get(ticker.toUpperCase()) ?? null,
    }),
    [seriesByTicker],
  );

  const emptyTitle = stocksQuery.isLoading
    ? "Загрузка акций…"
    : historicalEmpty
      ? TRADING_DATE_MESSAGES.noData
      : stocksQuery.error
        ? "Данные временно недоступны"
        : "По фильтру ничего нет";

  const emptyText = stocksQuery.isLoading
    ? tradingDate.isLive
      ? "Подключаемся к MOEX ISS"
      : "Загружаем историю MOEX ISS"
    : historicalEmpty
      ? status?.message ?? TRADING_DATE_MESSAGES.noData
      : stocksQuery.error
        ? "Используется резервный набор — проверьте соединение"
        : hideIlliquid
          ? "Ослабьте фильтр «Скрыть неликвиды» или дождитесь активности"
          : "В ленте пока нет торгуемых бумаг";

  const resolvedHintDate =
    status?.resolvedTradingDateKey &&
    status.tradingDateKey &&
    status.resolvedTradingDateKey !== status.tradingDateKey
      ? status.resolvedTradingDateKey
      : null;

  const updatedAtLabel = status?.fetchTimestamp ?? status?.generatedAt ?? null;

  return (
    <div className="space-y-1">
      <ScreenerPageHeader
        title="Рынок · Акции"
        right={
          <>
            <UiViewModeToggle className="ui-mode-hide-presentation" />
            <ScreenerDataSourceStrip status={status} isLoading={stocksQuery.isLoading} visibleCount={stocks.length} />
            <span className="lab-chip font-mono text-[11px] tabular-nums">{stocks.length} бумаг</span>
          </>
        }
      />

      <LabGlassPanel depth={20} className="space-y-1 px-2 py-1">
        <TradingDateControl
          selectedDateKey={tradingDate.selectedDateKey}
          isLive={tradingDate.isLive}
          mode={tradingDate.mode}
          onToday={tradingDate.setToday}
          onYesterday={tradingDate.setYesterday}
          onPickDate={tradingDate.setPickedDate}
          resolvedDateKey={resolvedHintDate}
          updatedAtLabel={updatedAtLabel}
          isLoading={stocksQuery.isLoading}
          dataEmpty={historicalEmpty}
        />
        <MarketIndexStatusBlock
          benchmarks={stocksQuery.data?.benchmarks}
          status={status}
          isLive={tradingDate.isLive}
          isLoading={stocksQuery.isLoading}
        />
      </LabGlassPanel>

      {!historicalEmpty ? (
        <div className="sticky top-[4.05rem] z-30 border-b border-lab-border/25 bg-lab-bg-deep/92 backdrop-blur-md">
          <MarketRadar
            rows={stocks}
            allRows={stockUniverse}
            dataStatus={status}
            benchmarks={stocksQuery.data?.benchmarks}
            isLive={tradingDate.isLive}
            selectedTicker={focusedTicker}
            onTickerSelect={setFocusedTicker}
          />
        </div>
      ) : null}

      {!tradingDate.isLive && !historicalEmpty ? (
        <p className="px-1 text-[9px] text-violet-300/60">{ScreenerDateModeMessages.historicalSparklinesLiveOnly}</p>
      ) : null}

      <ScreenerPanel className="mb-1 flex flex-wrap items-center gap-1.5 py-1">
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
        highlightedTicker={focusedTicker}
        onHighlightedTickerChange={setFocusedTicker}
        emptyTitle={emptyTitle}
        emptyText={emptyText}
      />
    </div>
  );
}
