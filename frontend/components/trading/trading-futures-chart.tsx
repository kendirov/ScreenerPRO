"use client";

import { useQuery } from "@tanstack/react-query";
import { MarketCandleChart } from "@/components/charts/market-candle-chart";
import {
  EXPANDED_CHART_INTERVALS,
  EXPANDED_CHART_INTERVAL_LABEL,
  type StockExpandedChartInterval,
  type StockExpandedChartResponse,
} from "@/lib/domain/stock-expanded-chart";

async function fetchFuturesChart(secid: string, interval: StockExpandedChartInterval): Promise<StockExpandedChartResponse> {
  const params = new URLSearchParams({ secid, interval: String(interval) });
  const response = await fetch(`/api/trading/futures/candles?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as StockExpandedChartResponse;
}

export function TradingFuturesChart({
  secid,
  interval,
  onIntervalChange,
}: {
  secid: string;
  interval: StockExpandedChartInterval;
  onIntervalChange: (interval: StockExpandedChartInterval) => void;
}) {
  const query = useQuery({
    queryKey: ["trading-futures-chart", secid, interval] as const,
    queryFn: () => fetchFuturesChart(secid, interval),
    staleTime: 60_000,
    refetchInterval: interval === 24 ? false : 60_000,
    retry: 1,
  });
  const series = query.data?.series;

  return (
    <section className="tr-futures-chart" aria-label={`График фьючерса ${secid}`}>
      <header>
        <div><span className="tr-label">Контракт</span><strong className="sk-mono">{secid}</strong></div>
        <div>
          {EXPANDED_CHART_INTERVALS.map((value) => (
            <button className={interval === value ? "is-active" : undefined} type="button" key={value} onClick={() => onIntervalChange(value)}>
              {EXPANDED_CHART_INTERVAL_LABEL[value]}
            </button>
          ))}
        </div>
      </header>
      <div className="tr-futures-chart__body">
        {query.isLoading ? <div className="sk-chart-state">Получаем свечи MOEX…</div> : null}
        {!query.isLoading && (query.isError || !series || series.status !== "ok" || !series.candles.length) ? <div className="sk-chart-state">Свечей нет</div> : null}
        {!query.isLoading && series?.status === "ok" && series.candles.length ? <MarketCandleChart series={series} /> : null}
      </div>
    </section>
  );
}
