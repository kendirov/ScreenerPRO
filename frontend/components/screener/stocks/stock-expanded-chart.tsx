"use client";

import * as React from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildStockChartCandleTooltipIndex,
  buildStockChartPriceLevels,
  chartTimeKey,
  EXPANDED_CHART_INTERVALS,
  EXPANDED_CHART_INTERVAL_LABEL,
  resolveStockChartSessionLayout,
  type StockChartCandleTooltip,
  type StockChartSessionLayout,
  type StockExpandedChartInterval,
  type StockExpandedChartSeries,
} from "@/lib/domain/stock-expanded-chart";
import { cn } from "@/lib/utils/cn";

function toChartTime(time: string, source: StockExpandedChartSeries["source"]): Time {
  if (source === "daily" && !time.includes("T")) {
    return time as Time;
  }
  return Math.floor(new Date(time).getTime() / 1000) as Time;
}

function toCandleData(series: StockExpandedChartSeries): CandlestickData<Time>[] {
  return series.candles.map((c) => ({
    time: toChartTime(c.time, series.source),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function toVolumeData(series: StockExpandedChartSeries): HistogramData<Time>[] {
  return series.candles
    .filter((c) => c.volume != null && Number.isFinite(c.volume))
    .map((c) => ({
      time: toChartTime(c.time, series.source),
      value: c.volume!,
      color: c.close >= c.open ? "rgba(52,211,153,0.35)" : "rgba(251,113,133,0.35)",
    }));
}

type OverlayLine = {
  id: string;
  x: number;
  tone: "muted" | "session" | "now";
  label: string;
};

type OverlayZone = {
  left: number;
  width: number;
  label: string;
};

type ChartOverlayState = {
  lines: OverlayLine[];
  zone: OverlayZone | null;
};

type CandleTooltipState = {
  x: number;
  y: number;
  data: StockChartCandleTooltip;
} | null;

function ChartEmptyState() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-lab-border-soft/50 bg-black/20 px-6 text-center">
      <p className="text-sm font-medium text-lab-text-main">Свечи недоступны</p>
      <p className="max-w-sm text-xs leading-relaxed text-lab-text-dim">
        MOEX ISS не вернул историю для этого инструмента
      </p>
    </div>
  );
}

function buildOverlayState(
  chart: IChartApi,
  layout: StockChartSessionLayout,
  series: StockExpandedChartSeries,
): ChartOverlayState {
  if (!layout.showSessionGuides) {
    return { lines: [], zone: null };
  }

  const ts = chart.timeScale();
  const toX = (time: string | null): number | null => {
    if (!time) return null;
    return ts.timeToCoordinate(toChartTime(time, series.source));
  };

  const lines: OverlayLine[] = [];

  const firstX = toX(layout.firstCandleTime);
  if (firstX != null && Number.isFinite(firstX)) {
    lines.push({
      id: "first",
      x: firstX,
      tone: "muted",
      label: "начало",
    });
  }

  const sessionX = toX(layout.mainSessionTime);
  if (sessionX != null && Number.isFinite(sessionX)) {
    lines.push({
      id: "session",
      x: sessionX,
      tone: "session",
      label: "10:00 основная",
    });
  }

  const nowX = toX(layout.lastCandleTime);
  if (nowX != null && Number.isFinite(nowX)) {
    lines.push({
      id: "now",
      x: nowX,
      tone: "now",
      label: "сейчас",
    });
  }

  let zone: OverlayZone | null = null;
  if (layout.hasPreSessionData && firstX != null && sessionX != null && sessionX > firstX) {
    zone = {
      left: firstX,
      width: sessionX - firstX,
      label: "ранние свечи",
    };
  }

  return { lines, zone };
}

function ChartSessionOverlay({ overlay }: { overlay: ChartOverlayState }) {
  if (!overlay.lines.length && !overlay.zone) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {overlay.zone ? (
        <div
          className="absolute inset-y-0 bg-slate-950/35"
          style={{ left: overlay.zone.left, width: Math.max(overlay.zone.width, 0) }}
        >
          <span className="absolute bottom-7 left-1 max-w-[72px] text-[8px] leading-tight text-lab-text-dim/80">
            {overlay.zone.label}
          </span>
        </div>
      ) : null}

      {overlay.lines.map((line) => (
        <div
          key={line.id}
          className={cn(
            "absolute inset-y-0 w-0",
            line.tone === "session" && "border-l border-dashed border-cyan-400/55",
            line.tone === "now" && "border-l border-cyan-400/55",
            line.tone === "muted" && "border-l border-slate-400/35",
          )}
          style={{ left: line.x }}
        >
          <span
            className={cn(
              "absolute bottom-1.5 whitespace-nowrap text-[8px] tracking-wide",
              line.tone === "session"
                ? "text-cyan-300/75"
                : line.tone === "now"
                  ? "text-cyan-400/70"
                  : "text-lab-text-dim/70",
            )}
            style={{ transform: "translateX(-50%)" }}
          >
            {line.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function CandleTooltipPanel({ tooltip }: { tooltip: CandleTooltipState }) {
  if (!tooltip) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 max-w-[210px] rounded-md border border-lab-border/40 bg-slate-950/92 px-2.5 py-2 text-[10px] shadow-lg backdrop-blur-sm"
      style={{
        left: tooltip.x + 12,
        top: Math.max(8, tooltip.y - 8),
        transform: "translateY(-100%)",
      }}
    >
      <p className="font-mono text-[11px] text-lab-cyan">{tooltip.data.timeLabel}</p>
      <div className="mt-1 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 font-mono tabular-nums text-lab-text-main">
        <span className="text-lab-text-dim">O</span>
        <span className="text-right">{tooltip.data.open}</span>
        <span className="text-lab-text-dim">H</span>
        <span className="text-right text-lab-green">{tooltip.data.high}</span>
        <span className="text-lab-text-dim">L</span>
        <span className="text-right text-lab-red">{tooltip.data.low}</span>
        <span className="text-lab-text-dim">C</span>
        <span className="text-right">{tooltip.data.close}</span>
      </div>
      {tooltip.data.volume ? (
        <p className="mt-1 text-lab-text-dim">Объём {tooltip.data.volume}</p>
      ) : null}
      {tooltip.data.changeFromOpen ? (
        <p className="mt-0.5 text-lab-text-dim">{tooltip.data.changeFromOpen}</p>
      ) : null}
      {tooltip.data.rangePosition ? (
        <p className="mt-0.5 text-lab-text-dim">{tooltip.data.rangePosition}</p>
      ) : null}
    </div>
  );
}

export function StockExpandedChart({
  row,
  series,
  interval,
  onIntervalChange,
  isLoading,
  className,
}: {
  row: ScreenerRow;
  maxTurnover: number;
  series: StockExpandedChartSeries | null;
  interval: StockExpandedChartInterval;
  onIntervalChange: (interval: StockExpandedChartInterval) => void;
  isLoading?: boolean;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const [overlay, setOverlay] = React.useState<ChartOverlayState>({ lines: [], zone: null });
  const [candleTooltip, setCandleTooltip] = React.useState<CandleTooltipState>(null);

  const canRender = series?.status === "ok" && (series.candles.length ?? 0) >= 1;
  const sessionLayout = series ? resolveStockChartSessionLayout(series) : null;

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !canRender || !series) {
      setOverlay({ lines: [], zone: null });
      setCandleTooltip(null);
      return;
    }

    const layout = resolveStockChartSessionLayout(series);
    const tooltipIndex = buildStockChartCandleTooltipIndex(series, row);

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.05)" },
        horzLines: { color: "rgba(148,163,184,0.05)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148,163,184,0.1)",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      timeScale: {
        borderColor: "rgba(148,163,184,0.1)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(34,211,238,0.22)", labelBackgroundColor: "#0f172a" },
        horzLine: { color: "rgba(34,211,238,0.18)", labelBackgroundColor: "#0f172a" },
      },
      handleScroll: true,
      handleScale: true,
      localization: { locale: "ru-RU" },
    });

    chartRef.current = chart;

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#fb7185",
      borderUpColor: "#34d399",
      borderDownColor: "#fb7185",
      wickUpColor: "#34d399",
      wickDownColor: "#fb7185",
      priceLineVisible: false,
    });
    candles.setData(toCandleData(series));

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    const volumeData = toVolumeData(series);
    if (volumeData.length) volume.setData(volumeData);

    for (const level of buildStockChartPriceLevels(row)) {
      candles.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: level.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: level.label,
      });
    }

    const refreshOverlay = () => {
      setOverlay(buildOverlayState(chart, layout, series));
    };

    chart.timeScale().fitContent();
    requestAnimationFrame(refreshOverlay);

    chart.timeScale().subscribeVisibleLogicalRangeChange(refreshOverlay);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.point == null || param.point.x < 0 || param.point.y < 0) {
        setCandleTooltip(null);
        return;
      }

      const key = chartTimeKey(String(param.time), series.source);
      const data = tooltipIndex.get(key);
      if (!data) {
        setCandleTooltip(null);
        return;
      }

      setCandleTooltip({
        x: param.point.x,
        y: param.point.y,
        data,
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        refreshOverlay();
      }
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(refreshOverlay);
      chart.remove();
      chartRef.current = null;
      setOverlay({ lines: [], zone: null });
      setCandleTooltip(null);
    };
  }, [canRender, row, series]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {EXPANDED_CHART_INTERVALS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onIntervalChange(value)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide transition",
                interval === value
                  ? "border-lab-cyan/45 bg-lab-cyan/10 text-lab-cyan"
                  : "border-lab-border-soft/40 text-lab-text-dim hover:border-lab-border-soft/70 hover:text-lab-text-main",
              )}
            >
              {EXPANDED_CHART_INTERVAL_LABEL[value]}
            </button>
          ))}
        </div>
        {sessionLayout?.sessionNote ? (
          <p className="max-w-[220px] text-right text-[9px] leading-snug text-lab-text-dim">
            {sessionLayout.sessionNote}
          </p>
        ) : null}
      </div>

      <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-lab-border-soft/35 bg-black/25">
        {isLoading && !canRender ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 text-xs text-lab-text-dim">
            Загрузка свечей…
          </div>
        ) : null}
        {!canRender && !isLoading ? (
          <ChartEmptyState />
        ) : (
          <>
            <div ref={containerRef} className="absolute inset-0" />
            <ChartSessionOverlay overlay={overlay} />
            <CandleTooltipPanel tooltip={candleTooltip} />
          </>
        )}
      </div>
    </div>
  );
}
