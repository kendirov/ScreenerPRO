"use client";

import {
  BaselineSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import * as React from "react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  SPREAD_LAB_CHART_COLORS,
  spreadLineColor,
} from "@/lib/domain/quad-hedge/spread-lab-chart-theme";
import type {
  SpreadLabChartModel,
  SpreadLabLegsMovementModel,
  SpreadLabZoneBand,
} from "@/lib/domain/quad-hedge/spread-lab-chart-model";
import { cn } from "@/lib/utils/cn";

const CHART_FONT = "ui-monospace, monospace";
const LEGS_HEIGHT_RATIO = 0.32;
const SPREAD_HEIGHT_RATIO = 0.68;

function toLineData(points: SpreadLabChartModel["spreadLine"]): LineData<Time>[] {
  return points.map((p) => ({
    time: (Number(p.time) || p.time) as Time,
    value: p.value,
  }));
}

function toHistData(bars: SpreadLabChartModel["histogram"]): HistogramData<Time>[] {
  return bars.map((b) => ({
    time: (Number(b.time) || b.time) as Time,
    value: b.value,
    color: b.color,
  }));
}

function baseChartOptions(priceFormatter: (v: number) => string) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#94a3b8",
      fontFamily: CHART_FONT,
      fontSize: 10,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: SPREAD_LAB_CHART_COLORS.grid },
    },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: SPREAD_LAB_CHART_COLORS.crosshair, style: LineStyle.Dotted },
      horzLine: { color: "rgba(148,163,184,0.12)", style: LineStyle.Dotted },
    },
    localization: {
      locale: "ru-RU",
      priceFormatter,
    },
  } as const;
}

function fmtPoints(v: number): string {
  return `${v >= 0 ? "+" : ""}${Math.round(v)} п.`;
}

function LegsNowPanel({ legs }: { legs: SpreadLabLegsMovementModel }) {
  return (
    <div className="flex shrink-0 flex-col gap-1 border-l border-white/[0.06] pl-3 font-mono text-[10px]">
      <div>
        <p className="text-[8px] uppercase tracking-widest text-slate-600">{legs.legAId}</p>
        <p className="text-cyan-300/90">{legs.legANow}</p>
      </div>
      <div>
        <p className="text-[8px] uppercase tracking-widest text-slate-600">{legs.legBId}</p>
        <p className="text-amber-300/90">{legs.legBNow}</p>
      </div>
    </div>
  );
}

function toBandData(
  points: SpreadLabChartModel["spreadLine"],
  value: number,
): LineData<Time>[] {
  return points.map((p) => ({
    time: (Number(p.time) || p.time) as Time,
    value,
  }));
}

function addSymmetricZoneBands(
  chart: IChartApi,
  times: SpreadLabChartModel["spreadLine"],
  bands: SpreadLabZoneBand[],
) {
  if (!times.length || !bands.length) return;

  const transparent = "rgba(0,0,0,0)";

  for (const band of bands) {
    const fill = band.fillColor;
    const fillSoft = band.fillColor.replace(/[\d.]+\)$/, "0.02)");

    for (const [baseline, value] of [
      [band.lower, band.upper] as const,
      [-band.upper, -band.lower] as const,
    ]) {
      const zoneSeries = chart.addSeries(BaselineSeries, {
        baseValue: { type: "price", price: baseline },
        topFillColor1: fill,
        topFillColor2: fillSoft,
        topLineColor: transparent,
        bottomFillColor1: transparent,
        bottomFillColor2: transparent,
        bottomLineColor: transparent,
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        baseLineVisible: false,
      });
      zoneSeries.setData(toBandData(times, value));
    }
  }
}

function SidePanel({ panel }: { panel: SpreadLabChartModel["sidePanel"] }) {
  if (!panel) return null;
  return (
    <div className="flex shrink-0 flex-col gap-2 border-l border-white/[0.06] pl-3 font-mono text-[10px]">
      <div>
        <p className="text-[8px] uppercase tracking-widest text-slate-600">NOW</p>
        <p className="text-cyan-300">{panel.now}</p>
      </div>
      <div>
        <p className="text-[8px] uppercase tracking-widest text-slate-600">MAX 7С</p>
        <p className="text-emerald-400/90">{panel.max7S}</p>
      </div>
      <div>
        <p className="text-[8px] uppercase tracking-widest text-slate-600">MIN 7С</p>
        <p className="text-rose-400/90">{panel.min7S}</p>
      </div>
      <div>
        <p className="text-[8px] uppercase tracking-widest text-slate-600">P90</p>
        <p className="text-violet-300/85">{panel.p90}</p>
      </div>
      <div>
        <p className="text-[8px] uppercase tracking-widest text-slate-600">P97</p>
        <p className="text-rose-300/80">{panel.p97}</p>
      </div>
      <div className="border-t border-white/[0.05] pt-2">
        <p className="text-[8px] uppercase tracking-widest text-slate-600">зона</p>
        <p className="text-amber-300/85">{panel.zoneLabel}</p>
        <p className="mt-0.5 text-[9px] text-slate-600">{panel.percentileAbs} abs</p>
        <p className="mt-0.5 text-[8px] leading-snug text-slate-600">{panel.zoneModeNote}</p>
      </div>
    </div>
  );
}

