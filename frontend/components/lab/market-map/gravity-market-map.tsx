"use client";

import {
  forceCenter,
  forceCollide,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import * as React from "react";
import { LabEmptyState } from "@/components/lab/lab-ui";
import { MarketMapInspector } from "@/components/lab/market-map/market-map-inspector";
import type { MarketLabNode } from "@/lib/domain/market-lab";
import type { MarketMapMode, MarketMapTile } from "@/lib/domain/market-map";
import { formatMoveWeightCompact, getModeSizeValue, tileSurfaceStyle } from "@/lib/domain/market-map";
import { BUBBLE_MAP_LEGEND, explainBubbleWhyHere } from "@/lib/domain/market-map-semantics";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

const MIN_RADIUS = 18;
const MAX_RADIUS = 74;
const LABEL_FULL_RADIUS = 40;
const LABEL_TICKER_RADIUS = 26;
const COLLIDE_PADDING = 5;
const SIM_TICKS = 380;
const MOBILE_BREAKPOINT = 768;

function tileToLabNode(tile: MarketMapTile): MarketLabNode {
  return {
    ticker: tile.ticker,
    changePct: tile.changePct ?? 0,
    turnoverRub: tile.turnoverRub ?? 0,
    tradesCount: tile.tradesCount ?? 0,
    rangePct: tile.rangePct,
    moveWeightRub: tile.moveWeightRub ?? 0,
    absMoveWeightRub: tile.absMoveWeightRub ?? 0,
    liquidityRank: 0,
    activityRank: 0,
    status: "тихо",
  };
}

export type GravityBubbleNode = SimulationNodeDatum &
  MarketMapTile & {
    id: string;
    r: number;
    sizeMetric: number;
    liquidityNorm: number;
  };

function hashDelay(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(h) % 40) / 10;
}

function sqrtScale(value: number, minV: number, maxV: number): number {
  const sqrtMin = Math.sqrt(Math.max(minV, 1));
  const sqrtMax = Math.sqrt(Math.max(maxV, minV + 1));
  const v = Math.sqrt(Math.max(value, minV));
  return sqrtMax > sqrtMin ? (v - sqrtMin) / (sqrtMax - sqrtMin) : 0.5;
}

function radiusFromMetric(metric: number, minM: number, maxM: number): number {
  const norm = sqrtScale(metric, minM, maxM);
  return MIN_RADIUS + norm * (MAX_RADIUS - MIN_RADIUS);
}

function bubbleOpacity(tile: MarketMapTile): number {
  const changeIntensity = Math.min(1, Math.abs(tile.changePct ?? 0) / 4);
  const inPlay = tile.row.metrics.inPlayScore;
  const inPlayIntensity = inPlay != null ? Math.min(1, inPlay / 100) : 0;
  return 0.55 + Math.max(changeIntensity, inPlayIntensity * 0.85) * 0.4;
}

function buildNodes(tiles: MarketMapTile[], sizeMode: MarketMapMode): GravityBubbleNode[] {
  const metrics = tiles.map((t) => getModeSizeValue(t, sizeMode)).filter((v) => v > 0);
  const minM = metrics.length ? Math.min(...metrics) : 1;
  const maxM = metrics.length ? Math.max(...metrics) : minM;

  const turnovers = tiles.map((t) => t.turnoverRub ?? 0);
  const minT = turnovers.length ? Math.min(...turnovers.filter((v) => v > 0)) : 1;
  const maxT = turnovers.length ? Math.max(...turnovers) : minT;

  return tiles.map((tile) => {
    const sizeMetric = getModeSizeValue(tile, sizeMode);
    const turnover = tile.turnoverRub ?? minT;
    return {
      ...tile,
      id: tile.ticker,
      r: radiusFromMetric(Math.max(sizeMetric, minM * 0.01), minM, maxM),
      sizeMetric,
      liquidityNorm: sqrtScale(turnover, minT, maxT),
    };
  });
}

function clampNode(node: GravityBubbleNode, width: number, height: number) {
  const sidePad = 8;
  const topPad = 14;
  const bottomPad = 32;
  node.x = Math.max(node.r + sidePad, Math.min(width - node.r - sidePad, node.x ?? width / 2));
  node.y = Math.max(node.r + topPad, Math.min(height - node.r - bottomPad, node.y ?? height / 2));
}

