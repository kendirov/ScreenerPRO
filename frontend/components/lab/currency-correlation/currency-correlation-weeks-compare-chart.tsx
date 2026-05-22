"use client";

import {
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import * as React from "react";
import type { WeekCompareModel } from "@/lib/domain/currency-correlation-weeks-compare";
import { getPairConfig } from "@/lib/domain/currency-pair-config";
import { formatPairSpreadValue } from "@/lib/domain/currency-pair-divergence";
import { cn } from "@/lib/utils/cn";

const GHOST_COLORS = [
  "rgba(148, 163, 184, 0.4)",
  "rgba(167, 139, 250, 0.32)",
  "rgba(251, 191, 36, 0.32)",
  "rgba(244, 114, 182, 0.32)",
];

const CURRENT_COLOR = "rgba(34, 211, 238, 0.95)";
const MEAN_COLOR = "rgba(196, 181, 253, 0.65)";

function toLineData(
  points: { minuteOfWeek: number; value: number | null }[],
): LineData<Time>[] {
  return points
    .filter((p) => p.value != null && Number.isFinite(p.value))
    .map((p) => ({ time: p.minuteOfWeek as Time, value: p.value! }));
}

function formatMinuteLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  if (h === 0 && m === 0) return "пн 0:00";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function drawBandPolygon(
  ctx: CanvasRenderingContext2D,
  chart: IChartApi,
  priceSeries: ISeriesApi<"Line">,
  bands: { minute: number; low: number; high: number }[],
  fill: string,
) {
  if (bands.length < 2) return;

  const timeScale = chart.timeScale();
  const points: { x: number; yTop: number; yBot: number }[] = [];

  for (const b of bands) {
    const x = timeScale.timeToCoordinate(b.minute as Time);
    const yTop = priceSeries.priceToCoordinate(b.high);
    const yBot = priceSeries.priceToCoordinate(b.low);
    if (x == null || yTop == null || yBot == null) continue;
    points.push({ x, yTop, yBot });
  }

  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.yTop);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.yTop);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    ctx.lineTo(points[i]!.x, points[i]!.yBot);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function CurrencyCorrelationWeeksCompareChart({
  model,
  className,
  onCrosshairMinute,
}: {
  model: WeekCompareModel;
  className?: string;
  onCrosshairMinute?: (minute: number | null) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLCanvasElement>(null);
  const priceSeriesRef = React.useRef<ISeriesApi<"Line"> | null>(null);
  const chartRef = React.useRef<IChartApi | null>(null);

  const config = getPairConfig(model.pairKey);
  const priceFmt = React.useCallback(
    (v: number) => formatPairSpreadValue(v, config).replace(/\s/g, " "),
    [config],
  );

  const canRender = Boolean(model.currentWeek && model.currentWeek.points.length >= 2);

  const redrawBands = React.useCallback(() => {
    const chart = chartRef.current;
    const series = priceSeriesRef.current;
    const canvas = overlayRef.current;
    const container = containerRef.current;
    if (!chart || !series || !canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!model.stats.hasEnoughHistory || !model.bands.length) return;

    const wide = model.bands
      .filter((b) => b.p10 != null && b.p90 != null)
      .map((b) => ({ minute: b.minuteOfWeek, low: b.p10!, high: b.p90! }));
    const inner = model.bands
      .filter((b) => b.p25 != null && b.p75 != null)
      .map((b) => ({ minute: b.minuteOfWeek, low: b.p25!, high: b.p75! }));

    drawBandPolygon(ctx, chart, series, wide, "rgba(148, 163, 184, 0.07)");
    drawBandPolygon(ctx, chart, series, inner, "rgba(167, 139, 250, 0.12)");
  }, [model.bands, model.stats.hasEnoughHistory]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !canRender) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.06)" },
        horzLines: { color: "rgba(148,163,184,0.06)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148,163,184,0.12)",
        scaleMargins: { top: 0.12, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(148,163,184,0.12)",
        timeVisible: false,
        ticksVisible: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(34,211,238,0.35)", labelBackgroundColor: "#083344" },
        horzLine: { color: "rgba(34,211,238,0.25)", labelBackgroundColor: "#083344" },
      },
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;

    if (model.stats.hasEnoughHistory && model.bands.length) {
      const meanLine = chart.addSeries(LineSeries, {
        color: MEAN_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      meanLine.setData(
        toLineData(model.bands.map((b) => ({ minuteOfWeek: b.minuteOfWeek, value: b.mean }))),
      );
    }

    for (let i = model.pastWeeks.length - 1; i >= 0; i--) {
      const w = model.pastWeeks[i]!;
      if (w.points.length < 2) continue;
      const ghost = chart.addSeries(LineSeries, {
        color: GHOST_COLORS[i % GHOST_COLORS.length]!,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      ghost.setData(
        w.points
          .filter((p) => Number.isFinite(p.spreadPoints))
          .map((p) => ({ time: p.minuteOfWeek as Time, value: p.spreadPoints })),
      );
    }

    const currentLine = chart.addSeries(LineSeries, {
      color: CURRENT_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
    });
    priceSeriesRef.current = currentLine;
    currentLine.setData(
      model.currentWeek!.points
        .filter((p) => Number.isFinite(p.spreadPoints))
        .map((p) => ({ time: p.minuteOfWeek as Time, value: p.spreadPoints })),
    );

    const markerItems: SeriesMarker<Time>[] = model.markers.map((m) => ({
      time: m.minuteOfWeek as Time,
      position: "aboveBar" as const,
      color:
        m.kind === "week_extreme"
          ? "#fb923c"
          : m.kind === "exit_corridor"
            ? "#fbbf24"
            : "#34d399",
      shape: "circle" as const,
      text: m.label,
    }));
    if (markerItems.length) {
      createSeriesMarkers(currentLine, markerItems);
    }

    chart.applyOptions({
      localization: {
        locale: "ru-RU",
        priceFormatter: priceFmt,
        timeFormatter: (t: number) => formatMinuteLabel(Number(t)),
      },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        onCrosshairMinute?.(null);
        return;
      }
      onCrosshairMinute?.(Number(param.time));
    });

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
        redrawBands();
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    chart.timeScale().fitContent();
    chart.timeScale().subscribeVisibleLogicalRangeChange(redrawBands);
    redrawBands();

    return () => {
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(redrawBands);
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
    };
  }, [model, canRender, priceFmt, redrawBands, onCrosshairMinute]);

  if (!canRender) {
    return (
      <div
        className={cn(
          "flex min-h-[min(42vh,380px)] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] px-4 text-center",
          className,
        )}
      >
        <p className="text-sm text-slate-400">Недостаточно точек для сравнения недель</p>
        <ul className="max-w-md text-left text-[11px] text-slate-500">
          {model.diagnostics.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-[min(58vh,520px)]", className)}>
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-[1] rounded-lg"
        aria-hidden
      />
      <div ref={containerRef} className="absolute inset-0 z-[2] rounded-lg" />
      <div className="pointer-events-none relative z-[3] flex flex-wrap gap-2 px-2 pb-2 pt-1">
        <LegendSwatch color={CURRENT_COLOR} label="текущая неделя" bright />
        <LegendSwatch color={MEAN_COLOR} label="среднее прошлых" dashed />
        <LegendSwatch color="rgba(167, 139, 250, 0.35)" label="коридор 25–75%" />
        <LegendSwatch color="rgba(148, 163, 184, 0.2)" label="коридор 10–90%" />
        {model.pastWeeks.map((w) =>
          w.points.length >= 2 ? (
            <span key={w.weekStart} className="text-[10px] text-slate-600">
              {w.weekLabel}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  bright,
  dashed,
}: {
  color: string;
  label: string;
  bright?: boolean;
  dashed?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[10px]",
        bright ? "text-cyan-200/90" : "text-slate-500",
      )}
    >
      <span
        className={cn("h-0.5 w-4 rounded-full", dashed && "border border-dashed bg-transparent")}
        style={dashed ? { borderColor: color } : { background: color }}
      />
      {label}
    </span>
  );
}
