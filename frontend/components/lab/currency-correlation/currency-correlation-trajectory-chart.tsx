"use client";

import {
  ColorType,
  createChart,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import * as React from "react";
import type { CurrencyPointsChartModel } from "@/lib/domain/currency-correlation-points-model";
import type { SpreadTrajectoryBundle } from "@/lib/domain/spread-trajectory";
import { formatUnitValueShort } from "@/lib/domain/currency-spread-units";
import { LIFECYCLE_ZONE_LEVELS } from "@/lib/domain/spread-lifecycle";
import { cn } from "@/lib/utils/cn";

function toLineData(points: { time: string; value: number }[]): LineData<Time>[] {
  return points
    .filter((p) => Number.isFinite(p.value))
    .map((p) => ({ time: (Number(p.time) || p.time) as Time, value: p.value }));
}

function addZoneLines(line: ISeriesApi<"Line">) {
  for (const zone of LIFECYCLE_ZONE_LEVELS) {
    line.createPriceLine({
      price: zone.z,
      color: zone.color,
      lineWidth: zone.z === 0 ? 2 : 1,
      lineStyle: zone.z === 0 ? LineStyle.Solid : LineStyle.Dotted,
      axisLabelVisible: zone.z !== 0,
      title: zone.z === 0 ? zone.label : zone.label,
    });
  }
}

function fmtZ(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

export function CurrencyCorrelationTrajectoryChart({
  model,
  trajectory,
  className,
  unitMode,
}: {
  model: CurrencyPointsChartModel;
  trajectory: SpreadTrajectoryBundle;
  className?: string;
  unitMode: CurrencyPointsChartModel["effectiveUnitMode"];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<{
    x: number;
    y: number;
    snap: ReturnType<SpreadTrajectoryBundle["tooltipIndex"]["get"]>;
  } | null>(null);

  const canRender =
    model.canRenderChart && trajectory.segmentSeries.some((s) => s.data.length >= 2);

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
        vertLines: { color: "rgba(148,163,184,0.05)" },
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
    for (const seg of trajectory.segmentSeries) {
      if (seg.data.length < 1) continue;
      const line = chart.addSeries(LineSeries, {
        color: seg.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
      });
      line.setData(toLineData(seg.data));
      if (!zonesDrawn) {
        addZoneLines(line);
        zonesDrawn = true;
      }
    }

    chart.applyOptions({
      localization: {
        locale: "ru-RU",
        priceFormatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} z`,
      },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || param.point == null || param.point.x < 0) {
        setHover(null);
        return;
      }
      const snap = trajectory.tooltipIndex.get(String(param.time));
      if (!snap) {
        setHover(null);
        return;
      }
      setHover({ x: param.point.x, y: param.point.y, snap });
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
  }, [model, trajectory, canRender]);

  if (!canRender) {
    return (
      <div
        className={cn(
          "flex min-h-[min(42vh,380px)] items-center justify-center text-sm text-slate-500",
          className,
        )}
      >
        {model.diagnosticMessage ?? "Недостаточно данных для траектории"}
      </div>
    );
  }

  return (
    <div className={cn("relative flex min-h-[min(58vh,520px)] flex-col", className)}>
      <p className="pointer-events-none absolute inset-x-0 top-7 z-20 px-3 text-[9px] text-slate-600">
        {trajectory.pairLabel} · ось z-score · цвет линии = состояние lifecycle
      </p>
      <div ref={containerRef} className="absolute inset-0 rounded-xl" />

      {hover?.snap ? (
        <div
          className="pointer-events-none absolute z-30 max-w-[260px] rounded-lg border border-violet-500/25 bg-slate-950/94 px-3 py-2.5 text-[11px] backdrop-blur-xl"
          style={{
            left: Math.min((containerRef.current?.clientWidth ?? 400) - 270, Math.max(8, hover.x + 12)),
            top: Math.max(8, hover.y - 8),
          }}
        >
          <p className="font-mono text-cyan-200/90">{hover.snap.timeLabel}</p>
          <dl className="mt-2 space-y-1 text-slate-400">
            <div className="flex justify-between gap-2">
              <dt>Спред</dt>
              <dd className="font-mono text-slate-100">
                {hover.snap.spreadPoints != null
                  ? formatUnitValueShort(hover.snap.spreadPoints, unitMode)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>z-score</dt>
              <dd className="font-mono text-cyan-200/90">{fmtZ(hover.snap.zScore)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Состояние</dt>
              <dd>{hover.snap.stateLabel}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>В состоянии</dt>
              <dd className="font-mono">{hover.snap.barsInState} св.</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Ближайшая зона</dt>
              <dd className="text-right">{hover.snap.nearestZone}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="pointer-events-none relative z-10 mt-auto flex flex-wrap gap-2 px-3 pb-3 pt-8">
        {trajectory.segmentSeries.map((seg) => (
          <span key={seg.state} className="flex items-center gap-1 text-[9px] text-slate-500">
            <span className="h-2 w-4 rounded-full" style={{ background: seg.color }} />
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