function runLayout(
  tiles: MarketMapTile[],
  width: number,
  height: number,
  sizeMode: MarketMapMode,
  options?: { centerYRatio?: number },
): GravityBubbleNode[] {
  if (!tiles.length || width < 40 || height < 40) return [];

  const cx = width / 2;
  const cy = height * (options?.centerYRatio ?? 0.46);
  const spread = Math.min(width, height) * 0.34;
  const nodes = buildNodes(tiles, sizeMode);

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
    const jitter = 0.4 + (i % 5) * 0.1;
    node.x = cx + Math.cos(angle) * spread * jitter;
    node.y = cy + Math.sin(angle) * spread * jitter;
  }

  const maxRadial = Math.min(width, height) * 0.38;

  const simulation = forceSimulation<GravityBubbleNode>(nodes)
    .force("center", forceCenter(cx, cy).strength(0.1))
    .force("x", forceX(cx).strength(0.04))
    .force("y", forceY(cy).strength(0.04))
    .force(
      "radial",
      forceRadial<GravityBubbleNode>(
        (d) => maxRadial * (0.25 + (1 - d.liquidityNorm) * 0.75),
        cx,
        cy,
      ).strength(0.32),
    )
    .force(
      "collide",
      forceCollide<GravityBubbleNode>()
        .radius((d) => d.r + COLLIDE_PADDING)
        .strength(0.95)
        .iterations(4),
    )
    .stop();

  for (let i = 0; i < SIM_TICKS; i++) simulation.tick();

  for (const node of nodes) clampNode(node, width, height);
  return nodes;
}

function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return mobile;
}

