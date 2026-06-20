"use client";

import * as React from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  LineStyle,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type {
  CbrChartCandle,
  CbrChartRenderMode,
  CbrChartSlot,
  CbrChartSlotBadgeLabel,
  CbrEventMarker,
} from "@/lib/domain/cbr-rate-chart-model";
import {
  candleDayChangePct,
  CBR_MOEX_ZERO_CANDLES_REASON,
  resolveCbrChartSlotBadge,
} from "@/lib/domain/cbr-rate-chart-model";
import type { CbrCockpitPhaseId } from "@/lib/domain/cbr-rate-cockpit";
import {
  phaseHighlightPercents,
  resolvePhaseHighlightUnix,
} from "@/lib/domain/cbr-rate-cockpit";
import { formatMskTimeLabel } from "@/lib/domain/cbr-rate-event-window";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import { CBR_REPLAY_MODE_LABELS } from "@/lib/cbr/cbr-replay-market-mode";
import { cn } from "@/lib/utils/cn";

const CHART_HEIGHT = 168;

const TERMINAL_CHART_OPTIONS = {
  layout: {
    background: { type: ColorType.Solid, color: "transparent" },
    textColor: "#64748b",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 10,
  },
  grid: {
    vertLines: { color: "rgba(100,116,139,0.07)" },
    horzLines: { color: "rgba(100,116,139,0.07)" },
  },
  rightPriceScale: {
    borderVisible: false,
    scaleMargins: { top: 0.12, bottom: 0.08 },
  },
  timeScale: {
    borderVisible: false,
    fixLeftEdge: true,
    fixRightEdge: true,
    timeVisible: true,
    secondsVisible: false,
  },
  crosshair: {
    mode: CrosshairMode.Magnet,
    vertLine: { color: "rgba(148,163,184,0.45)", style: LineStyle.Dashed, width: 1 },
    horzLine: { color: "rgba(148,163,184,0.25)", style: LineStyle.Dashed, width: 1 },
  },
  handleScroll: false,
  handleScale: false,
} as const;

type MarkerOverlayLine = {
  id: string;
  x: number;
  label: string;
  emphasis: boolean;
};

