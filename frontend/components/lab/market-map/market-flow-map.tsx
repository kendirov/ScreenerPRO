"use client";

import {
  forceCollide,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import * as React from "react";
import { LabEmptyState } from "@/components/lab/lab-ui";
import { FlowCompareSwitch } from "@/components/lab/market-map/flow-compare-switch";
import { FlowDayShiftsPanel } from "@/components/lab/market-map/flow-day-shifts-panel";
import { FlowMapInspector } from "@/components/lab/market-map/flow-map-inspector";
import { FlowMapReadingGuide } from "@/components/lab/market-map/flow-map-reading-guide";
import { FlowMapTooltip } from "@/components/lab/market-map/flow-map-tooltip";
import {
  buildFlowDayShifts,
  computeFlowScore,
  computeTailShift,
  flowNodeBrightness,
  flowNodeColor,
  flowNodeOpacity,
  flowYDomain,
  getFlowZoneForState,
  getStateShiftLabel,
  getTopStateShiftTickers,
  isNotableStateShift,
  type FlowCompareMode,
  type FlowZoneId,
  type MarketFlowNode,
} from "@/lib/domain/market-flow-map";
import { cn } from "@/lib/utils/cn";

const MARGIN = { top: 36, right: 24, bottom: 48, left: 48 };
const PLOT_INSET = 14;
const MIN_RADIUS = 10;
const MAX_RADIUS = 42;
const COLLIDE_PAD = 5;
const SIM_TICKS = 320;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 4.5;

type FlowSimNode = SimulationNodeDatum & {
  id: string;
  node: MarketFlowNode;
  targetX: number;
  targetY: number;
  prevX: number | null;
  prevY: number | null;
  r: number;
  colors: ReturnType<typeof flowNodeColor>;
  opacity: number;
  brightness: number;
  flowScore: number;
  tailShift: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function percentileMap(value: number, outMin: number, outMax: number): number {
  return outMin + (clamp(value, 0, 100) / 100) * (outMax - outMin);
}

function linearMap(value: number, domain: [number, number], outMin: number, outMax: number): number {
  const [d0, d1] = domain;
  const v = clamp(value, d0, d1);
  const t = d1 > d0 ? (v - d0) / (d1 - d0) : 0.5;
  return outMin + t * (outMax - outMin);
}

function radiusFromTurnover(sizeScore: number): number {
  const norm = sizeScore / 100;
  return MIN_RADIUS + Math.sqrt(Math.max(norm, 0.04)) * (MAX_RADIUS - MIN_RADIUS);
}

function runFlowLayout(
  nodes: MarketFlowNode[],
  width: number,
  height: number,
  yDomain: [number, number],
): FlowSimNode[] {
  const plotW = width - MARGIN.left - MARGIN.right - PLOT_INSET * 2;
  const plotH = height - MARGIN.top - MARGIN.bottom - PLOT_INSET * 2;
  const originX = MARGIN.left + PLOT_INSET;
  const originY = MARGIN.top + PLOT_INSET;

  const simNodes: FlowSimNode[] = nodes.map((node) => {
    const targetX = originX + percentileMap(node.xScore, 0, plotW);
    const targetY = originY + linearMap(node.yScore, yDomain, plotH, 0);
    let prevX: number | null = null;
    let prevY: number | null = null;
    if (node.previousXScore != null && node.previousYScore != null) {
      prevX = originX + percentileMap(node.previousXScore, 0, plotW);
      prevY = originY + linearMap(node.previousYScore, yDomain, plotH, 0);
    }
    return {
      id: node.ticker,
      node,
      targetX,
      targetY,
      prevX,
      prevY,
      x: targetX,
      y: targetY,
      r: radiusFromTurnover(node.sizeScore),
      colors: flowNodeColor(node.colorScore),
      opacity: flowNodeOpacity(node),
      brightness: flowNodeBrightness(node),
      flowScore: computeFlowScore(node),
      tailShift: computeTailShift(node),
    };
  });

  const sidePad = 6;
  const topPad = 12;
  const bottomPad = 28;

  const simulation = forceSimulation<FlowSimNode>(simNodes)
    .force("x", forceX<FlowSimNode>((d) => d.targetX).strength(0.82))
    .force("y", forceY<FlowSimNode>((d) => d.targetY).strength(0.82))
    .force(
      "collide",
      forceCollide<FlowSimNode>((d) => d.r + COLLIDE_PAD)
        .strength(0.92)
        .iterations(3),
    )
    .stop();

  for (let i = 0; i < SIM_TICKS; i++) simulation.tick();

  for (const n of simNodes) {
    n.x = clamp(n.x ?? n.targetX, n.r + sidePad, width - n.r - sidePad);
    n.y = clamp(n.y ?? n.targetY, n.r + topPad, height - n.r - bottomPad);
  }

  return simNodes;
}

function zoneFill(id: FlowZoneId, active: FlowZoneId | null): string {
  const on = active === id;
  const map: Record<FlowZoneId, string> = {
    tl: on ? "rgba(251,191,36,0.11)" : "rgba(251,191,36,0.04)",
    tr: on ? "rgba(52,211,153,0.14)" : "rgba(52,211,153,0.06)",
    bl: on ? "rgba(100,116,139,0.08)" : "rgba(100,116,139,0.03)",
    br: on ? "rgba(251,113,133,0.1)" : "rgba(251,113,133,0.04)",
  };
  return map[id];
}

function FlowZoneBackdrop({
  plotLeft,
  plotTop,
  plotW,
  plotH,
  activeZone,
}: {
  plotLeft: number;
  plotTop: number;
  plotW: number;
  plotH: number;
  activeZone: FlowZoneId | null;
}) {
  const midX = plotLeft + plotW / 2;
  const midY = plotTop + plotH / 2;
  const pad = 12;

  return (
    <>
      <svg className="pointer-events-none absolute inset-0" width="100%" height="100%" aria-hidden>
        <defs>
          <radialGradient id="flow-zone-tl" cx="0%" cy="0%">
            <stop offset="0%" stopColor="rgba(251,191,36,0.05)" />
            <stop offset="100%" stopColor="rgba(251,191,36,0)" />
          </radialGradient>
        </defs>
        <rect x={plotLeft} y={plotTop} width={plotW / 2} height={plotH / 2} fill={zoneFill("tl", activeZone)} />
        <rect x={midX} y={plotTop} width={plotW / 2} height={plotH / 2} fill={zoneFill("tr", activeZone)} />
        <rect x={plotLeft} y={midY} width={plotW / 2} height={plotH / 2} fill={zoneFill("bl", activeZone)} />
        <rect x={midX} y={midY} width={plotW / 2} height={plotH / 2} fill={zoneFill("br", activeZone)} />
        <line x1={midX} y1={plotTop} x2={midX} y2={plotTop + plotH} stroke="rgba(148,163,184,0.05)" strokeDasharray="4 6" />
        <line x1={plotLeft} y1={midY} x2={plotLeft + plotW} y2={midY} stroke="rgba(148,163,184,0.05)" strokeDasharray="4 6" />
      </svg>
      <div className="pointer-events-none absolute inset-0 select-none text-[10px] font-medium tracking-wide text-slate-600/30">
        <p className="absolute max-w-[120px]" style={{ left: plotLeft + pad, top: plotTop + pad }}>
          Тонкий разгон
        </p>
        <p className="absolute max-w-[120px] text-right" style={{ left: midX + pad, top: plotTop + pad, width: plotW / 2 - pad * 2 }}>
          Деньги + рост
        </p>
        <p className="absolute max-w-[100px]" style={{ left: plotLeft + pad, top: midY + pad }}>
          Шум
        </p>
        <p className="absolute max-w-[120px] text-right" style={{ left: midX + pad, top: midY + pad, width: plotW / 2 - pad * 2 }}>
          Деньги + давление
        </p>
      </div>
    </>
  );
}

const SHIFT_BADGE: Record<string, string> = {
  awakened: "border-emerald-700/35 bg-emerald-950/50 text-emerald-200/90",
  accelerated: "border-cyan-700/35 bg-cyan-950/40 text-cyan-200/90",
  "pressure-up": "border-rose-800/35 bg-rose-950/45 text-rose-200/90",
  faded: "border-slate-600/30 bg-slate-900/50 text-slate-400",
};

export interface MarketFlowMapProps {
  nodes: MarketFlowNode[];
  yesterdayLoading?: boolean;
  compareMode: FlowCompareMode;
  onCompareModeChange: (mode: FlowCompareMode) => void;
  yesterdayAvailable: boolean;
  className?: string;
}

export function MarketFlowMap({
  nodes,
  yesterdayLoading,
  compareMode,
  onCompareModeChange,
  yesterdayAvailable,
  className,
}: MarketFlowMapProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [transform, setTransform] = React.useState<ZoomTransform>(zoomIdentity);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const zoomSurfaceRef = React.useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = React.useState({ width: 900, height: 580 });

  const yDomain = React.useMemo(() => flowYDomain(nodes), [nodes]);

  const focusId = hoveredId ?? selectedId;
  const focusNode = React.useMemo(
    () => (focusId ? nodes.find((n) => n.ticker === focusId) ?? null : null),
    [nodes, focusId],
  );
  const activeZone = React.useMemo(
    () => (focusNode ? getFlowZoneForState(focusNode.flowState) : null),
    [focusNode],
  );

  const layoutNodes = React.useMemo(
    () => runFlowLayout(nodes, chartSize.width, chartSize.height, yDomain),
    [nodes, chartSize.width, chartSize.height, yDomain],
  );

  const showComparison = compareMode === "vs-yesterday" && yesterdayAvailable;
  const showTails = showComparison;
  const dayShifts = React.useMemo(() => buildFlowDayShifts(nodes), [nodes]);
  const topShiftTickers = React.useMemo(() => getTopStateShiftTickers(nodes), [nodes]);

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
        setChartSize({ width: Math.floor(width), height: Math.max(Math.floor(height), 480) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (selectedId && !nodes.some((n) => n.ticker === selectedId)) setSelectedId(null);
  }, [nodes, selectedId]);

  React.useEffect(() => {
    setTransform(zoomIdentity);
  }, [nodes.length, chartSize.width]);

  React.useEffect(() => {
    const surface = zoomSurfaceRef.current;
    if (!surface) return;
    const z = zoom<HTMLDivElement, unknown>()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      .filter((event) => {
        if (event.type === "wheel") return true;
        return !(event.target as HTMLElement).closest("[data-flow-node]");
      })
      .on("zoom", (event) => setTransform(event.transform));
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

  const plotTransformStyle: React.CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    transformOrigin: "0 0",
  };

  if (!nodes.length) {
    return <LabEmptyState message="Нет данных для карты потоков. Проверьте MOEX ISS или повторите позже." />;
  }

  const plotLeft = MARGIN.left + PLOT_INSET;
  const plotTop = MARGIN.top + PLOT_INSET;
  const plotRight = chartSize.width - MARGIN.right - PLOT_INSET;
  const plotBottom = chartSize.height - MARGIN.bottom - PLOT_INSET;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  const zeroLineY = plotTop + linearMap(0, yDomain, plotH, 0);

  const xLabels = [
    { x: plotLeft + percentileMap(8, 0, plotW), label: "слабее" },
    { x: plotLeft + percentileMap(92, 0, plotW), label: "сильнее" },
  ];

  return (
    <div className={cn("flex w-full flex-col gap-3 lg:flex-row lg:items-start", className)}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FlowMapReadingGuide />
          <FlowCompareSwitch
            value={compareMode}
            onChange={onCompareModeChange}
            yesterdayAvailable={yesterdayAvailable}
          />
        </div>
        {yesterdayLoading ? (
          <p className="mb-2 text-[10px] tracking-wide text-slate-600">Загрузка вчерашнего слоя MOEX…</p>
        ) : null}
        {compareMode === "vs-yesterday" && !yesterdayAvailable && !yesterdayLoading ? (
          <p className="rounded-lg border border-amber-900/25 bg-amber-950/15 px-3 py-2 text-[11px] text-amber-200/75">
            Вчерашнее сравнение недоступно. Показываем текущую карту по обороту и движению.
          </p>
        ) : null}

        <div
          ref={containerRef}
          className={cn(
            "lab-glass-panel relative w-full overflow-hidden rounded-2xl",
            "min-h-[min(72vh,620px)]",
            "border border-white/[0.06]",
            "bg-[radial-gradient(ellipse_95%_75%_at_50%_40%,rgba(30,41,59,0.28),rgba(2,6,23,0.99))]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.55)]",
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.035) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(139,92,246,0.05),transparent_58%)]" />

          <button
            type="button"
            onClick={() => setTransform(zoomIdentity)}
            className="absolute right-3 top-3 z-20 rounded-lg border border-white/[0.08] bg-slate-950/75 px-2.5 py-1 text-[11px] text-slate-400 backdrop-blur-md transition hover:border-white/12 hover:text-slate-200"
          >
            Сбросить вид
          </button>

          <div ref={zoomSurfaceRef} className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing">
            <div className="absolute inset-0" style={plotTransformStyle}>
              <FlowZoneBackdrop
                plotLeft={plotLeft}
                plotTop={plotTop}
                plotW={plotW}
                plotH={plotH}
                activeZone={activeZone}
              />

              <svg
                className="pointer-events-none absolute inset-0"
                width={chartSize.width}
                height={chartSize.height}
                aria-hidden
              >
                <defs>
                  {showTails
                    ? layoutNodes.map((point) =>
                        point.prevX != null && point.prevY != null ? (
                          <linearGradient
                            key={`grad-${point.id}`}
                            id={`tail-grad-${point.id}`}
                            gradientUnits="userSpaceOnUse"
                            x1={point.prevX}
                            y1={point.prevY}
                            x2={point.x ?? point.targetX}
                            y2={point.y ?? point.targetY}
                          >
                            <stop offset="0%" stopColor="rgba(148,163,184,0.12)" />
                            <stop
                              offset="100%"
                              stopColor={
                                point.node.colorScore > 0.04
                                  ? `rgba(52,211,153,${0.25 + point.tailShift * 0.45})`
                                  : point.node.colorScore < -0.04
                                    ? `rgba(251,113,133,${0.25 + point.tailShift * 0.45})`
                                    : `rgba(196,181,253,${0.2 + point.tailShift * 0.35})`
                              }
                            />
                          </linearGradient>
                        ) : null,
                      )
                    : null}
                </defs>

                <rect
                  x={plotLeft}
                  y={plotTop}
                  width={plotW}
                  height={plotH}
                  fill="none"
                  stroke="rgba(148,163,184,0.14)"
                  strokeWidth={1}
                />
                <line x1={plotLeft} y1={zeroLineY} x2={plotRight} y2={zeroLineY} stroke="rgba(148,163,184,0.2)" strokeWidth={1} />

                {showTails
                  ? layoutNodes.map((point) => {
                      const isFocus = focusId === point.id;
                      const isDimmed = focusId != null && !isFocus;
                      const tailOpacity =
                        point.prevX != null && point.prevY != null
                          ? isFocus
                            ? 0.5 + point.tailShift * 0.4
                            : isDimmed
                              ? 0.04
                              : 0.12 + point.tailShift * 0.18
                          : 0;
                      const tailWidth = isFocus ? 1.5 + point.tailShift * 2.2 : 1 + point.tailShift * 1.2;

                      return point.prevX != null && point.prevY != null ? (
                        <line
                          key={`tail-${point.id}`}
                          x1={point.prevX}
                          y1={point.prevY}
                          x2={point.x ?? point.targetX}
                          y2={point.y ?? point.targetY}
                          stroke={`url(#tail-grad-${point.id})`}
                          strokeWidth={tailWidth}
                          strokeLinecap="round"
                          opacity={tailOpacity}
                        />
                      ) : null;
                    })
                  : null}

                {xLabels.map(({ x, label }) => (
                  <text key={label} x={x} y={plotBottom + 18} textAnchor="middle" className="fill-slate-600 text-[9px]">
                    {label}
                  </text>
                ))}
                <text x={(plotLeft + plotRight) / 2} y={chartSize.height - 6} textAnchor="middle" className="fill-slate-500 text-[10px]">
                  денег больше обычного
                </text>
                <text
                  x={12}
                  y={(plotTop + plotBottom) / 2}
                  textAnchor="middle"
                  transform={`rotate(-90 12 ${(plotTop + plotBottom) / 2})`}
                  className="fill-slate-500 text-[10px]"
                >
                  движение
                </text>
              </svg>

              <div className="absolute inset-0">
                {layoutNodes.map((point) => {
                  const isHovered = hoveredId === point.id;
                  const isSelected = selectedId === point.id;
                  const isFocus = focusId === point.id;
                  const isDimmed = focusId != null && !isFocus;
                  const x = point.x ?? point.targetX;
                  const y = point.y ?? point.targetY;
                  const d = point.r * 2;
                  const showTicker = isHovered || isSelected;

                  const nodeOpacity = isDimmed ? point.opacity * 0.3 : isFocus ? Math.min(point.opacity + 0.15, 1) : point.opacity;
                  const nodeBrightness = isFocus ? point.brightness * 1.12 : isDimmed ? point.brightness * 0.82 : point.brightness;

                  const showShiftBadge =
                    showComparison && topShiftTickers.has(point.id) && isNotableStateShift(point.node.stateShift);
                  const shiftBadgeClass = SHIFT_BADGE[point.node.stateShift] ?? SHIFT_BADGE.faded;

                  return (
                    <div
                      key={point.id}
                      className="absolute"
                      style={{
                        left: x - point.r,
                        top: y - point.r,
                        width: d,
                        height: d,
                      }}
                    >
                      {showShiftBadge ? (
                        <span
                          className={cn(
                            "pointer-events-none absolute left-1/2 top-0 z-50 -translate-x-1/2 -translate-y-[calc(100%+3px)]",
                            "whitespace-nowrap rounded-full border px-1.5 py-px text-[8px] leading-tight",
                            shiftBadgeClass,
                          )}
                        >
                          {getStateShiftLabel(point.node.stateShift)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        data-flow-node
                        aria-pressed={isSelected}
                        className={cn(
                          "absolute inset-0 flex items-center justify-center rounded-full border backdrop-blur-md transition-[transform,opacity,filter,box-shadow] duration-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/30",
                          isFocus && "z-40 scale-[1.1]",
                          isSelected && !isHovered && "z-30 ring-1 ring-violet-300/25",
                        )}
                        style={{
                          opacity: nodeOpacity,
                          filter: `brightness(${nodeBrightness})`,
                          background: point.colors.background,
                          borderColor: isFocus ? "rgba(196,181,253,0.45)" : point.colors.border,
                          boxShadow: isFocus
                            ? "0 0 32px rgba(139,92,246,0.2), inset 0 1px 0 rgba(255,255,255,0.14)"
                            : "inset 0 1px 0 rgba(255,255,255,0.05)",
                        }}
                        onClick={() => setSelectedId(point.id)}
                        onMouseEnter={() => setHoveredId(point.id)}
                        onMouseLeave={() => setHoveredId((id) => (id === point.id ? null : id))}
                      >
                        {showTicker ? (
                          <span className="pointer-events-none text-[9px] font-semibold tracking-[0.08em] text-white/92">
                            {point.id}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {hoveredNode ? (
            <FlowMapTooltip
              node={hoveredNode}
              showComparison={showComparison}
              style={{
                left: Math.min(
                  chartSize.width - 268,
                  Math.max(
                    12,
                    ((layoutNodes.find((p) => p.id === hoveredNode.ticker)?.x ?? 0) * transform.k + transform.x) - 110,
                  ),
                ),
                top: Math.max(
                  12,
                  ((layoutNodes.find((p) => p.id === hoveredNode.ticker)?.y ?? 0) -
                    (layoutNodes.find((p) => p.id === hoveredNode.ticker)?.r ?? 20)) *
                    transform.k +
                    transform.y -
                    108,
                ),
              }}
            />
          ) : null}
        </div>

        {showComparison ? <FlowDayShiftsPanel shifts={dayShifts} /> : null}
      </div>

      <FlowMapInspector
        node={selectedNode}
        showComparison={showComparison}
        className="w-full shrink-0 lg:w-auto"
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

/** @deprecated alias — use MarketFlowMap */
export const FlowMarketMap = MarketFlowMap;

export type FlowMarketMapProps = MarketFlowMapProps;
