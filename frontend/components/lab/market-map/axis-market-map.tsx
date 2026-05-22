"use client";

import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import * as React from "react";
import { LabEmptyState } from "@/components/lab/lab-ui";
import { MapReadingPills } from "@/components/lab/market-map/map-reading-pills";
import { MarketLabInspector } from "@/components/lab/market-map/market-lab-inspector";
import { ZoneLeadersPanel } from "@/components/lab/market-map/zone-leaders-panel";
import type { MarketLabNode, MarketLabStatus } from "@/lib/domain/market-lab";
import {
  classifySemanticZone,
  explainWhyHere,
  getZoneLabel,
  pickZoneLeaders,
  SEMANTIC_ZONE_META,
  type NodePlacement,
} from "@/lib/domain/market-map-semantics";
import { formatMoneyShort, formatSignedPct } from "@/lib/domain/market-lab";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

export type AxisXMetric = "turnover" | "trades" | "impulse" | "range";
export type AxisYMetric = "changePct" | "trades" | "range" | "turnover" | "impulse";
export type AxisSizeMetric = "turnover" | "trades" | "absImpulse";
export type AxisColorMetric = "changePct" | "impulse" | "status";

export type AxisMapConfig = {
  x: AxisXMetric;
  y: AxisYMetric;
  size: AxisSizeMetric;
  color: AxisColorMetric;
};

export const AXIS_X_LABELS: Record<AxisXMetric, string> = {
  turnover: "Оборот",
  trades: "Сделки",
  impulse: "Денежный импульс",
  range: "Ход",
};

export const AXIS_Y_LABELS: Record<AxisYMetric, string> = {
  changePct: "Изменение %",
  trades: "Сделки",
  range: "Ход",
  turnover: "Оборот",
  impulse: "Денежный импульс",
};

export const AXIS_SIZE_LABELS: Record<AxisSizeMetric, string> = {
  turnover: "Оборот",
  trades: "Сделки",
  absImpulse: "Абс. импульс",
};

export const AXIS_COLOR_LABELS: Record<AxisColorMetric, string> = {
  changePct: "Изменение %",
  impulse: "Денежный импульс",
  status: "Статус",
};

const DEFAULT_CONFIG: AxisMapConfig = {
  x: "turnover",
  y: "changePct",
  size: "trades",
  color: "changePct",
};

type AxisPreset = { id: string; label: string; tagline: string; config: AxisMapConfig };

export const AXIS_PRESETS: AxisPreset[] = [
  {
    id: "money",
    label: "Где деньги?",
    tagline: "оборот и движение",
    config: { x: "turnover", y: "changePct", size: "trades", color: "changePct" },
  },
  {
    id: "play",
    label: "Где игра?",
    tagline: "сделки, ход, активность",
    config: { x: "trades", y: "range", size: "turnover", color: "status" },
  },
  {
    id: "pressure",
    label: "Где давление?",
    tagline: "оборот против импульса",
    config: { x: "turnover", y: "impulse", size: "absImpulse", color: "impulse" },
  },
];

const MARGIN = { top: 40, right: 28, bottom: 52, left: 52 };
const PLOT_INSET = 12;
const MIN_BUBBLE_R = 7;
const MAX_BUBBLE_R = 40;
const LABEL_TOP_N = 5;
const WINSORIZE_PCT = 0.02;
const ZOOM_SCALE_MIN = 0.5;
const ZOOM_SCALE_MAX = 5;
const GRID_TICKS = 5;
const PERCENTILE_TICKS = [0, 25, 50, 75, 100];

type MetricKey = AxisXMetric | AxisYMetric | AxisSizeMetric | "absImpulse";