function syncVisibleRange(source: IChartApi, target: IChartApi) {
  let syncing = false;
  source.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (syncing || !range) return;
    syncing = true;
    target.timeScale().setVisibleLogicalRange(range);
    syncing = false;
  });
}

function valueAtTime(points: SpreadLabChartModel["spreadLine"], time: Time): number | null {
  const key = String(time);
  const hit = points.find((p) => p.time === key);
  return hit != null && Number.isFinite(hit.value) ? hit.value : null;
}

function syncCrosshairByTime(
  source: IChartApi,
  target: IChartApi,
  targetSeries: ISeriesApi<"Line">,
  targetPoints: SpreadLabChartModel["spreadLine"],
) {
  source.subscribeCrosshairMove((param) => {
    if (param.time) {
      const price = valueAtTime(targetPoints, param.time) ?? 0;
      target.setCrosshairPosition(price, param.time, targetSeries);
    } else {
      target.clearCrosshairPosition();
    }
  });
}

export function SpreadLabChart({
  model,
  isLoading,
  className,
  emptyHint,
}: {
  model: SpreadLabChartModel | null;
  isLoading?: boolean;
  className?: string;
  emptyHint?: string | null;
}) {
  const legsRef = React.useRef<HTMLDivElement>(null);
  const spreadRef = React.useRef<HTMLDivElement>(null);
  const stackRef = React.useRef<HTMLDivElement>(null);
  const [showLegsMovement, setShowLegsMovement] = React.useState(true);

  React.useEffect(() => {
    const spreadEl = spreadRef.current;
    const stackEl = stackRef.current;
    if (!spreadEl || !stackEl || !model?.canRender) return;

    const totalHeight = stackEl.clientHeight || 460;
    const showLegs = showLegsMovement && model.legsMovement != null;
    const legsHeight = showLegs ? Math.round(totalHeight * LEGS_HEIGHT_RATIO) : 0;
    const spreadHeight = showLegs
      ? Math.round(totalHeight * SPREAD_HEIGHT_RATIO)
      : totalHeight;

    const lastVal = model.spreadLine[model.spreadLine.length - 1]?.value ?? 0;

    const spreadChart = createChart(spreadEl, {
      ...baseChartOptions(fmtPoints),
      width: spreadEl.clientWidth,
      height: spreadHeight,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    addSymmetricZoneBands(spreadChart, model.spreadLine, model.zoneBands);

    const spreadSeries = spreadChart.addSeries(LineSeries, {
      color: spreadLineColor(lastVal),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: SPREAD_LAB_CHART_COLORS.now,
      crosshairMarkerBackgroundColor: SPREAD_LAB_CHART_COLORS.now,
    });
    spreadSeries.setData(toLineData(model.spreadLine));

    const hist = spreadChart.addSeries(HistogramSeries, {
      priceScaleId: "hist",
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: {
        type: "custom" as const,
        formatter: fmtPoints,
      },
    });
    spreadChart.priceScale("hist").applyOptions({
      scaleMargins: { top: 0.78, bottom: 0.02 },
    });
    hist.setData(toHistData(model.histogram));

    for (const level of model.priceLevels) {
      spreadSeries.createPriceLine({
        price: level.value,
        color: level.color,
        lineWidth: level.lineWidth ?? 1,
        lineStyle: level.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: level.label,
      });
    }

    const mainMarkers: SeriesMarker<Time>[] = model.markers.map((m) => ({
      time: (Number(m.time) || m.time) as Time,
      position: (m.shape === "arrowDown" || m.label === "▼" ? "belowBar" : "aboveBar") as
        | "aboveBar"
        | "belowBar",
      color: m.color,
      shape: m.shape,
      text: m.label,
    }));

    if (mainMarkers.length) createSeriesMarkers(spreadSeries, mainMarkers);

    let legsChart: IChartApi | null = null;
    let legASeries: ISeriesApi<"Line"> | null = null;

    const legsEl = legsRef.current;
    if (showLegs && model.legsMovement && legsEl) {
      legsChart = createChart(legsEl, {
        ...baseChartOptions(fmtPoints),
        width: legsEl.clientWidth,
        height: legsHeight,
        timeScale: {
          borderVisible: false,
          timeVisible: false,
          secondsVisible: false,
        },
        handleScroll: false,
        handleScale: false,
      });

      legASeries = legsChart.addSeries(LineSeries, {
        color: SPREAD_LAB_CHART_COLORS.legMovementA,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
      });
      const legBSeries = legsChart.addSeries(LineSeries, {
        color: SPREAD_LAB_CHART_COLORS.legMovementB,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
      });

      legASeries.setData(toLineData(model.legsMovement.legALine));
      legBSeries.setData(toLineData(model.legsMovement.legBLine));

      legASeries.createPriceLine({
        price: 0,
        color: SPREAD_LAB_CHART_COLORS.zeroLine,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
        title: "",
      });

      syncVisibleRange(spreadChart, legsChart);
      syncVisibleRange(legsChart, spreadChart);
      syncCrosshairByTime(spreadChart, legsChart, legASeries, model.legsMovement.legALine);
      syncCrosshairByTime(legsChart, spreadChart, spreadSeries, model.spreadLine);

      legsChart.timeScale().fitContent();
    }

    spreadChart.timeScale().fitContent();

    const resize = () => {
      const h = stackEl.clientHeight || 460;
      const legsH = showLegs && model.legsMovement ? Math.round(h * LEGS_HEIGHT_RATIO) : 0;
      const spreadH = showLegs && model.legsMovement ? Math.round(h * SPREAD_HEIGHT_RATIO) : h;
      spreadChart.applyOptions({ width: spreadEl.clientWidth, height: spreadH });
      if (legsChart && legsEl) {
        legsChart.applyOptions({ width: legsEl.clientWidth, height: legsH });
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stackEl);

    return () => {
      ro.disconnect();
      legsChart?.remove();
      spreadChart.remove();
    };
  }, [model, showLegsMovement]);

  if (isLoading) {
    return (
      <LabGlassPanel
        depth={20}
        className={cn("flex min-h-[460px] items-center justify-center", className)}
      >
        <p className="text-[11px] text-slate-500">Загрузка spread…</p>
      </LabGlassPanel>
    );
  }

  if (!model || !model.canRender) {
    return (
      <LabGlassPanel
        depth={20}
        className={cn("flex min-h-[460px] items-center justify-center p-6", className)}
      >
        <pre className="max-w-md whitespace-pre-wrap text-center font-mono text-[10px] leading-relaxed text-slate-500">
          {emptyHint ?? model?.emptyMessage ?? "Нет данных для spread-графика."}
        </pre>
      </LabGlassPanel>
    );
  }

  const canShowLegs = model.legsMovement != null;

  return (
    <LabGlassPanel
      depth={20}
      className={cn(
        "overflow-hidden border-cyan-500/15 bg-[radial-gradient(ellipse_100%_80%_at_50%_0%,rgba(6,78,99,0.22),rgba(2,6,23,0.98))] p-3 shadow-[inset_0_1px_0_rgba(34,211,238,0.06)]",
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-medium tracking-wide text-cyan-100/90">
            {model.pairLabel}
          </p>
          {canShowLegs ? (
            <button
              type="button"
              onClick={() => setShowLegsMovement((v) => !v)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[9px] transition-colors",
                showLegsMovement
                  ? "border-cyan-500/25 bg-cyan-950/40 text-cyan-200/90"
                  : "border-white/[0.06] bg-slate-950/50 text-slate-500 hover:text-slate-300",
              )}
            >
              Движение: {showLegsMovement ? "скрыть" : "показать"}
            </button>
          ) : null}
        </div>
        {model.sidePanel ? (
          <div className="hidden font-mono text-[9px] sm:block">
            <span className="text-cyan-400">{model.sidePanel.now}</span>
            <span className="mx-1.5 text-slate-700">·</span>
            <span className="text-emerald-400/80">{model.sidePanel.max7S}</span>
            <span className="mx-1.5 text-slate-700">·</span>
            <span className="text-rose-400/80">{model.sidePanel.min7S}</span>
            <span className="mx-1.5 text-slate-700">·</span>
            <span className="text-amber-300/75">{model.sidePanel.zoneLabel}</span>
          </div>
        ) : null}
      </div>

      <div ref={stackRef} className="flex min-h-[460px] flex-col gap-2">
        {showLegsMovement && model.legsMovement ? (
          <div className="flex min-h-0 flex-[32] flex-col gap-1">
            <div className="flex items-end justify-between gap-2 px-0.5">
              <p className="text-[9px] text-slate-500">Движение ног от старта окна</p>
              <div className="hidden items-center gap-3 font-mono text-[9px] sm:flex">
                <span className="text-cyan-400/80">
                  {model.legsMovement.legAId} {model.legsMovement.legANow}
                </span>
                <span className="text-amber-400/80">
                  {model.legsMovement.legBId} {model.legsMovement.legBNow}
                </span>
              </div>
            </div>
            <div className="flex min-h-[130px] flex-1 gap-2">
              <div ref={legsRef} className="min-w-0 flex-1" />
              <LegsNowPanel legs={model.legsMovement} />
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-[68] flex-col gap-1">
          <p className="px-0.5 text-[9px] text-slate-500">
            Расхождение {model.pairLabel} в пунктах
          </p>
          <div className="flex min-h-[280px] flex-1 gap-2">
            <div ref={spreadRef} className="min-w-0 flex-1" />
            <SidePanel panel={model.sidePanel} />
          </div>
        </div>
      </div>
    </LabGlassPanel>
  );
}
