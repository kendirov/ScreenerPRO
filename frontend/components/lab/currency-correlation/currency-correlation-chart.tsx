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
import { CURRENCY_FAMILY_META, type CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import {
  type ChartMarkerItem,
  type CurrencyChartMode,
  type CurrencyChartModel,
} from "@/lib/domain/currency-correlation-chart-model";
import { cn } from "@/lib/utils/cn";

export const MODE_LABELS: Record<CurrencyChartMode, string> = {
  points: "Ноги",
  spread: "Расхождение",
  trajectory: "Z-score",
  weeks: "Недели",
  normalize: "Нормализация",
  returns: "Дневные изменения",
  divergence: "Расхождение",
};

type TooltipState = {
  time: string;
  x: number;
  y: number;
  rows: Array<{
    family: CurrencyCorrelationFamily;
    ticker: string;
    normalized: number;
    dailyReturnPct: number;
    divergence: number;
    color: string;
  }>;
} | null;

function toLineData(points: { time: string; value: number }[]): LineData<Time>[] {
  return points.map((p) => ({ time: p.time as Time, value: p.value }));
}

function markersForFamily(
  family: CurrencyCorrelationFamily,
  items: ChartMarkerItem[],
): SeriesMarker<Time>[] {
  return items
    .filter((m) => m.family === family)
    .map((m) => ({
      time: m.time as Time,
      position: "aboveBar" as const,
      color: m.color,
      shape: "circle" as const,
      text: m.text,
    }));
}

function ChartEmptyPanel({ model }: { model: CurrencyChartModel }) {
  return (
    <div className="flex min-h-[min(42vh,380px)] flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-400">Недостаточно общих дат для графика</p>
      <ul className="max-w-md space-y-2 text-left text-xs leading-relaxed text-slate-500">
        {model.excludedInstruments.map((e) => (
          <li key={e.family}>
            <span className="font-mono text-violet-400/70">{e.family}</span> ({e.label}): {e.reason}
          </li>
        ))}
        {model.diagnosticHints.slice(0, 3).map((h) => (
          <li key={h} className="text-slate-600">
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CurrencyCorrelationChart({
  model,
  className,
}: {
  model: CurrencyChartModel;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const seriesRef = React.useRef<ISeriesApi<"Line">[]>([]);
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);

  const chartInstruments = model.chartInstruments;
  const excludedInstruments = model.excludedInstruments;
  const canRender = model.canRenderChart && model.series.length >= 2;

  const priceFormat =
    model.mode === "returns"
      ? { type: "custom" as const, formatter: (v: number) => `${v.toFixed(2)}%` }
      : model.mode === "divergence"
        ? { type: "custom" as const, formatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}` }
        : { type: "custom" as const, formatter: (v: number) => v.toFixed(2) };

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
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(167,139,250,0.35)", labelBackgroundColor: "#1e1b4b" },
        horzLine: { color: "rgba(167,139,250,0.25)", labelBackgroundColor: "#1e1b4b" },
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;
    seriesRef.current = [];

    for (const s of model.series) {
      if (!chartInstruments.includes(s.family)) continue;
      const line = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
      });
      line.setData(toLineData(s.data));
      seriesRef.current.push(line);

      const familyMarkers = markersForFamily(s.family, model.markers);
      if (familyMarkers.length) {
        createSeriesMarkers(line, familyMarkers);
      }
    }

    if (model.mode === "normalize") {
      const baseline = chart.addSeries(LineSeries, {
        color: "rgba(148,163,184,0.35)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      baseline.setData(model.dates.map((time) => ({ time: time as Time, value: 100 })));
    }

    if (model.mode === "divergence") {
      const zero = chart.addSeries(LineSeries, {
        color: "rgba(148,163,184,0.35)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      zero.setData(model.dates.map((time) => ({ time: time as Time, value: 0 })));
    }

    chart.applyOptions({
      localization: {
        locale: "ru-RU",
        priceFormatter: priceFormat.formatter,
      },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.point == null || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }
      const time = String(param.time);
      const row = model.tooltipIndex.get(time);
      if (!row) {
        setTooltip(null);
        return;
      }
      const rows = model.series
        .filter((s) => chartInstruments.includes(s.family))
        .map((s) => {
          const cell = row[s.family];
          if (!cell) return null;
          return {
            family: s.family,
            ticker: cell.ticker,
            normalized: cell.normalized,
            dailyReturnPct: cell.dailyReturnPct,
            divergence: cell.divergence,
            color: s.color,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r != null);

      setTooltip({ time, x: param.point.x, y: param.point.y, rows });
    });

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    chart.timeScale().fitContent();

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = [];
    };
  }, [model, canRender, chartInstruments, priceFormat.formatter]);

  if (!canRender) {
    return (
      <div className={cn("relative rounded-xl", className)}>
        <ChartEmptyPanel model={model} />
        {excludedInstruments.length > 0 ? (
          <p className="mt-2 px-2 text-center text-[10px] text-slate-600">
            Исключены:{" "}
            {excludedInstruments
              .map((e) => `${e.family} (${CURRENCY_FAMILY_META[e.family].label})`)
              .join(", ")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("relative flex min-h-[min(58vh,520px)] flex-col", className)}>
      <div
        ref={containerRef}
        className="absolute inset-0 rounded-xl"
        style={{ boxShadow: "inset 0 0 80px rgba(139,92,246,0.04)" }}
      />

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-30 min-w-[220px] rounded-lg border border-white/10 bg-slate-950/94 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl"
          style={{
            left: Math.min(
              (containerRef.current?.clientWidth ?? 400) - 230,
              Math.max(8, tooltip.x + 12),
            ),
            top: Math.max(8, tooltip.y - 8),
          }}
        >
          <p className="font-mono text-[11px] text-violet-200/90">{tooltip.time}</p>
          <ul className="mt-2 space-y-2">
            {tooltip.rows.map((r) => (
              <li key={r.family} className="text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
                  <span className="font-semibold text-slate-200">{r.family}</span>
                  <span className="font-mono text-slate-500">{r.ticker}</span>
                </div>
                <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono tabular-nums text-slate-400">
                  <dt>от 100</dt>
                  <dd className="text-right text-slate-200">
                    {Number.isFinite(r.normalized) ? r.normalized.toFixed(2) : "—"}
                  </dd>
                  <dt>Δ день</dt>
                  <dd className="text-right text-slate-200">
                    {Number.isFinite(r.dailyReturnPct)
                      ? `${r.dailyReturnPct >= 0 ? "+" : ""}${r.dailyReturnPct.toFixed(2)}%`
                      : "—"}
                  </dd>
                  <dt>к корзине</dt>
                  <dd className="text-right text-slate-200">
                    {Number.isFinite(r.divergence)
                      ? `${r.divergence >= 0 ? "+" : ""}${r.divergence.toFixed(2)}`
                      : "—"}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="pointer-events-none relative z-10 mt-auto flex flex-wrap gap-3 px-3 pb-3 pt-2">
        {model.series
          .filter((s) => chartInstruments.includes(s.family))
          .map((s) => (
            <span key={s.family} className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span
                className="h-2 w-6 rounded-full"
                style={{ background: s.color, boxShadow: `0 0 8px ${s.color}55` }}
              />
              <span className="text-slate-400">{s.label}</span>
              <span className="font-mono text-slate-600">{s.ticker}</span>
            </span>
          ))}
      </div>
    </div>
  );
}

