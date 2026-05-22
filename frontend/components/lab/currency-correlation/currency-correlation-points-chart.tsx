"use client";



import {

  ColorType,

  createChart,

  createSeriesMarkers,

  CrosshairMode,

  LineSeries,

  LineStyle,

  type LineData,

  type SeriesMarker,

  type Time,

} from "lightweight-charts";

import * as React from "react";

import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";

import type {

  CurrencyPointsChartModel,

  PointsTooltipSnapshot,

} from "@/lib/domain/currency-correlation-points-model";

import { getPairConfig } from "@/lib/domain/currency-pair-config";
import {
  formatPairLegValue,
  formatPairSpreadValue,
} from "@/lib/domain/currency-pair-divergence";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { SpreadAnchorMode } from "@/lib/domain/currency-spread-anchor";
import { CurrencyCorrelationSpreadZChart } from "@/components/lab/currency-correlation/currency-correlation-spread-z-chart";
import { CurrencyCorrelationTrajectoryChart } from "@/components/lab/currency-correlation/currency-correlation-trajectory-chart";
import { cn } from "@/lib/utils/cn";



type TooltipState = {

  time: string;

  x: number;

  y: number;

  snapshot: PointsTooltipSnapshot;

} | null;



function toLineData(points: { time: string; value: number }[]): LineData<Time>[] {

  return points

    .filter((p) => Number.isFinite(p.value))

    .map((p) => ({ time: (Number(p.time) || p.time) as Time, value: p.value }));

}



function markersForFamily(

  family: CurrencyCorrelationFamily,

  items: CurrencyPointsChartModel["markers"],

): SeriesMarker<Time>[] {

  return items

    .filter((m) => m.family === family)

    .map((m) => ({

      time: (Number(m.time) || m.time) as Time,

      position: "aboveBar" as const,

      color: m.color,

      shape: "circle" as const,

      text: m.text,

    }));

}



function fmtZ(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

const PAIR_LABEL_TO_KEY: Record<string, PointsPairKey> = {
  "SI − CNY": "SI/CNY",
  "SI − ED": "SI/ED",
  "CNY − ED": "CNY/ED",
};

function fmtSpreadForLabel(label: string, spread: number): string {
  const key = PAIR_LABEL_TO_KEY[label] ?? "SI/CNY";
  return formatPairSpreadValue(spread, getPairConfig(key));
}



function AnchorTooltipRows({
  snapshot,
  focusPair,
}: {
  snapshot: PointsTooltipSnapshot;
  focusPair: PointsPairKey;
}) {
  const config = getPairConfig(focusPair);
  const spread = snapshot.anchorSpread;
  const z = snapshot.anchorZ;
  if (spread == null && z == null) return null;
  return (
    <div className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] text-slate-500">
      <p className="mb-1 text-[9px] uppercase tracking-wide text-cyan-500/70">от якоря</p>
      <div className="flex justify-between gap-2">
        <span>спред</span>
        <span className="font-mono text-slate-200">
          {spread != null && Number.isFinite(spread)
            ? formatPairSpreadValue(spread, config)
            : "—"}
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span>z-score</span>
        <span className="font-mono text-cyan-200/90">{fmtZ(z)}</span>
      </div>
    </div>
  );
}

function TooltipBody({
  model,
  snapshot,
}: {
  model: CurrencyPointsChartModel;
  snapshot: PointsTooltipSnapshot;
}) {
  const focusConfig = getPairConfig(model.focusPair);

  if (model.chartKind === "spread") {

    return (
      <>
      <dl className="mt-2 space-y-1.5 text-[10px] text-slate-500">

        {(

          [

            ["SI − CNY", snapshot.diffSiCny, snapshot.zSiCny],

            ["SI − ED", snapshot.diffSiEd, snapshot.zSiEd],

            ["CNY − ED", snapshot.diffCnyEd, snapshot.zCnyEd],

          ] as const

        ).map(([label, spread, z]) => (

          <div key={label}>

            <div className="flex justify-between gap-2 font-mono">

              <dt className="text-slate-400">{label}</dt>

              <dd className="text-slate-200">

                {spread != null && Number.isFinite(spread)

                  ? fmtSpreadForLabel(label, spread)

                  : "—"}

              </dd>

            </div>

            <div className="flex justify-between gap-2">

              <dt>Отклонение от нормы</dt>

              <dd className="text-cyan-200/90">{fmtZ(z)}</dd>

            </div>

          </div>

        ))}

      </dl>
      <AnchorTooltipRows snapshot={snapshot} focusPair={model.focusPair} />
      </>
    );

  }

  return (

    <>

      <ul className="mt-2 space-y-2">

        {snapshot.rows.map((r) => (

          <li key={r.family} className="text-[11px]">

            <div className="flex items-center justify-between gap-2">

              <span className="flex items-center gap-1.5">

                <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />

                <span className="text-slate-300">{r.family}</span>

              </span>

              <span className="font-mono tabular-nums text-slate-100">

                {formatPairLegValue(r.points, focusConfig)}

              </span>

            </div>


          </li>

        ))}

      </ul>

      <dl className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] text-slate-500">

        {(

          [

            ["SI − CNY", snapshot.diffSiCny, snapshot.zSiCny],

            ["SI − ED", snapshot.diffSiEd, snapshot.zSiEd],

            ["CNY − ED", snapshot.diffCnyEd, snapshot.zCnyEd],

          ] as const

        ).map(([label, spread, z]) => (

          <div key={label} className="mb-1">

            <div className="flex justify-between gap-2">

              <dt>{label}</dt>

              <dd className="font-mono text-slate-300">

                {spread != null && Number.isFinite(spread)

                  ? fmtSpreadForLabel(label, spread)

                  : "—"}

              </dd>

            </div>

            <div className="flex justify-between gap-2">

              <dt>отклонение</dt>

              <dd className="font-mono text-cyan-200/80">{fmtZ(z)}</dd>

            </div>

          </div>

        ))}

      </dl>
      <AnchorTooltipRows snapshot={snapshot} focusPair={model.focusPair} />
    </>

  );

}



