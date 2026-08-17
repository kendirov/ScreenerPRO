"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import {
  EXPANDED_CHART_INTERVALS,
  EXPANDED_CHART_INTERVAL_LABEL,
  type StockExpandedChartInterval,
} from "@/lib/domain/stock-expanded-chart";
import { useStockExpandedCandles } from "@/lib/hooks/use-stock-expanded-candles";

const MarketCandleChart = dynamic(
  () => import("@/components/charts/market-candle-chart").then((module) => module.MarketCandleChart),
  { ssr: false },
);

export function SectorKStockChart({
  row,
  dateKey,
  initialInterval = 10,
  onClose,
}: {
  row: ScreenerRow;
  dateKey: string | null;
  initialInterval?: StockExpandedChartInterval;
  onClose: () => void;
}) {
  const [interval, setInterval] = useState<StockExpandedChartInterval>(initialInterval);
  const { series, isLoading, isError } = useStockExpandedCandles(row.ticker, interval, dateKey);

  return (
    <section className="sk-inline-chart" aria-label={`График ${row.ticker}`}>
      <div className="sk-inline-chart__head">
        <div>
          <strong className="sk-mono">{row.ticker}</strong>
          <span>{series?.status === "ok" ? `${series.source === "daily" ? "день" : "MOEX"} · ${series.candleCount} св.` : "MOEX"}</span>
        </div>
        <div className="sk-inline-chart__controls">
          {EXPANDED_CHART_INTERVALS.map((value) => (
            <button className={interval === value ? "is-active" : undefined} key={value} type="button" onClick={() => setInterval(value)}>
              {EXPANDED_CHART_INTERVAL_LABEL[value]}
            </button>
          ))}
          <button type="button" onClick={onClose} aria-label="Закрыть график"><X size={14} /></button>
        </div>
      </div>
      <div className="sk-inline-chart__body">
        {isLoading ? <div className="sk-chart-state">Загрузка…</div> : null}
        {!isLoading && (isError || !series || series.status !== "ok" || !series.candles.length) ? <div className="sk-chart-state">Свечей нет</div> : null}
        {!isLoading && series?.status === "ok" && series.candles.length ? <MarketCandleChart series={series} /> : null}
      </div>
    </section>
  );
}
