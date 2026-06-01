"use client";

import {
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type HistogramData,
  type ISeriesApi,
  type LineData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import * as React from "react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { QuadHedgeMainChartModel } from "@/lib/domain/quad-hedge/chart-model";
import { cn } from "@/lib/utils/cn";

function toLineData(points: { time: string; value: number }[]): LineData<Time>[] {
  return points.map((p) => ({
    time: (Number(p.time) || p.time) as Time,
    value: p.value,
  }));
}

function toHistData(bars: QuadHedgeMainChartModel["histogram"]): HistogramData<Time>[] {
  return bars.map((b) => ({
    time: (Number(b.time) || b.time) as Time,
    value: b.value,
    color: b.color,
  }));
}

export function QuadHedgeMainChart({
  model,
  isLoading,
  className,
  emptyHint,
}: {
  model: QuadHedgeMainChartModel | null;
  isLoading?: boolean;
  className?: string;
  emptyHint?: string | null;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !model?.canRender) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "ui-monospace, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(148,163,184,0.04)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.42 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(34,211,238,0.2)", style: LineStyle.Dotted },
        horzLine: { color: "rgba(148,163,184,0.15)", style: LineStyle.Dotted },
      },
      handleScroll: true,
      handleScale: true,
      localization: {
        locale: "ru-RU",
        priceFormatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
      },
    });

    let levelsHost: ISeriesApi<"Line"> | null = null;

    for (const line of model.lines) {
      const series = chart.addSeries(LineSeries, {
        color: line.color,
        lineWidth: line.lineWidth ?? 1,
        lineStyle: line.dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: line.id !== "basket",
        crosshairMarkerVisible: true,
      });
      series.setData(toLineData(line.data));
      if (!levelsHost) levelsHost = series;

      if (model.showDayMarkers && line.id === "SI") {
        const markers: SeriesMarker<Time>[] = model.dayMarkers.map((m) => ({
          time: (Number(m.time) || m.time) as Time,
          position: "aboveBar" as const,
          color: "rgba(148,163,184,0.55)",
          shape: "circle" as const,
          text: m.label,
        }));
        if (markers.length) createSeriesMarkers(series, markers);
      }
    }

    const hist = chart.addSeries(HistogramSeries, {
      priceScaleId: "hist",
      priceLineVisible: false,
      lastValueVisible: false,
      ...(model.histogramUnit === "points"
        ? {
            priceFormat: {
              type: "custom" as const,
              formatter: (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)} п.`,
            },
          }
        : {}),
    });
    chart.priceScale("hist").applyOptions({
      scaleMargins: { top: 0.72, bottom: 0.02 },
    });
    hist.setData(toHistData(model.histogram));

    for (const level of model.histLevels) {
      hist.createPriceLine({
        price: level.value,
        color: level.color,
        lineWidth: 1,
        lineStyle: level.dashed ? LineStyle.Dotted : LineStyle.Solid,
        axisLabelVisible: true,
        title: level.label,
      });
    }

    if (levelsHost && model.zAvailable && model.histogramUnit === "pp") {
      for (const level of model.priceLevels) {
        levelsHost.createPriceLine({
          price: level.value,
          color: level.color,
          lineWidth: 1,
          lineStyle: level.dashed ? LineStyle.Dotted : LineStyle.Solid,
          axisLabelVisible: true,
          title: level.label,
        });
      }
    }

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
    };
  }, [model]);

  if (isLoading) {
    return (
      <LabGlassPanel className={cn("flex min-h-[360px] items-center justify-center p-4", className)}>
        <p className="text-[11px] text-slate-500">Загрузка SI / EU / CN…</p>
      </LabGlassPanel>
    );
  }

  if (!model || !model.canRender) {
    return (
      <LabGlassPanel className={cn("flex min-h-[360px] items-center justify-center p-4", className)}>
        <pre className="max-w-md whitespace-pre-wrap text-center font-mono text-[10px] leading-relaxed text-slate-500">
          {emptyHint ?? model?.emptyMessage ?? "Данных недостаточно для графика."}
        </pre>
      </LabGlassPanel>
    );
  }

  return (
    <LabGlassPanel
      className={cn(
        "overflow-hidden border-cyan-500/12 bg-[radial-gradient(ellipse_95%_70%_at_50%_15%,rgba(8,51,68,0.18),rgba(2,6,23,0.97))] p-2",
        className,
      )}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-500/55">SI / EU / CN</p>
          <p className="text-[9px] text-slate-600">
            линии: normalized % · гистограмма: {model.histogramLabel}
            {model.histogramUnit === "points" ? " · шкала в пунктах" : ""}
            {model.zAvailable && model.histogramUnit === "pp" ? " · z-зоны" : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          {model.histogramUnit === "points" && model.extremeLevels.length ? (
            <div className="flex flex-wrap justify-end gap-x-2 font-mono text-[9px] text-slate-500">
              {model.extremeLevels.map((e) => (
                <span key={e.label} style={{ color: e.color }}>
                  {e.label}
                </span>
              ))}
            </div>
          ) : null}
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {model.legend.map((item) => (
            <span key={item.label} className="flex items-center gap-1 text-[9px] text-slate-500">
              <span
                className={cn("h-0.5 w-3 rounded-full", item.dashed && "border-t border-dashed bg-transparent")}
                style={item.dashed ? { borderColor: item.color } : { background: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
        </div>
      </div>
      <div ref={containerRef} className="min-h-[340px] w-full" />
    </LabGlassPanel>
  );
}
