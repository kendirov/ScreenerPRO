"use client";

import {
  ColorType,
  createChart,
  CrosshairMode,
  LineSeries,
  type LineData,
  type Time,
} from "lightweight-charts";
import * as React from "react";
import type { WeeklySpreadSeries } from "@/lib/domain/currency-correlation-weeks";
import { getPairConfig } from "@/lib/domain/currency-pair-config";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import { formatPairSpreadValue } from "@/lib/domain/currency-pair-divergence";
import { cn } from "@/lib/utils/cn";

export type WeekChartMode = "single" | "compare";

const GHOST_COLORS = [
  "rgba(148, 163, 184, 0.45)",
  "rgba(167, 139, 250, 0.35)",
  "rgba(251, 191, 36, 0.35)",
  "rgba(244, 114, 182, 0.35)",
];

const CURRENT_COLOR = "rgba(34, 211, 238, 0.95)";

function toLineData(
  points: WeeklySpreadSeries["points"],
): LineData<Time>[] {
  return points
    .filter((p) => Number.isFinite(p.spreadPoints))
    .map((p) => ({
      time: p.minuteOfWeek as Time,
      value: p.spreadPoints,
    }));
}

function formatMinuteLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  if (h === 0 && m === 0) return "пн 0:00";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function CurrencyCorrelationWeeksChart({
  weeks,
  pairKey,
  mode,
  selectedOffset,
  className,
}: {
  weeks: WeeklySpreadSeries[];
  pairKey: PointsPairKey;
  mode: WeekChartMode;
  selectedOffset: number;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const config = getPairConfig(pairKey);
  const priceFmt = React.useCallback(
    (v: number) => formatPairSpreadValue(v, config).replace(/\s/g, " "),
    [config],
  );

  const seriesToShow = React.useMemo(() => {
    if (mode === "single") {
      const w = weeks[selectedOffset];
      return w ? [{ week: w, ghost: false, index: selectedOffset }] : [];
    }
    return [...weeks]
      .map((week, index) => ({
        week,
        ghost: index > 0,
        index,
      }))
      .reverse() as { week: WeeklySpreadSeries; ghost: boolean; index: number }[];
  }, [weeks, mode, selectedOffset]);

  const canRender = seriesToShow.some((s) => s.week.points.length >= 2);

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

    for (const item of seriesToShow) {
      const data = toLineData(item.week.points);
      if (data.length < 2) continue;
      const color =
        mode === "compare"
          ? item.ghost
            ? GHOST_COLORS[(item.index ?? 1) % GHOST_COLORS.length]!
            : CURRENT_COLOR
          : CURRENT_COLOR;
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: item.ghost ? 1 : 2,
        priceLineVisible: false,
        lastValueVisible: !item.ghost,
        crosshairMarkerVisible: !item.ghost,
      });
      line.setData(data);
    }

    chart.applyOptions({
      localization: {
        locale: "ru-RU",
        priceFormatter: priceFmt,
        timeFormatter: (t: number) => formatMinuteLabel(Number(t)),
      },
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
  }, [seriesToShow, canRender, mode, priceFmt]);

  if (!canRender) {
    return (
      <div
        className={cn(
          "flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-white/[0.08] px-4 text-center text-[11px] text-slate-500",
          className,
        )}
      >
        Недостаточно точек за выбранную неделю для графика спреда.
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-[240px]", className)}>
      <div ref={containerRef} className="absolute inset-0 rounded-lg" />
      <div className="pointer-events-none relative z-10 flex flex-wrap gap-2 px-2 pb-2 pt-1">
        {seriesToShow.map(({ week, ghost }) =>
          week.points.length >= 2 ? (
            <span
              key={week.weekStart}
              className={cn(
                "flex items-center gap-1 text-[10px]",
                ghost ? "text-slate-500" : "text-cyan-200/90",
              )}
            >
              <span
                className="h-0.5 w-4 rounded-full"
                style={{
                  background: ghost
                    ? GHOST_COLORS[1]
                    : CURRENT_COLOR,
                  opacity: ghost ? 0.6 : 1,
                }}
              />
              {week.weekLabel}
            </span>
          ) : null,
        )}
      </div>
      <p className="pointer-events-none absolute bottom-1 right-2 text-[9px] text-slate-600">
        ось X: минуты от понедельника 00:00 (МСК)
      </p>
    </div>
  );
}