function metricValue(node: MarketLabNode, key: MetricKey): number {
  switch (key) {
    case "turnover":
      return node.turnoverRub;
    case "trades":
      return node.tradesCount;
    case "impulse":
      return node.moveWeightRub;
    case "absImpulse":
      return node.absMoveWeightRub;
    case "range":
      return node.rangePct ?? 0;
    case "changePct":
      return node.changePct;
    default:
      return 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function winsorizeBounds(values: number[], pct = WINSORIZE_PCT): [number, number] {
  if (!values.length) return [0, 1];
  const sorted = [...values].sort((a, b) => a - b);
  const loIdx = Math.floor(sorted.length * pct);
  const hiIdx = Math.ceil(sorted.length * (1 - pct)) - 1;
  return [sorted[loIdx] ?? sorted[0]!, sorted[hiIdx] ?? sorted[sorted.length - 1]!];
}

function buildPercentileRank(nodes: MarketLabNode[], key: MetricKey): Map<string, number> {
  const sorted = [...nodes].sort((a, b) => metricValue(a, key) - metricValue(b, key));
  const n = sorted.length;
  const map = new Map<string, number>();
  sorted.forEach((node, i) => {
    const pct = n <= 1 ? 50 : (i / (n - 1)) * 100;
    map.set(node.ticker, pct);
  });
  return map;
}

function usesPercentileY(key: MetricKey): boolean {
  return key === "turnover" || key === "trades" || key === "impulse";
}

function isSignedMetric(key: MetricKey): boolean {
  return key === "changePct" || key === "impulse";
}

function realValueDomain(nodes: MarketLabNode[], key: MetricKey): [number, number] {
  const values = nodes.map((n) => metricValue(n, key));
  if (!values.length) return [0, 1];

  if (key === "changePct") {
    const [lo, hi] = winsorizeBounds(values.map(Math.abs), WINSORIZE_PCT);
    const absMax = Math.max(lo, hi, 0.35);
    return [-absMax, absMax];
  }

  if (key === "impulse") {
    const [lo, hi] = winsorizeBounds(values, WINSORIZE_PCT);
    const absMax = Math.max(Math.abs(lo), Math.abs(hi), 1);
    return [-absMax, absMax];
  }

  const [wLo, wHi] = winsorizeBounds(values, WINSORIZE_PCT);
  return [Math.min(wLo, 0), Math.max(wHi, wLo + 0.01)];
}

function linearMap(value: number, domain: [number, number], outMin: number, outMax: number): number {
  const [d0, d1] = domain;
  const v = clamp(value, d0, d1);
  const t = d1 > d0 ? (v - d0) / (d1 - d0) : 0.5;
  return outMin + t * (outMax - outMin);
}

function percentileMap(value: number, outMin: number, outMax: number): number {
  return outMin + (clamp(value, 0, 100) / 100) * (outMax - outMin);
}

function tickValuesReal(domain: [number, number], key: MetricKey): number[] {
  const [d0, d1] = domain;
  if (isSignedMetric(key)) {
    const max = Math.max(Math.abs(d0), Math.abs(d1));
    const step = max / 2;
    return [-max, -step, 0, step, max].filter((v, i, arr) => arr.indexOf(v) === i);
  }
  const step = (d1 - d0) / (GRID_TICKS - 1);
  return Array.from({ length: GRID_TICKS }, (_, i) => d0 + step * i);
}

function formatAxisTick(key: MetricKey, value: number): string {
  if (key === "changePct") return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
  if (key === "range") return `${value.toFixed(1)}%`;
  if (key === "impulse") return formatMoneyShort(value, { signed: true });
  if (key === "absImpulse") return formatMoneyShort(value);
  if (key === "turnover") return formatTurnoverCompact(value);
  if (key === "trades") return tradingFormat.formatInteger(value);
  return String(value);
}

function formatPercentileTick(pct: number): string {
  if (pct === 0) return "слабее";
  if (pct === 50) return "медиана";
  if (pct === 100) return "сильнее";
  return `${pct}%`;
}

function presetAxisSummary(config: AxisMapConfig): string {
  return `${AXIS_X_LABELS[config.x]} → X, ${AXIS_Y_LABELS[config.y].toLowerCase()} → Y, размер = ${AXIS_SIZE_LABELS[config.size].toLowerCase()}`;
}

function useSemanticZones(config: AxisMapConfig): boolean {
  return config.x === "turnover" && config.y === "changePct";
}

const STATUS_STYLE: Record<
  MarketLabStatus,
  { background: string; border: string; text: string }
> = {
  "в игре": {
    background: "rgba(8,47,73,0.55)",
    border: "rgba(34,211,238,0.35)",
    text: "text-cyan-200",
  },
  ликвидный: {
    background: "rgba(6,78,59,0.45)",
    border: "rgba(52,211,153,0.3)",
    text: "text-emerald-200",
  },
  движение: {
    background: "rgba(69,26,3,0.45)",
    border: "rgba(251,191,36,0.28)",
    text: "text-amber-200",
  },
  тихо: {
    background: "rgba(15,23,42,0.55)",
    border: "rgba(148,163,184,0.18)",
    text: "text-slate-400",
  },
  неликвид: {
    background: "rgba(76,5,25,0.4)",
    border: "rgba(251,113,133,0.25)",
    text: "text-rose-300",
  },
};

function bubbleColor(node: MarketLabNode, metric: AxisColorMetric) {
  if (metric === "status") return STATUS_STYLE[node.status];

  if (metric === "impulse") {
    const w = node.moveWeightRub;
    const intensity = Math.min(1, Math.abs(w) / Math.max(Math.abs(node.turnoverRub) * 0.02, 1));
    if (w > 0) {
      return {
        background: `rgba(6,78,59,${0.28 + intensity * 0.32})`,
        border: `rgba(52,211,153,${0.22 + intensity * 0.28})`,
        text: "text-emerald-300",
      };
    }
    if (w < 0) {
      return {
        background: `rgba(127,29,29,${0.28 + intensity * 0.28})`,
        border: `rgba(251,113,133,${0.22 + intensity * 0.28})`,
        text: "text-rose-300",
      };
    }
    return STATUS_STYLE.тихо;
  }

  const pct = node.changePct;
  const intensity = Math.min(1, Math.abs(pct) / 2.5);
  if (pct > 0.04) {
    return {
      background: `rgba(6,78,59,${0.22 + intensity * 0.38})`,
      border: `rgba(52,211,153,${0.2 + intensity * 0.3})`,
      text: "text-emerald-300",
    };
  }
  if (pct < -0.04) {
    return {
      background: `rgba(127,29,29,${0.22 + intensity * 0.34})`,
      border: `rgba(251,113,133,${0.2 + intensity * 0.28})`,
      text: "text-rose-300",
    };
  }
  return STATUS_STYLE.тихо;
}

type PlottedPoint = {
  node: MarketLabNode;
  px: number;
  py: number;
  r: number;
  colors: ReturnType<typeof bubbleColor>;
  showLabel: boolean;
};

function fitTransformToPoints(
  points: PlottedPoint[],
  width: number,
  height: number,
  padding = 48,
): ZoomTransform {
  if (!points.length) return zoomIdentity;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.px - p.r);
    maxX = Math.max(maxX, p.px + p.r);
    minY = Math.min(minY, p.py - p.r);
    maxY = Math.max(maxY, p.py + p.r);
  }
  const bw = Math.max(maxX - minX, 80);
  const bh = Math.max(maxY - minY, 80);
  const k = clamp(Math.min((width - padding * 2) / bw, (height - padding * 2) / bh), ZOOM_SCALE_MIN, ZOOM_SCALE_MAX);
  const tx = (width - bw * k) / 2 - minX * k;
  const ty = (height - bh * k) / 2 - minY * k;
  return zoomIdentity.translate(tx, ty).scale(k);
}

