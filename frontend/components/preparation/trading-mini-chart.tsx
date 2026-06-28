"use client";

import * as React from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { ExternalSeriesPoint } from "@/lib/preparation/preparation-types";
import { SvgMiniChart } from "@/components/preparation/svg-mini-chart";
import { cn } from "@/lib/utils/cn";

type ChartTone = "positive" | "negative" | "neutral";

const TONE_COLOR: Record<ChartTone, string> = {
  positive: "#34d399",
  negative: "#fb7185",
  neutral: "#94a3b8",
};

function resolveTone(changePct: number | null | undefined, series: ExternalSeriesPoint[]): ChartTone {
  if (changePct != null) {
    if (changePct > 0) return "positive";
    if (changePct < 0) return "negative";
    return "neutral";
  }
  if (series.length >= 2) {
    const delta = series[series.length - 1]!.value - series[0]!.value;
    if (delta > 0) return "positive";
    if (delta < 0) return "negative";
  }
  return "neutral";
}

function TradingMiniChartInner({
  series,
  changePct,
  height = 64,
  className,
}: {
  series: ExternalSeriesPoint[];
  changePct?: number | null;
  height?: number;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const seriesRef = React.useRef<ISeriesApi<"Area"> | null>(null);
  const [failed, setFailed] = React.useState(false);

  const validSeries = React.useMemo(
    () => series.filter((p) => Number.isFinite(p.value)),
    [series],
  );

  const tone = resolveTone(changePct, validSeries);
  const color = TONE_COLOR[tone];

  React.useEffect(() => {
    if (validSeries.length < 2) return;
    const container = containerRef.current;
    if (!container) return;

    try {
      const width = container.clientWidth || 160;
      const chart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "transparent",
          attributionLogo: false,
        },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: false },
        timeScale: { visible: false, borderVisible: false },
        crosshair: {
          vertLine: { visible: false, labelVisible: false },
          horzLine: { visible: false, labelVisible: false },
        },
        handleScroll: false,
        handleScale: false,
      });

      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: color,
        topColor: `${color}33`,
        bottomColor: `${color}00`,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
      });

      areaSeries.setData(
        validSeries.map((p) => ({
          time: p.date as Time,
          value: p.value,
        })),
      );

      chart.timeScale().fitContent();
      chartRef.current = chart;
      seriesRef.current = areaSeries;

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !chartRef.current) return;
        chartRef.current.applyOptions({ width: entry.contentRect.width });
        chartRef.current.timeScale().fitContent();
      });
      observer.observe(container);

      return () => {
        observer.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      };
    } catch {
      setFailed(true);
    }
  }, [validSeries, color]);

  if (validSeries.length < 2) return null;

  if (failed) {
    return <SvgMiniChart series={validSeries} changePct={changePct} height={height} className={className} />;
  }

  return (
    <div
      ref={containerRef}
      className={cn("w-full overflow-hidden", className)}
      style={{ height }}
    />
  );
}

export function TradingMiniChart(props: {
  series: ExternalSeriesPoint[];
  changePct?: number | null;
  height?: number;
  className?: string;
}) {
  const validCount = props.series.filter((p) => Number.isFinite(p.value)).length;
  if (validCount < 2) return null;

  return <TradingMiniChartInner {...props} />;
}