function BubbleTooltip({
  node,
  maxTrades,
  style,
  whyHere,
}: {
  node: GravityBubbleNode;
  maxTrades: number;
  style: React.CSSProperties;
  whyHere?: string | null;
}) {
  const surface = tileSurfaceStyle(node, "turnover", maxTrades);
  return (
    <div
      className="pointer-events-none absolute z-30 min-w-[200px] rounded-xl border border-white/10 bg-slate-950/92 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-xl"
      style={style}
    >
      <p className="text-lg font-semibold tracking-wide text-white">{node.ticker}</p>
      <dl className="mt-2 space-y-1 text-[11px]">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Изменение</dt>
          <dd className={cn("font-mono tabular-nums", surface.textPct)}>
            {tradingFormat.formatSignedPercent(node.changePct)}
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
          <dt className="text-slate-500">Диапазон</dt>
          <dd className="font-mono tabular-nums text-slate-200">
            {tradingFormat.formatDayRangeMagnitude(node.rangePct)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Денежный импульс</dt>
          <dd className="font-mono tabular-nums text-slate-200">{formatMoveWeightCompact(node.moveWeightRub)}</dd>
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

function MobileBubbleList({
  tiles,
  sizeMode,
  selectedId,
  onSelect,
}: {
  tiles: MarketMapTile[];
  sizeMode: MarketMapMode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = React.useMemo(
    () => [...tiles].sort((a, b) => getModeSizeValue(b, sizeMode) - getModeSizeValue(a, sizeMode)),
    [tiles, sizeMode],
  );

  return (
    <ul className="max-h-[min(70vh,640px)] space-y-2 overflow-y-auto pr-1">
      {sorted.map((tile) => {
        const change = tile.changePct ?? 0;
        const isSelected = selectedId === tile.ticker;
        return (
          <li key={tile.ticker}>
            <button
              type="button"
              onClick={() => onSelect(tile.ticker)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                isSelected
                  ? "border-violet-500/30 bg-violet-950/30"
                  : "border-white/[0.06] bg-slate-900/40 hover:border-white/10",
              )}
            >
              <span className="font-semibold tracking-wide text-slate-100">{tile.ticker}</span>
              <span
                className={cn(
                  "font-mono text-xs tabular-nums",
                  change > 0 ? "text-emerald-300" : change < 0 ? "text-rose-300" : "text-slate-400",
                )}
              >
                {tradingFormat.formatSignedPercent(tile.changePct)}
              </span>
              <span className="font-mono text-[11px] text-slate-500">{formatTurnoverCompact(tile.turnoverRub)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export interface GravityMarketMapProps {
  tiles: MarketMapTile[];
  sizeMode: MarketMapMode;
  className?: string;
}

export function GravityMarketMap({ tiles, sizeMode, className }: GravityMarketMapProps) {
  const isMobile = useIsMobile();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 900, height: 520 });
  const [nodes, setNodes] = React.useState<GravityBubbleNode[]>([]);
  const [layoutSeed, setLayoutSeed] = React.useState(0);
  const [recenterLayout, setRecenterLayout] = React.useState(false);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const maxTrades = React.useMemo(
    () => tiles.reduce((max, tile) => Math.max(max, tile.tradesCount ?? 0), 0),
    [tiles],
  );

  const maxTurnover = React.useMemo(
    () => tiles.reduce((max, tile) => Math.max(max, tile.turnoverRub ?? 0), 0),
    [tiles],
  );

  const selectedTile = React.useMemo(
    () => tiles.find((t) => t.ticker === selectedId) ?? null,
    [tiles, selectedId],
  );

  const hoveredNode = React.useMemo(
    () => (hoveredId ? (nodes.find((n) => n.id === hoveredId) ?? null) : null),
    [hoveredId, nodes],
  );

  const hoveredWhyHere = React.useMemo(() => {
    if (!hoveredNode || hoveredNode.r < LABEL_FULL_RADIUS) return null;
    return explainBubbleWhyHere(tileToLabNode(hoveredNode), {
      liquidityNorm: hoveredNode.liquidityNorm,
      maxTurnover,
    });
  }, [hoveredNode, maxTurnover]);

  React.useEffect(() => {
    if (isMobile) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile]);

  React.useEffect(() => {
    if (isMobile) {
      setNodes([]);
      return;
    }
    const layout = runLayout(tiles, size.width, size.height, sizeMode, {
      centerYRatio: recenterLayout ? 0.5 : 0.46,
    });
    setNodes(layout);
  }, [tiles, size.width, size.height, sizeMode, isMobile, layoutSeed, recenterLayout]);

  React.useEffect(() => {
    if (selectedId && !tiles.some((t) => t.ticker === selectedId)) {
      setSelectedId(null);
    }
  }, [tiles, selectedId]);

  if (!tiles.length) {
    return <LabEmptyState message="Нет данных для карты. Проверьте подключение к MOEX ISS или повторите позже." />;
  }

  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-start", className)}>
      <div className="min-w-0 flex-1">
        {isMobile ? (
          <MobileBubbleList
            tiles={tiles}
            sizeMode={sizeMode}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : (
          <div
            ref={containerRef}
            className={cn(
              "relative min-h-[min(72vh,600px)] w-full overflow-hidden rounded-2xl",
              "border border-white/[0.05] bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(30,41,59,0.35),rgba(2,6,23,0.92))]",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.55)]",
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(139,92,246,0.06),transparent_55%)]" />

            <div className="absolute left-3 top-3 z-20 max-w-[min(92%,380px)]">
              <p className="mb-1 text-[9px] uppercase tracking-[0.14em] text-slate-600">Легенда</p>
              <p className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] leading-snug text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm">
                {BUBBLE_MAP_LEGEND}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setRecenterLayout(true);
                setLayoutSeed((s) => s + 1);
              }}
              className="absolute right-3 top-3 z-20 rounded-md border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300 backdrop-blur-sm transition hover:border-white/15 hover:text-white"
            >
              Центрировать
            </button>

            <div className="absolute inset-0">
              {nodes.map((node) => {
                const surface = tileSurfaceStyle(node, "turnover", maxTrades);
                const isHovered = hoveredId === node.id;
                const isSelected = selectedId === node.id;
                const showFull = node.r >= LABEL_FULL_RADIUS;
                const showTicker = node.r >= LABEL_TICKER_RADIUS;
                const x = node.x ?? 0;
                const y = node.y ?? 0;
                const diameter = node.r * 2;
                const opacity = bubbleOpacity(node);

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                    className={cn(
                      "absolute flex flex-col items-center justify-center rounded-full border backdrop-blur-md",
                      "gravity-bubble-pulse transition-[box-shadow,filter,border-color,transform] duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
                      isHovered && "z-20 brightness-125",
                      isSelected && "ring-2 ring-violet-400/35",
                    )}
                    style={{
                      width: diameter,
                      height: diameter,
                      left: x - node.r,
                      top: y - node.r,
                      opacity,
                      background: surface.background,
                      borderColor: isSelected || isHovered ? "rgba(196,181,253,0.4)" : surface.border,
                      boxShadow: isHovered
                        ? `${surface.glow === "none" ? "" : `${surface.glow}, `}0 0 36px rgba(139,92,246,0.28), inset 0 1px 0 rgba(255,255,255,0.12)`
                        : surface.glow === "none"
                          ? "inset 0 1px 0 rgba(255,255,255,0.06)"
                          : `${surface.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
                      animationDelay: `${hashDelay(node.ticker)}s`,
                    }}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId((id) => (id === node.id ? null : id))}
                    aria-label={`${node.ticker}, ${tradingFormat.formatSignedPercent(node.changePct)}`}
                    aria-pressed={isSelected}
                  >
                    {showFull ? (
                      <span className="pointer-events-none flex flex-col items-center px-1 text-center leading-tight">
                        <span className="text-sm font-semibold tracking-[0.1em] text-white/95">{node.ticker}</span>
                        <span className={cn("font-mono text-[11px] tabular-nums", surface.textPct)}>
                          {tradingFormat.formatSignedPercent(node.changePct)}
                        </span>
                        <span className="mt-0.5 font-mono text-[9px] tabular-nums text-slate-400/90">
                          {formatTurnoverCompact(node.turnoverRub)}
                        </span>
                      </span>
                    ) : showTicker ? (
                      <span className="pointer-events-none text-[10px] font-semibold tracking-[0.08em] text-white/90">
                        {node.ticker}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {hoveredNode ? (
              <BubbleTooltip
                node={hoveredNode}
                maxTrades={maxTrades}
                whyHere={hoveredWhyHere}
                style={{
                  left: Math.min(size.width - 210, Math.max(12, (hoveredNode.x ?? 0) - 100)),
                  top: Math.max(12, (hoveredNode.y ?? 0) - hoveredNode.r - 100),
                }}
              />
            ) : null}


          </div>
        )}
      </div>

      <MarketMapInspector tile={selectedTile} maxTurnover={maxTurnover} className="w-full shrink-0 lg:w-auto" />
    </div>
  );
}