export function CurrencyCorrelationPointsChart({
  model,
  className,
  lifecycleFocusPair = "SI/CNY",
  anchorMode,
  onAnchorTimeSelect,
}: {
  model: CurrencyPointsChartModel;
  className?: string;
  lifecycleFocusPair?: PointsPairKey;
  anchorMode?: SpreadAnchorMode;
  onAnchorTimeSelect?: (iso: string | null) => void;
}) {

  if (model.chartKind === "trajectory" && model.trajectory) {
    return (
      <CurrencyCorrelationTrajectoryChart
        model={model}
        trajectory={model.trajectory}
        className={className}
        unitMode={model.effectiveUnitMode}
      />
    );
  }

  if (model.chartKind === "spread" && model.spreadChartUsesZ) {

    return (

      <CurrencyCorrelationSpreadZChart

        model={model}

        className={className}

        focusPair={lifecycleFocusPair}

      />

    );

  }

  const containerRef = React.useRef<HTMLDivElement>(null);

  const [tooltip, setTooltip] = React.useState<TooltipState>(null);



  const minSeries = model.chartKind === "spread" ? 1 : 2;

  const canRender = model.canRenderChart && model.series.length >= minSeries;

  const priceFmt = model.focusPairPriceFormatter;



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

        vertLine: { color: "rgba(34,211,238,0.35)", labelBackgroundColor: "#083344" },

        horzLine: { color: "rgba(34,211,238,0.25)", labelBackgroundColor: "#083344" },

      },

      handleScroll: true,

      handleScale: true,

    });



    for (const s of model.series) {

      const line = chart.addSeries(LineSeries, {

        color: s.color,

        lineWidth: 2,

        priceLineVisible: false,

        lastValueVisible: true,

        crosshairMarkerVisible: true,

        crosshairMarkerRadius: 5,

      });

      line.setData(toLineData(s.data));

      if (model.chartKind === "points") {
        const familyMarkers = markersForFamily(s.family, model.markers);
        if (familyMarkers.length) {
          createSeriesMarkers(line, familyMarkers);
        }
      }

      if (
        model.chartKind === "spread" &&
        model.lifecycleMarkers?.length &&
        s.ticker === model.focusPair
      ) {
        const lifecycleMarkers = model.lifecycleMarkers
          .filter((m) => m.pairKey === model.focusPair)
          .map((m) => ({
            time: (Number(m.time) || m.time) as Time,
            position: "aboveBar" as const,
            color: m.color,
            shape: (m.kind === "outside-week" ? "square" : "circle") as "circle" | "square",
            text: m.text,
          }));
        if (lifecycleMarkers.length) {
          createSeriesMarkers(line, lifecycleMarkers);
        }
      }
    }



    const zero = chart.addSeries(LineSeries, {

      color: "rgba(34,211,238,0.85)",

      lineWidth: 2,

      lineStyle: LineStyle.Solid,

      priceLineVisible: false,

      lastValueVisible: false,

      crosshairMarkerVisible: false,

    });

    zero.setData(model.dates.map((time) => ({ time: (Number(time) || time) as Time, value: 0 })));

    const anchor = model.anchor;
    let anchorLine: HTMLDivElement | null = null;
    let anchorLabel: HTMLDivElement | null = null;
    if (anchor?.chartTime) {
      anchorLine = document.createElement("div");
      anchorLine.className =
        "pointer-events-none absolute top-8 bottom-10 z-[5] w-px bg-cyan-400/55";
      anchorLine.style.boxShadow = "0 0 12px rgba(34,211,238,0.35)";
      anchorLabel = document.createElement("div");
      anchorLabel.className =
        "pointer-events-none absolute z-[6] -translate-x-1/2 rounded bg-cyan-950/90 px-1.5 py-0.5 text-[9px] text-cyan-200/90";
      anchorLabel.textContent = anchor.markerLabel;
      el.style.position = "relative";
      el.appendChild(anchorLine);
      el.appendChild(anchorLabel);

      createSeriesMarkers(zero, [
        {
          time: (Number(anchor.chartTime) || anchor.chartTime) as Time,
          position: "inBar",
          color: "rgba(34,211,238,0.9)",
          shape: "circle",
          text: anchor.markerLabel,
        },
      ]);

      const updateAnchorOverlay = () => {
        const x = chart.timeScale().timeToCoordinate(
          (Number(anchor.chartTime) || anchor.chartTime) as Time,
        );
        if (x == null || !anchorLine || !anchorLabel) {
          if (anchorLine) anchorLine.style.display = "none";
          if (anchorLabel) anchorLabel.style.display = "none";
          return;
        }
        anchorLine.style.display = "block";
        anchorLabel.style.display = "block";
        anchorLine.style.left = `${x}px`;
        anchorLabel.style.left = `${x}px`;
        anchorLabel.style.top = "28px";
      };

      chart.timeScale().subscribeVisibleLogicalRangeChange(updateAnchorOverlay);
      updateAnchorOverlay();
    }

    chart.applyOptions({

      localization: {

        locale: "ru-RU",

        priceFormatter: priceFmt,

      },

    });



    chart.subscribeCrosshairMove((param) => {

      if (!param.time || param.point == null || param.point.x < 0 || param.point.y < 0) {

        setTooltip(null);

        return;

      }

      const time = String(param.time);

      const snapshot = model.tooltipIndex.get(time);

      if (!snapshot) {

        setTooltip(null);

        return;

      }

      setTooltip({ time, x: param.point.x, y: param.point.y, snapshot });

    });

    chart.subscribeClick((param) => {
      if (!param.time || anchorMode !== "manual" || !onAnchorTimeSelect) return;
      const iso = model.isoByChartTime.get(String(param.time));
      if (iso) onAnchorTimeSelect(iso);
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
      anchorLine?.remove();
      anchorLabel?.remove();
      chart.remove();
    };

  }, [model, canRender, priceFmt, anchorMode, onAnchorTimeSelect]);



  if (!canRender) {

    return (

      <div className={cn("flex min-h-[min(42vh,380px)] flex-col items-center justify-center px-4 py-8 text-center", className)}>

        <p className="text-sm font-medium text-slate-400">

          {model.diagnosticMessage ?? "Недостаточно общих интрадей-свечей для графика"}

        </p>

        {model.intervalNotice ? (

          <p className="mt-2 text-xs text-amber-300/85">{model.intervalNotice}</p>

        ) : null}

        {model.unitWarning ? (

          <p className="mt-2 text-xs text-amber-300/85">{model.unitWarning}</p>

        ) : null}

        <p className="mt-2 text-xs text-slate-600">

          Общих timestamp: {model.commonTimestamps} · SI {model.tickersByFamily.SI ?? "—"} · CNY{" "}

          {model.tickersByFamily.CNY ?? "—"} · ED {model.tickersByFamily.ED ?? "—"}

        </p>

      </div>

    );

  }



  return (

    <div className={cn("relative flex min-h-[min(58vh,520px)] flex-col", className)}>

      <div

        ref={containerRef}

        className="absolute inset-0 rounded-xl"

        style={{ boxShadow: "inset 0 0 80px rgba(34,211,238,0.05)" }}

      />



      {tooltip ? (

        <div

          className="pointer-events-none absolute z-30 max-w-[280px] rounded-lg border border-cyan-500/20 bg-slate-950/94 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl"

          style={{

            left: Math.min(

              (containerRef.current?.clientWidth ?? 400) - 290,

              Math.max(8, tooltip.x + 12),

            ),

            top: Math.max(8, tooltip.y - 8),

          }}

        >

          <p className="font-mono text-[11px] text-cyan-200/90">{tooltip.snapshot.timeLabel}</p>

          <TooltipBody model={model} snapshot={tooltip.snapshot} />

        </div>

      ) : null}



      <div className="pointer-events-none relative z-10 mt-auto flex flex-wrap gap-3 px-3 pb-3 pt-2">

        {model.series.map((s) => (

          <span key={`${s.family}-${s.ticker}`} className="flex items-center gap-1.5 text-[10px] text-slate-500">

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