function toCandleData(candles: CbrChartCandle[]): CandlestickData<Time>[] {
  return candles.map((c) => ({
    time: c.time as Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function buildMarkerOverlays(chart: IChartApi, markers: CbrEventMarker[]): MarkerOverlayLine[] {
  const ts = chart.timeScale();
  const lines: MarkerOverlayLine[] = [];
  for (const m of markers) {
    const coord = ts.timeToCoordinate(m.timeUnix as Time);
    if (coord == null || !Number.isFinite(coord)) continue;
    lines.push({
      id: m.id,
      x: coord as number,
      label: `${m.timeMsk} ${m.label}`,
      emphasis: m.id === "decision",
    });
  }
  return lines;
}

function EventMarkerOverlay({ lines }: { lines: MarkerOverlayLine[] }) {
  if (!lines.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {lines.map((line) => (
        <div
          key={line.id}
          className={cn(
            "absolute inset-y-0 w-0",
            line.emphasis ? "border-l border-amber-400/55" : "border-l border-dashed border-violet-400/40",
          )}
          style={{ left: line.x }}
        >
          <span
            className={cn(
              "absolute top-1 max-w-[72px] whitespace-pre-wrap text-[7px] leading-tight tracking-wide",
              line.emphasis ? "text-amber-300/80" : "text-violet-300/65",
            )}
            style={{ transform: "translateX(-4px)" }}
          >
            {line.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function PhaseHighlightOverlay({
  windowStartUnix,
  windowEndUnix,
  phaseFromUnix,
  phaseToUnix,
}: {
  windowStartUnix: number;
  windowEndUnix: number;
  phaseFromUnix: number;
  phaseToUnix: number;
}) {
  const band = phaseHighlightPercents(windowStartUnix, windowEndUnix, phaseFromUnix, phaseToUnix);
  if (!band) return null;
  return (
    <div
      className="pointer-events-none absolute inset-y-0 rounded-sm bg-cyan-400/10 ring-1 ring-inset ring-cyan-400/25"
      style={{ left: `${band.leftPct}%`, width: `${band.widthPct}%` }}
      aria-hidden
    />
  );
}

export function CbrReactionIntradayChart({
  slot,
  markers,
  window,
  renderMode,
  syncTime,
  slotId,
  onSyncTime,
  loading,
  activePhase,
  eventDate,
  focused,
  compact,
  showDataBadge = true,
  marketSegment,
}: {
  slot: CbrChartSlot;
  markers: CbrEventMarker[];
  window: { startUnix: number; endUnix: number };
  renderMode: CbrChartRenderMode;
  syncTime: Time | null;
  slotId: string;
  onSyncTime: (time: Time | null, sourceId: string) => void;
  loading?: boolean;
  activePhase?: import("@/lib/domain/cbr-rate-cockpit").CbrCockpitPhaseId;
  eventDate?: string;
  focused?: boolean;
  compact?: boolean;
  showDataBadge?: boolean;
  marketSegment?: CbrReplayMarketMode;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<IChartApi | null>(null);
  const seriesRef = React.useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Area"> | null>(null);
  const [markerLines, setMarkerLines] = React.useState<MarkerOverlayLine[]>([]);
  const suppressSyncRef = React.useRef(false);

  const dayChange = candleDayChangePct(slot.candles);
  const badge = resolveCbrChartSlotBadge(slot, { loading });
  const canRender = badge.showChart && !slot.placeholder && slot.candles.length >= 2;

  const refreshOverlays = React.useCallback(
    (chart: IChartApi) => {
      setMarkerLines(buildMarkerOverlays(chart, markers));
    },
    [markers],
  );

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !canRender) {
      setMarkerLines([]);
      return;
    }

    const chart = createChart(el, {
      ...TERMINAL_CHART_OPTIONS,
      width: el.clientWidth,
      height: CHART_HEIGHT,
    });

    let series: ISeriesApi<"Candlestick"> | ISeriesApi<"Area">;

    if (renderMode === "area") {
      series = chart.addSeries(AreaSeries, {
        lineColor: "rgba(56,189,248,0.85)",
        topColor: "rgba(56,189,248,0.22)",
        bottomColor: "rgba(56,189,248,0.02)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      series.setData(
        slot.candles.map((c) => ({
          time: c.time as Time,
          value: c.close,
        })),
      );
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: "rgba(52,211,153,0.9)",
        downColor: "rgba(251,113,133,0.9)",
        borderUpColor: "rgba(52,211,153,0.35)",
        borderDownColor: "rgba(251,113,133,0.35)",
        wickUpColor: "rgba(52,211,153,0.55)",
        wickDownColor: "rgba(251,113,133,0.55)",
        priceLineVisible: false,
      });
      series.setData(toCandleData(slot.candles));
    }

    chart.timeScale().setVisibleRange({
      from: window.startUnix as Time,
      to: window.endUnix as Time,
    });

    const onCrosshair = (param: { time?: Time; point?: { x: number; y: number } }) => {
      if (suppressSyncRef.current) return;
      if (!param.time) {
        onSyncTime(null, slotId);
        return;
      }
      onSyncTime(param.time, slotId);
    };

    chart.subscribeCrosshairMove(onCrosshair);

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
      refreshOverlays(chart);
    });
    ro.observe(el);

    chartRef.current = chart;
    seriesRef.current = series;
    refreshOverlays(chart);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [canRender, slot.candles, renderMode, window.startUnix, window.endUnix, refreshOverlays, slotId, onSyncTime]);

  React.useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    if (syncTime == null) {
      chart.clearCrosshairPosition();
      return;
    }

    const match =
      slot.candles.find((c) => c.time === syncTime) ??
      slot.candles.reduce<CbrChartCandle | null>((best, c) => {
        if (!best) return c;
        return Math.abs(c.time - (syncTime as number)) < Math.abs(best.time - (syncTime as number))
          ? c
          : best;
      }, null);

    if (!match) return;

    suppressSyncRef.current = true;
    chart.setCrosshairPosition(match.close, syncTime, series);
    requestAnimationFrame(() => {
      suppressSyncRef.current = false;
    });
  }, [syncTime, slot.candles]);

  const phaseHighlight =
    activePhase && eventDate ? resolvePhaseHighlightUnix(eventDate, activePhase) : null;

  if (slot.placeholder || !badge.showChart) {
    return (
      <LabGlassPanel
        depth={10}
        className={cn("relative flex flex-col p-2", focused && "ring-1 ring-lab-cyan/40")}
      >
        <ChartCardHeader slot={slot} dayChange={null} loading={loading} compact={compact} marketSegment={marketSegment} />
        <div className="relative mt-1.5">
          {!loading && showDataBadge ? (
            <ChartDataBadge label={badge.label} className="absolute right-1 top-1 z-10" />
          ) : null}
          <div className="flex h-[168px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-lab-border/40 bg-lab-bg-deep/30 px-3 text-center">
            <p className="text-[11px] font-medium text-lab-text">{slot.title}</p>
            <p className="font-mono text-[9px] text-lab-dim">{slot.ticker}</p>
            {!loading ? (
              <p className="mt-1 max-w-[240px] text-[10px] leading-snug text-lab-muted">
                {slot.placeholderReason ?? slot.error ?? CBR_MOEX_ZERO_CANDLES_REASON}
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-lab-dim">Загрузка MOEX ISS…</p>
            )}
          </div>
        </div>
      </LabGlassPanel>
    );
  }

  return (
    <LabGlassPanel
      depth={10}
      className={cn("flex flex-col p-2", focused && "ring-1 ring-lab-cyan/40")}
    >
        <ChartCardHeader slot={slot} dayChange={dayChange} loading={loading} compact={compact} marketSegment={marketSegment} />
      <div className="relative mt-1.5 overflow-hidden rounded-md border border-lab-border/35 bg-black/25">
        {showDataBadge ? (
          <ChartDataBadge label={badge.label} className="absolute right-1 top-1 z-10" />
        ) : null}
        <div ref={containerRef} className="h-[168px] w-full" />
        {phaseHighlight ? (
          <PhaseHighlightOverlay
            windowStartUnix={window.startUnix}
            windowEndUnix={window.endUnix}
            phaseFromUnix={phaseHighlight.fromUnix}
            phaseToUnix={phaseHighlight.toUnix}
          />
        ) : null}
        <EventMarkerOverlay lines={markerLines} />
      </div>
      {!compact ? (
        <p className="mt-1 font-mono text-[8px] text-lab-dim">
          10:00–19:00 MSK · {formatMskTimeLabel(window.startUnix)} – {formatMskTimeLabel(window.endUnix)}
        </p>
      ) : null}
    </LabGlassPanel>
  );
}

function ChartCardHeader({
  slot,
  dayChange,
  loading,
  compact,
  marketSegment,
}: {
  slot: CbrChartSlot;
  dayChange: number | null;
  loading?: boolean;
  compact?: boolean;
  marketSegment?: CbrReplayMarketMode;
}) {
  const tone =
    dayChange != null && dayChange > 0.05
      ? "text-emerald-400/90"
      : dayChange != null && dayChange < -0.05
        ? "text-rose-400/90"
        : "text-lab-muted";

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-lab-text">{slot.title}</p>
        <p className="font-mono text-[9px] text-lab-dim">
          {slot.currencyResolvedType
            ? slot.ticker
            : (slot.resolvedSecid ?? slot.ticker)}
          {!slot.currencyResolvedType &&
          slot.resolvedSecid &&
          slot.resolvedSecid !== slot.ticker
            ? ` · ${slot.ticker}`
            : ""}
          {marketSegment ? ` · ${CBR_REPLAY_MODE_LABELS[marketSegment]}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {dayChange != null ? (
          <span className={cn("font-mono text-xs font-semibold tabular-nums", tone)}>
            {dayChange >= 0 ? "+" : ""}
            {dayChange.toFixed(2)}%
          </span>
        ) : loading ? (
          <span className="text-[9px] text-lab-dim">…</span>
        ) : null}
      </div>
    </div>
  );
}

const BADGE_TONE: Record<CbrChartSlotBadgeLabel, string> = {
  MOEX: "border-emerald-400/35 bg-emerald-500/12 text-emerald-200/95",
  "NO DATA": "border-lab-border/45 bg-lab-bg-deep/70 text-lab-dim",
  ERROR: "border-rose-400/35 bg-rose-500/12 text-rose-200/95",
  INCOMPLETE: "border-violet-400/35 bg-violet-500/10 text-violet-200/90",
};

function ChartDataBadge({ label, className }: { label: CbrChartSlotBadgeLabel; className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none inline-flex h-4 items-center rounded border px-1",
        "text-[7px] font-semibold uppercase leading-none tracking-wide backdrop-blur-sm",
        BADGE_TONE[label],
        className,
      )}
    >
      {label === "NO DATA" ? "NO DATA" : label}
    </span>
  );
}
