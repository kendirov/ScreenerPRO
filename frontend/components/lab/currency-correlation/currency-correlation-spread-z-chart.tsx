"use client";

import {
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type ISeriesApi,
  type LineData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import * as React from "react";
import type { CurrencyPointsChartModel } from "@/lib/domain/currency-correlation-points-model";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { PointsTooltipSnapshot } from "@/lib/domain/currency-correlation-points-model";
import { LIFECYCLE_ZONE_LEVELS } from "@/lib/domain/spread-lifecycle";
import { formatUnitValueShort } from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

type TooltipState = {
  x: number;
  y: number;
  snapshot: PointsTooltipSnapshot;
} | null;

function toLineData(points: { time: string; value: number }[]): LineData<Time>[] {
  return points
    .filter((p) => Number.isFinite(p.value))
    .map((p) => ({ time: (Number(p.time) || p.time) as Time, value: p.value }));
}

function fmtZ(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function addZoneLines(line: ISeriesApi<"Line">) {
  for (const zone of LIFECYCLE_ZONE_LEVELS) {
    line.createPriceLine({
      price: zone.z,
      color: zone.color,
      lineWidth: zone.z === 0 ? 2 : 1,
      lineStyle: zone.z === 0 ? LineStyle.Solid : LineStyle.Dotted,
      axisLabelVisible: true,
      title: zone.label,
    });
  }
}

function lifecycleMarkersForPair(
  pairKey: PointsPairKey,
  markers: CurrencyPointsChartModel["lifecycleMarkers"],
): SeriesMarker<Time>[] {
  return (markers ?? [])
    .filter((m) => m.pairKey === pairKey)
    .map((m) => ({
      time: (Number(m.time) || m.time) as Time,
      position: "aboveBar" as const,
      color: m.color,
      shape: (m.kind === "outside-week" ? "square" : "circle") as "circle" | "square",
      text: m.text,
    }));
}

export function CurrencyCorrelationSpreadZChart({
  model,
  className,
  focusPair,
}: {
  model: CurrencyPointsChartModel;
  className?: string;
  focusPair: PointsPairKey;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = React.useState<TooltipState>(null);

  const canRender = model.canRenderChart && model.series.length >= 1;

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
        scaleMargins: { top: 0.1, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(148,163,184,0.12)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: CrosshairMode.Normal },
      handleScroll: true,
      handleScale: true,
    });

    let zonesDrawn = false;
    const lines: ISeriesApi<"Line">[] = [];

    for (const s of model.series) {
      const line = chart.addSeries(LineSeries, {
        color: s.color,
        lineWidth: s.ticker === focusPair ? 2 : 1,
        lineStyle: s.ticker === focusPair ? LineStyle.Solid : LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: s.ticker === focusPair,
        crosshairMarkerVisible: true,
      });
      line.setData(toLineData(s.data));
      lines.push(line);

      if (!zonesDrawn) {
        addZoneLines(line);
        zonesDrawn = true;
      }

      const pk = s.ticker as PointsPairKey;
      const markers = lifecycleMarkersForPair(pk, model.lifecycleMarkers);
      if (markers.length) createSeriesMarkers(line, markers);
    }

    chart.applyOptions({
      localization: {
        locale: "ru-RU",
        priceFormatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} z`,
      },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.point == null || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }
      const snapshot = model.tooltipIndex.get(String(param.time));
      if (!snapshot) {
        setTooltip(null);
        return;
      }
      setTooltip({ x: param.point.x, y: param.point.y, snapshot });
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
    };
  }, [model, canRender, focusPair]);

  if (!canRender) {
    return (
      <div className={cn("flex min-h-[min(42vh,380px)] items-center justify-center text-sm text-slate-500", className)}>
        {model.diagnosticMessage ?? "Недостаточно данных для графика спреда"}
      </div>
    );
  }

  const pickSpread = (key: PointsPairKey) => {
    if (key === "SI/CNY") return tooltip?.snapshot.diffSiCny;
    if (key === "SI/ED") return tooltip?.snapshot.diffSiEd;
    return tooltip?.snapshot.diffCnyEd;
  };
  const pickZ = (key: PointsPairKey) => {
    if (key === "SI/CNY") return tooltip?.snapshot.zSiCny;
    if (key === "SI/ED") return tooltip?.snapshot.zSiEd;
    return tooltip?.snapshot.zCnyEd;
  };

  return (
    <div className={cn("relative flex min-h-[min(58vh,520px)] flex-col", className)}>
      <p className="pointer-events-none absolute inset-x-0 top-7 z-20 px-3 text-[9px] text-slate-600">
        Ось: z-score спреда · горизонтальные линии — зоны наблюдения / растяжения / слома
      </p>
      <div ref={containerRef} className="absolute inset-0 rounded-xl" />

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-30 max-w-[260px] rounded-lg border border-violet-500/20 bg-slate-950/94 px-3 py-2.5 text-[11px] backdrop-blur-xl"
          style={{
            left: Math.min((containerRef.current?.clientWidth ?? 400) - 270, Math.max(8, tooltip.x + 12)),
            top: Math.max(8, tooltip.y - 8),
          }}
        >
          <p className="font-mono text-cyan-200/90">{tooltip.snapshot.timeLabel}</p>
          {(["SI/CNY", "SI/ED", "CNY/ED"] as const).map((pk) => {
            const sp = pickSpread(pk);
            const z = pickZ(pk);
            if (sp == null && z == null) return null;
            return (
              <div key={pk} className="mt-1.5 flex justify-between gap-2 font-mono">
                <span className="text-slate-500">{pk.replace("/", " − ")}</span>
                <span className="text-slate-200">
                  {sp != null ? formatUnitValueShort(sp, model.effectiveUnitMode) : "—"} · z{" "}
                  {fmtZ(z)}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="pointer-events-none relative z-10 mt-auto flex flex-wrap gap-2 px-3 pb-3 pt-6">
        {model.series.map((s) => (
          <span key={s.ticker} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="h-2 w-5 rounded-full" style={{ background: s.color }} />
            <span>{s.label}</span>
          </span>
        ))}
        <span className="text-[9px] text-slate-600">● растяжение · ● экстрим · ● возврат · ● невозврат</span>
      </div>
    </div>
  );
}