function AxisSelect<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-[0.12em] text-slate-600">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] transition",
              value === opt
                ? "border-violet-500/30 bg-violet-950/40 text-violet-100"
                : "border-white/5 bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
            )}
          >
            {labels[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}

function AxisTooltip({
  node,
  style,
  whyHere,
}: {
  node: MarketLabNode;
  style: React.CSSProperties;
  whyHere?: string | null;
}) {
  const change = node.changePct;
  return (
    <div
      className="pointer-events-none absolute z-30 min-w-[200px] rounded-xl border border-white/10 bg-slate-950/92 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl"
      style={style}
    >
      <p className="text-lg font-semibold tracking-wide text-white">{node.ticker}</p>
      <dl className="mt-2 space-y-1 text-[11px]">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Изменение</dt>
          <dd className={cn("font-mono tabular-nums", change > 0 ? "text-emerald-300" : change < 0 ? "text-rose-300" : "text-slate-400")}>
            {formatSignedPct(node.changePct)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Оборот</dt>
          <dd className="font-mono tabular-nums text-slate-200">{formatTurnoverCompact(node.turnoverRub)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Сделки</dt>
          <dd className="font-mono tabular-nums text-slate-200">{tradingFormat.formatInteger(node.tradesCount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Ход</dt>
          <dd className="font-mono tabular-nums text-slate-200">
            {tradingFormat.formatDayRangeMagnitude(node.rangePct ?? null)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Денежный импульс</dt>
          <dd className="font-mono tabular-nums text-slate-200">{formatMoneyShort(node.moveWeightRub, { signed: true })}</dd>
        </div>
      </dl>
      {whyHere ? (
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] leading-snug text-slate-400">
          <span className="text-slate-600">Почему здесь: </span>
          {whyHere}
        </p>
      ) : null}
    </div>
  );
}

function SemanticZoneLayer({
  plotLeft,
  plotTop,
  plotW,
  plotH,
  moneyPreset,
}: {
  plotLeft: number;
  plotTop: number;
  plotW: number;
  plotH: number;
  moneyPreset: boolean;
}) {
  const midX = plotLeft + plotW / 2;
  const midY = plotTop + plotH / 2;
  const pad = 10;
  const zoneCopy = moneyPreset
    ? {
        tl: SEMANTIC_ZONE_META["thin-rally"],
        tr: SEMANTIC_ZONE_META["money-growth"],
        bl: SEMANTIC_ZONE_META["weak-no-money"],
        br: SEMANTIC_ZONE_META["money-pressure"],
      }
    : {
        tl: { title: "Рост без объёма", subtitle: "слабее по обороту" },
        tr: { title: "Сильный кластер", subtitle: "лидеры по метрикам" },
        bl: { title: "Слабый кластер", subtitle: "низкая активность" },
        br: { title: "Давление с объёмом", subtitle: "оборот + негатив" },
      };

  return (
    <>
      <svg className="pointer-events-none absolute inset-0" width="100%" height="100%" aria-hidden>
        <defs>
          <radialGradient id="zone-tl" cx="0%" cy="0%">
            <stop offset="0%" stopColor="rgba(52,211,153,0.06)" />
            <stop offset="78%" stopColor="rgba(52,211,153,0)" />
          </radialGradient>
          <radialGradient id="zone-tr" cx="100%" cy="0%">
            <stop offset="0%" stopColor="rgba(52,211,153,0.1)" />
            <stop offset="78%" stopColor="rgba(52,211,153,0)" />
          </radialGradient>
          <radialGradient id="zone-bl" cx="0%" cy="100%">
            <stop offset="0%" stopColor="rgba(148,163,184,0.05)" />
            <stop offset="78%" stopColor="rgba(148,163,184,0)" />
          </radialGradient>
          <radialGradient id="zone-br" cx="100%" cy="100%">
            <stop offset="0%" stopColor="rgba(251,113,133,0.07)" />
            <stop offset="78%" stopColor="rgba(251,113,133,0)" />
          </radialGradient>
        </defs>
        <rect x={plotLeft} y={plotTop} width={plotW / 2} height={plotH / 2} fill="url(#zone-tl)" />
        <rect x={midX} y={plotTop} width={plotW / 2} height={plotH / 2} fill="url(#zone-tr)" />
        <rect x={plotLeft} y={midY} width={plotW / 2} height={plotH / 2} fill="url(#zone-bl)" />
        <rect x={midX} y={midY} width={plotW / 2} height={plotH / 2} fill="url(#zone-br)" />
        <line x1={midX} y1={plotTop} x2={midX} y2={plotTop + plotH} stroke="rgba(148,163,184,0.06)" strokeWidth={1} strokeDasharray="3 5" />
        <line x1={plotLeft} y1={midY} x2={plotLeft + plotW} y2={midY} stroke="rgba(148,163,184,0.06)" strokeWidth={1} strokeDasharray="3 5" />
      </svg>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute max-w-[140px]" style={{ left: plotLeft + pad, top: plotTop + pad }}>
          <p className="text-[10px] font-medium leading-tight text-slate-300/70">{zoneCopy.tl.title}</p>
          <p className="mt-0.5 text-[9px] leading-snug text-slate-500/80">{zoneCopy.tl.subtitle}</p>
        </div>
        <div
          className="absolute max-w-[140px] text-right"
          style={{ left: midX + pad, top: plotTop + pad, width: plotW / 2 - pad * 2 }}
        >
          <p className="text-[10px] font-medium leading-tight text-slate-300/70">{zoneCopy.tr.title}</p>
          <p className="mt-0.5 text-[9px] leading-snug text-slate-500/80">{zoneCopy.tr.subtitle}</p>
        </div>
        <div className="absolute max-w-[140px]" style={{ left: plotLeft + pad, top: midY + pad, width: plotW / 2 - pad * 2 }}>
          <p className="text-[10px] font-medium leading-tight text-slate-300/70">{zoneCopy.bl.title}</p>
          <p className="mt-0.5 text-[9px] leading-snug text-slate-500/80">{zoneCopy.bl.subtitle}</p>
        </div>
        <div
          className="absolute max-w-[140px] text-right"
          style={{ left: midX + pad, top: midY + pad, width: plotW / 2 - pad * 2 }}
        >
          <p className="text-[10px] font-medium leading-tight text-slate-300/70">{zoneCopy.br.title}</p>
          <p className="mt-0.5 text-[9px] leading-snug text-slate-500/80">{zoneCopy.br.subtitle}</p>
        </div>
      </div>
    </>
  );
}

export interface AxisMarketMapProps {
  nodes: MarketLabNode[];
  className?: string;
}

export function AxisMarketMap({ nodes, className }: AxisMarketMapProps) {
  const [config, setConfig] = React.useState<AxisMapConfig>(DEFAULT_CONFIG);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [transform, setTransform] = React.useState<ZoomTransform>(zoomIdentity);
  const [axesExpanded, setAxesExpanded] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const zoomSurfaceRef = React.useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = React.useState({ width: 800, height: 560 });

  const semanticZones = useSemanticZones(config);

  const selectedNode = React.useMemo(
    () => nodes.find((n) => n.ticker === selectedId) ?? null,
    [nodes, selectedId],
  );

  const hoveredNode = React.useMemo(
    () => nodes.find((n) => n.ticker === hoveredId) ?? null,
    [nodes, hoveredId],
  );

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setChartSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (selectedId && !nodes.some((n) => n.ticker === selectedId)) {
      setSelectedId(null);
    }
  }, [nodes, selectedId]);

  React.useEffect(() => {
    setTransform(zoomIdentity);
  }, [config, nodes.length]);

  React.useEffect(() => {
    const surface = zoomSurfaceRef.current;
    if (!surface) return;

    const z = zoom<HTMLDivElement, unknown>()
      .scaleExtent([ZOOM_SCALE_MIN, ZOOM_SCALE_MAX])
      .filter((event) => {
        if (event.type === "wheel") return true;
        const target = event.target as HTMLElement;
        if (target.closest("[data-axis-bubble]")) return false;
        return true;
      })
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    const selection = select(surface);
    selection.call(z);
    selection.on("dblclick.zoom", null);

    return () => {
      selection.on(".zoom", null);
    };
  }, [chartSize.width, chartSize.height]);

  React.useEffect(() => {
    const surface = zoomSurfaceRef.current;
    if (!surface) return;
    select(surface).property("__zoom", transform);
  }, [transform]);

  const scales = React.useMemo(() => {
    const xKey = config.x as MetricKey;
    const yKey = config.y as MetricKey;
    const xPercentiles = buildPercentileRank(nodes, xKey);
    const yPercentiles = usesPercentileY(yKey) ? buildPercentileRank(nodes, yKey) : null;
    const yDomain = usesPercentileY(yKey) ? null : realValueDomain(nodes, yKey);
    return { xKey, yKey, xPercentiles, yPercentiles, yDomain };
  }, [nodes, config]);

  const plot = React.useMemo((): PlottedPoint[] => {
    if (!nodes.length) return [];

    const w = chartSize.width;
    const h = chartSize.height;
    const plotW = w - MARGIN.left - MARGIN.right - PLOT_INSET * 2;
    const plotH = h - MARGIN.top - MARGIN.bottom - PLOT_INSET * 2;
    const originX = MARGIN.left + PLOT_INSET;
    const originY = MARGIN.top + PLOT_INSET;
    const { xPercentiles, yPercentiles, yDomain, xKey, yKey } = scales;

    const sizeKey = config.size === "absImpulse" ? "absImpulse" : (config.size as MetricKey);
    const sizeValues = nodes.map((n) => metricValue(n, sizeKey));
    const [sizeLo, sizeHi] = winsorizeBounds(sizeValues, WINSORIZE_PCT);

    const labelTickers = new Set(
      [...nodes]
        .sort((a, b) => {
          const sizeDiff = metricValue(b, sizeKey) - metricValue(a, sizeKey);
          if (sizeDiff !== 0) return sizeDiff;
          return a.activityRank - b.activityRank;
        })
        .slice(0, LABEL_TOP_N)
        .map((n) => n.ticker),
    );

    return nodes.map((node) => {
      const xPct = xPercentiles.get(node.ticker) ?? 50;
      const pxOffset = percentileMap(xPct, 0, plotW);

      let pyOffset: number;
      if (yPercentiles) {
        const yPct = yPercentiles.get(node.ticker) ?? 50;
        pyOffset = percentileMap(yPct, plotH, 0);
      } else {
        const yVal = metricValue(node, yKey);
        pyOffset = linearMap(yVal, yDomain!, plotH, 0);
      }

      const sizeVal = metricValue(node, sizeKey);
      const sizeNorm =
        sizeHi > sizeLo ? (clamp(sizeVal, sizeLo, sizeHi) - sizeLo) / (sizeHi - sizeLo) : 0.5;
      const r = MIN_BUBBLE_R + Math.sqrt(Math.max(sizeNorm, 0)) * (MAX_BUBBLE_R - MIN_BUBBLE_R);

      return {
        node,
        px: originX + pxOffset,
        py: originY + pyOffset,
        r,
        colors: bubbleColor(node, config.color),
        showLabel: labelTickers.has(node.ticker),
      };
    });
  }, [nodes, config, chartSize, scales]);

  const zeroLineY = React.useMemo(() => {
    const yKey = config.y as MetricKey;
    if (usesPercentileY(yKey) || !scales.yDomain) return null;
    if (!isSignedMetric(yKey)) return null;
    const plotH = chartSize.height - MARGIN.top - MARGIN.bottom - PLOT_INSET * 2;
    const originY = MARGIN.top + PLOT_INSET;
    const y0 = linearMap(0, scales.yDomain, plotH, 0);
    return originY + y0;
  }, [config.y, chartSize, scales.yDomain]);

  const activePresetId = React.useMemo(() => {
    const match = AXIS_PRESETS.find(
      (p) =>
        p.config.x === config.x &&
        p.config.y === config.y &&
        p.config.size === config.size &&
        p.config.color === config.color,
    );
    return match?.id ?? null;
  }, [config]);

  const leaderPoints = React.useMemo(() => {
    const sizeKey = config.size === "absImpulse" ? "absImpulse" : (config.size as MetricKey);
    const leaders = new Set(
      [...nodes]
        .sort((a, b) => metricValue(b, sizeKey) - metricValue(a, sizeKey))
        .slice(0, LABEL_TOP_N)
        .map((n) => n.ticker),
    );
    return plot.filter((p) => leaders.has(p.node.ticker));
  }, [plot, nodes, config.size]);

  const nodePlacements = React.useMemo(() => {
    const map = new Map<string, NodePlacement>();
    const { xPercentiles, yPercentiles, yKey } = scales;
    for (const node of nodes) {
      map.set(node.ticker, {
        xPercentile: xPercentiles.get(node.ticker) ?? 50,
        yPercentile: yPercentiles?.get(node.ticker) ?? null,
        yValue: yKey === "changePct" ? node.changePct : metricValue(node, yKey),
      });
    }
    return map;
  }, [nodes, scales]);

  const zoneLeaders = React.useMemo(() => {
    if (!semanticZones) return [];
    return pickZoneLeaders(nodes, nodePlacements);
  }, [nodes, nodePlacements, semanticZones]);

  const selectedPlacement = selectedNode ? nodePlacements.get(selectedNode.ticker) : undefined;
  const selectedWhyHere =
    selectedNode && selectedPlacement ? explainWhyHere(selectedNode, selectedPlacement) : null;
  const selectedZoneLabel =
    selectedNode && selectedPlacement && semanticZones
      ? getZoneLabel(classifySemanticZone(selectedPlacement))
      : null;

  const hoveredPlacement = hoveredNode ? nodePlacements.get(hoveredNode.ticker) : undefined;
  const hoveredWhyHere =
    hoveredNode && hoveredPlacement ? explainWhyHere(hoveredNode, hoveredPlacement) : null;

  const resetView = React.useCallback(() => {
    setTransform(zoomIdentity);
  }, []);

  const zoomToLeaders = React.useCallback(() => {
    if (!leaderPoints.length) return;
    setTransform(fitTransformToPoints(leaderPoints, chartSize.width, chartSize.height));
  }, [leaderPoints, chartSize.width, chartSize.height]);

  const plotTransformStyle: React.CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    transformOrigin: "0 0",
  };

  if (!nodes.length) {
    return <LabEmptyState message="Нет данных для карты. Проверьте подключение к MOEX ISS или повторите позже." />;
  }

  const plotLeft = MARGIN.left + PLOT_INSET;
  const plotTop = MARGIN.top + PLOT_INSET;
  const plotRight = chartSize.width - MARGIN.right - PLOT_INSET;
  const plotBottom = chartSize.height - MARGIN.bottom - PLOT_INSET;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const xTickPositions = PERCENTILE_TICKS.map((tick) => ({
    tick,
    x: plotLeft + percentileMap(tick, 0, plotW),
    label: formatPercentileTick(tick),
  }));

  const yTickPositions = usesPercentileY(scales.yKey)
    ? PERCENTILE_TICKS.map((tick) => ({
        tick,
        y: plotTop + percentileMap(tick, plotH, 0),
        label: formatPercentileTick(tick),
      }))
    : tickValuesReal(scales.yDomain!, scales.yKey).map((tick) => ({
        tick,
        y: plotTop + linearMap(tick, scales.yDomain!, plotH, 0),
        label: formatAxisTick(scales.yKey, tick),
      }));

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 px-3 py-2.5 backdrop-blur-xl">
        <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">Пульт карты</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          {AXIS_PRESETS.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setConfig(preset.config);
                  setAxesExpanded(false);
                }}
                className={cn(
                  "flex flex-1 flex-col items-start rounded-lg border px-3 py-2 text-left transition",
                  active
                    ? "border-violet-500/40 bg-violet-950/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "border-white/5 bg-black/25 hover:border-white/10",
                )}
              >
                <span className={cn("text-[13px] font-medium", active ? "text-violet-100" : "text-slate-400")}>
                  {preset.label}
                </span>
                <span className="mt-0.5 text-[10px] text-slate-600">{preset.tagline}</span>
              </button>
            );
          })}
        </div>
        {!axesExpanded && !activePresetId ? (
          <p className="mt-2 text-[11px] text-slate-600">{presetAxisSummary(config)} · пользовательские оси</p>
        ) : null}
        <button
          type="button"
          onClick={() => setAxesExpanded((v) => !v)}
          className="mt-2 text-[11px] text-violet-300/80 transition hover:text-violet-200"
        >
          {axesExpanded ? "Скрыть настройки осей" : "Настроить оси"}
        </button>
        {axesExpanded ? (
          <div className="mt-2 space-y-2 border-t border-white/[0.05] pt-2">
            <AxisSelect
              label="X"
              value={config.x}
              options={["turnover", "trades", "impulse", "range"] as const}
              labels={AXIS_X_LABELS}
              onChange={(x) => setConfig((c) => ({ ...c, x }))}
            />
            <AxisSelect
              label="Y"
              value={config.y}
              options={["changePct", "trades", "range", "turnover", "impulse"] as const}
              labels={AXIS_Y_LABELS}
              onChange={(y) => setConfig((c) => ({ ...c, y }))}
            />
            <AxisSelect
              label="Размер"
              value={config.size}
              options={["turnover", "trades", "absImpulse"] as const}
              labels={AXIS_SIZE_LABELS}
              onChange={(size) => setConfig((c) => ({ ...c, size }))}
            />
            <AxisSelect
              label="Цвет"
              value={config.color}
              options={["changePct", "impulse", "status"] as const}
              labels={AXIS_COLOR_LABELS}
              onChange={(color) => setConfig((c) => ({ ...c, color }))}
            />
          </div>
        ) : null}
      </div>

      <MapReadingPills />

      <div
        ref={containerRef}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl",
          "min-h-[min(74vh,600px)]",
          "border border-white/[0.05]",
          "bg-[radial-gradient(ellipse_90%_70%_at_50%_42%,rgba(51,65,85,0.22),rgba(2,6,23,0.98))]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.55)]",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(139,92,246,0.07),transparent_58%)]" />
        <div className="absolute right-3 top-3 z-20 flex flex-wrap justify-end gap-1.5">
          <button
            type="button"
            onClick={resetView}
            className="rounded-md border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300 backdrop-blur-sm transition hover:border-white/15 hover:text-white"
          >
            Сбросить вид
          </button>
          <button
            type="button"
            onClick={zoomToLeaders}
            className="rounded-md border border-violet-500/25 bg-violet-950/60 px-2.5 py-1 text-[11px] text-violet-100 backdrop-blur-sm transition hover:border-violet-400/35"
          >
            Приблизить лидеров
          </button>
        </div>

        <div
          ref={zoomSurfaceRef}
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          aria-label="Карта: колесо — масштаб, перетаскивание — сдвиг"
        >
          <div className="absolute inset-0" style={plotTransformStyle}>
            {semanticZones ? (
              <SemanticZoneLayer
                plotLeft={plotLeft}
                plotTop={plotTop}
                plotW={plotW}
                plotH={plotH}
                moneyPreset={semanticZones}
              />
            ) : null}

            <svg
              className="pointer-events-none absolute inset-0 text-slate-600"
              width={chartSize.width}
              height={chartSize.height}
              aria-hidden
            >
              {xTickPositions.map(({ tick, x }) => (
                <line key={`gx-${tick}`} x1={x} y1={plotTop} x2={x} y2={plotBottom} stroke="rgba(148,163,184,0.06)" strokeWidth={1} />
              ))}
              {yTickPositions.map(({ tick, y }) => (
                <line key={`gy-${tick}`} x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="rgba(148,163,184,0.06)" strokeWidth={1} />
              ))}

              <rect
                x={plotLeft}
                y={plotTop}
                width={plotW}
                height={plotH}
                fill="none"
                stroke="rgba(148,163,184,0.18)"
                strokeWidth={1}
              />

              <line
                x1={plotLeft}
                y1={plotBottom}
                x2={plotRight}
                y2={plotBottom}
                stroke="rgba(148,163,184,0.4)"
                strokeWidth={1.5}
              />
              <line
                x1={plotLeft}
                y1={plotTop}
                x2={plotLeft}
                y2={plotBottom}
                stroke="rgba(148,163,184,0.4)"
                strokeWidth={1.5}
              />

              {zeroLineY != null ? (
                <line
                  x1={plotLeft}
                  y1={zeroLineY}
                  x2={plotRight}
                  y2={zeroLineY}
                  stroke="rgba(148,163,184,0.32)"
                  strokeWidth={1.25}
                />
              ) : null}

              {xTickPositions.map(({ tick, x, label }) => (
                <text key={`xt-${tick}`} x={x} y={plotBottom + 16} textAnchor="middle" className="fill-slate-500 text-[9px]">
                  {label}
                </text>
              ))}
              {yTickPositions.map(({ tick, y, label }) => (
                <text key={`yt-${tick}`} x={plotLeft - 8} y={y + 3} textAnchor="end" className="fill-slate-500 text-[9px]">
                  {label}
                </text>
              ))}

              <text
                x={(plotLeft + plotRight) / 2}
                y={chartSize.height - 8}
                textAnchor="middle"
                className="fill-slate-400 text-[11px]"
              >
                {AXIS_X_LABELS[config.x]} · ранг по выборке
              </text>
              <text
                x={14}
                y={(plotTop + plotBottom) / 2}
                textAnchor="middle"
                transform={`rotate(-90 14 ${(plotTop + plotBottom) / 2})`}
                className="fill-slate-400 text-[11px]"
              >
                {usesPercentileY(scales.yKey)
                  ? `${AXIS_Y_LABELS[config.y]} · ранг`
                  : AXIS_Y_LABELS[config.y]}
              </text>
            </svg>

            <div className="absolute inset-0">
              {plot.map((point) => {
                const isHovered = hoveredId === point.node.ticker;
                const isSelected = selectedId === point.node.ticker;
                const showLabel = point.showLabel || isHovered;
                const d = point.r * 2;
                return (
                  <button
                    key={point.node.ticker}
                    type="button"
                    data-axis-bubble
                    aria-pressed={isSelected}
                    className={cn(
                      "absolute flex flex-col items-center justify-center rounded-full border backdrop-blur-md transition-[transform,box-shadow,filter,z-index] duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
                      isHovered && "z-40 scale-[1.12] brightness-110",
                      isSelected && "z-30",
                      !isHovered && !isSelected && "z-10",
                    )}
                    style={{
                      width: d,
                      height: d,
                      left: point.px - point.r,
                      top: point.py - point.r,
                      background: point.colors.background,
                      borderColor: isSelected || isHovered ? "rgba(196,181,253,0.45)" : point.colors.border,
                      boxShadow: isHovered
                        ? "0 0 32px rgba(139,92,246,0.22), 0 0 12px rgba(52,211,153,0.08), inset 0 1px 0 rgba(255,255,255,0.14)"
                        : isSelected
                          ? "0 0 0 1px rgba(196,181,253,0.25), inset 0 1px 0 rgba(255,255,255,0.1)"
                          : "inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.2)",
                    }}
                    onClick={() => setSelectedId(point.node.ticker)}
                    onMouseEnter={() => setHoveredId(point.node.ticker)}
                    onMouseLeave={() => setHoveredId((id) => (id === point.node.ticker ? null : id))}
                  >
                    {isSelected ? (
                      <span
                        className="pointer-events-none absolute inset-[-5px] rounded-full border border-violet-300/25"
                        style={{ boxShadow: "0 0 20px rgba(139,92,246,0.2)" }}
                        aria-hidden
                      />
                    ) : null}
                    {showLabel ? (
                      <span className="pointer-events-none text-[9px] font-semibold tracking-wide text-white/95 sm:text-[10px]">
                        {point.node.ticker}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {hoveredNode ? (
          <AxisTooltip
            node={hoveredNode}
            whyHere={hoveredWhyHere}
            style={{
              left: Math.min(
                chartSize.width - 210,
                Math.max(12, (plot.find((p) => p.node.ticker === hoveredNode.ticker)?.px ?? 0) * transform.k + transform.x - 100),
              ),
              top: Math.max(
                12,
                ((plot.find((p) => p.node.ticker === hoveredNode.ticker)?.py ?? 0) -
                  (plot.find((p) => p.node.ticker === hoveredNode.ticker)?.r ?? 20)) *
                  transform.k +
                  transform.y -
                  96,
              ),
            }}
          />
        ) : null}

        {selectedNode ? (
          <div className="absolute right-3 top-12 z-40 max-h-[calc(100%-5rem)] overflow-y-auto">
            <MarketLabInspector
              node={selectedNode}
              variant="overlay"
              onClose={() => setSelectedId(null)}
              zoneLabel={selectedZoneLabel}
              whyHere={selectedWhyHere}
              className="border-white/12 bg-slate-950/88 shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
            />
          </div>
        ) : null}

        <p className="pointer-events-none absolute bottom-3 left-4 right-4 text-[10px] leading-snug text-slate-600">
          Колесо — масштаб, перетаскивание — сдвиг · позиция адаптирована для читаемости, значения — в подсказке
        </p>
      </div>

      {semanticZones && zoneLeaders.length ? <ZoneLeadersPanel leaders={zoneLeaders} /> : null}
    </div>
  );
}


