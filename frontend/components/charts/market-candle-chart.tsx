"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { StockExpandedChartSeries } from "@/lib/domain/stock-expanded-chart";

const MOSCOW_TIME = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatMoscowChartTime(time: Time): string {
  if (typeof time === "number") return MOSCOW_TIME.format(new Date(time * 1000));
  if (typeof time === "string") return time;
  return `${String(time.day).padStart(2, "0")}.${String(time.month).padStart(2, "0")}`;
}

function chartTime(time: string, source: StockExpandedChartSeries["source"]): Time {
  if (source === "daily" && !time.includes("T")) return time as Time;
  return Math.floor(new Date(time).getTime() / 1000) as Time;
}

function candleData(series: StockExpandedChartSeries): CandlestickData<Time>[] {
  return series.candles.map((candle) => ({
    time: chartTime(candle.time, series.source),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function volumeData(
  series: StockExpandedChartSeries,
  positive: string,
  negative: string,
): HistogramData<Time>[] {
  return series.candles
    .filter((candle) => candle.volume != null && Number.isFinite(candle.volume))
    .map((candle) => ({
      time: chartTime(candle.time, series.source),
      value: candle.volume!,
      color: candle.close >= candle.open ? positive : negative,
    }));
}

function cssColor(element: HTMLElement, token: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(token).trim() || fallback;
}

export function MarketCandleChart({ series }: { series: StockExpandedChartSeries }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || series.status !== "ok" || !series.candles.length) return;

    const positive = cssColor(element, "--sk-positive", "#62bd86");
    const negative = cssColor(element, "--sk-negative", "#e06f68");
    const muted = cssColor(element, "--sk-muted", "#969a98");
    const line = cssColor(element, "--sk-line", "rgba(255,255,255,.1)");
    const accent = cssColor(element, "--sk-accent", "#ed7c31");

    const chart = createChart(element, {
      width: element.clientWidth,
      height: element.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: muted,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: line },
        horzLines: { color: line },
      },
      rightPriceScale: {
        borderColor: line,
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: line,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
        tickMarkFormatter: formatMoscowChartTime,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: accent, labelBackgroundColor: accent },
        horzLine: { color: accent, labelBackgroundColor: accent },
      },
      handleScroll: true,
      handleScale: true,
      localization: { locale: "ru-RU", timeFormatter: formatMoscowChartTime },
    });
    chartRef.current = chart;

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: positive,
      downColor: negative,
      borderUpColor: positive,
      borderDownColor: negative,
      wickUpColor: positive,
      wickDownColor: negative,
      priceLineColor: accent,
    });
    candles.setData(candleData(series));

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const volumes = volumeData(series, `${positive}66`, `${negative}66`);
    if (volumes.length) volume.setData(volumes);

    chart.timeScale().fitContent();
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [series]);

  return <div className="sk-market-chart" ref={containerRef} />;
}
