"use client";

import * as React from "react";
import type { GroupedTapeRow } from "@/lib/domain/orderflow-simulator-engine";
import { isLargeTrade } from "@/lib/domain/orderflow-simulator-engine";
import type { SimClusterCell, SimTradePrint } from "@/lib/domain/orderflow-simulator";
import { buildDomScrollLayout, type DomScrollLayout } from "@/lib/domain/dom-tape-layout";
import {
  aggressorLabelRu,
  buildActiveBubbles,
  buildClusterPulses,
  buildTapeLevelHighlights,
  bubbleDiameter,
  bubbleFreshness,
  bubbleOpacity,
  computeBubbleChainOffsets,
  eatenBookSide,
  formatBubbleVolume,
  layoutLaneBubble,
  TAPE_MERGE_OPTIONS,
  type ClusterPulse,
  type TapeBubble,
  type TapeLevelHighlight,
  type TapeMergeMs,
} from "@/lib/domain/tape-bubbles-model";
import type { PriceViewport } from "@/lib/domain/orderflow-price-viewport";
import { priceToTopPct } from "@/lib/domain/orderflow-price-viewport";
import type { LadderRowHeight } from "@/lib/domain/order-book-ladder-model";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

export type { TapeLevelHighlight } from "@/lib/domain/tape-bubbles-model";

type TapeBubbleLaneProps = {
  trades: SimTradePrint[];
  priceViewport: PriceViewport;
  currentPrice: number;
  aggregationWindowMs: TapeMergeMs;
  rowHeightPx?: LadderRowHeight;
  scrollTopPx?: number;
  scrollLayout?: DomScrollLayout;
  contentHeightPx?: number;
  maxVisibleBubbles?: number;
  clusters?: SimClusterCell[];
  onTradeHover?: (trade: GroupedTapeRow | null) => void;
  onLevelHighlight?: (highlights: TapeLevelHighlight[]) => void;
  onClusterPulse?: (pulses: ClusterPulse[]) => void;
  onMergeMsChange?: (ms: TapeMergeMs) => void;
  /** Встроен в колонку DOM — без заголовка и карточки */
  embedded?: boolean;
  showMergeControls?: boolean;
  className?: string;
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type BubbleTooltipProps = {
  bubble: TapeBubble;
};

function BubbleTooltip({ bubble }: BubbleTooltipProps) {
  const bookSide = eatenBookSide(bubble.aggressorSide);
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 w-max max-w-[180px] -translate-x-1/2 rounded border border-white/10 bg-[#0c1018] px-2 py-1.5 text-left font-mono text-[9px] leading-relaxed text-slate-300 shadow-xl">
      <p className="text-slate-400">{formatTime(bubble.timestamp)}</p>
      <p className="text-sky-200">{formatPrice(bubble.price)}</p>
      <p>Объём: {bubble.size}</p>
      <p className={bubble.aggressorSide === "buy" ? "text-emerald-300" : "text-rose-300"}>
        {aggressorLabelRu(bubble.aggressorSide)}
      </p>
      <p className="text-slate-500">Уровень: {bookSide}</p>
      {bubble.printCount > 1 ? (
        <p className="text-amber-300/80">Сложено: ×{bubble.printCount}</p>
      ) : null}
    </div>
  );
}

type LaneBubbleProps = {
  bubble: TapeBubble;
  layout: ReturnType<typeof layoutLaneBubble>;
  diameter: number;
  opacity: number;
  freshness: number;
  ageMs: number;
  usePixelTop: boolean;
  onHover: (trade: GroupedTapeRow | null) => void;
};

function LaneBubble({ bubble, layout, diameter, opacity, freshness, ageMs, usePixelTop, onHover }: LaneBubbleProps) {
  const isBuy = bubble.aggressorSide === "buy";
  const large = bubble.large || isLargeTrade(bubble.size);
  const [hovered, setHovered] = React.useState(false);
  const isFresh = ageMs < 800;

  if (layout.edge) {
    const label = layout.edge === "top" ? "выше" : "ниже";
    return (
      <div
        className="tape-bubble-edge absolute z-[2] font-mono text-[7px] uppercase tracking-wide"
        style={{
          top: layout.edge === "top" ? 4 : undefined,
          bottom: layout.edge === "bottom" ? 4 : undefined,
          left: `${layout.leftPct}%`,
          transform: "translate(-50%, -50%)",
          opacity: opacity * freshness,
        }}
        title={`${label} · ${formatPrice(bubble.price)}`}
      >
        <span className={isBuy ? "text-emerald-400/90" : "text-rose-400/90"}>{label}</span>
      </div>
    );
  }

  const topStyle =
    usePixelTop && layout.topPx !== undefined
      ? { top: layout.topPx, marginTop: -diameter / 2 }
      : { top: `${layout.topPct}%`, marginTop: -diameter / 2 };

  return (
    <div
      className={cn(
        "tape-bubble-lane-bubble absolute z-[3] flex cursor-default items-center justify-center rounded-full font-mono font-semibold tabular-nums",
        isBuy ? "bg-emerald-500/90 text-emerald-950" : "bg-rose-500/90 text-rose-950",
        isFresh && "tape-bubble-lane-bubble--spawn",
        large && "tape-bubble-lane-bubble--large ring-2 ring-amber-400/80",
        isBuy ? "shadow-[0_0_10px_rgba(52,211,153,0.35)]" : "shadow-[0_0_10px_rgba(244,63,94,0.35)]",
      )}
      style={{
        ...topStyle,
        left: `${layout.leftPct}%`,
        width: diameter,
        height: diameter,
        marginLeft: -diameter / 2,
        opacity: opacity * (0.55 + freshness * 0.45),
        fontSize: diameter >= 32 ? 10 : diameter >= 22 ? 9 : 8,
        zIndex: 10 + Math.floor(freshness * 20),
      }}
      onMouseEnter={() => {
        setHovered(true);
        onHover(bubble);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onHover(null);
      }}
    >
      {hovered ? <BubbleTooltip bubble={bubble} /> : null}
      {formatBubbleVolume(bubble.size)}
    </div>
  );
}

export function TapeBubbleLane({
  trades,
  priceViewport,
  currentPrice,
  aggregationWindowMs,
  rowHeightPx = 18,
  scrollTopPx = 0,
  scrollLayout: scrollLayoutProp,
  contentHeightPx: contentHeightProp,
  maxVisibleBubbles = 40,
  clusters = [],
  onTradeHover,
  onLevelHighlight,
  onClusterPulse,
  onMergeMsChange,
  embedded = false,
  showMergeControls = false,
  className,
}: TapeBubbleLaneProps) {
  const [mergeMs, setMergeMs] = React.useState<TapeMergeMs>(aggregationWindowMs);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const laneRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMergeMs(aggregationWindowMs);
  }, [aggregationWindowMs]);

  const handleMergeChange = (ms: TapeMergeMs) => {
    setMergeMs(ms);
    onMergeMsChange?.(ms);
  };

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 80);
    return () => window.clearInterval(id);
  }, []);

  const scrollLayout = React.useMemo(
    () => scrollLayoutProp ?? buildDomScrollLayout(priceViewport, currentPrice, rowHeightPx),
    [scrollLayoutProp, priceViewport, currentPrice, rowHeightPx],
  );

  const contentHeightPx = contentHeightProp ?? scrollLayout.contentHeightPx;

  const bubbles = React.useMemo(
    () => buildActiveBubbles(trades, mergeMs, nowMs, maxVisibleBubbles),
    [trades, mergeMs, nowMs, maxVisibleBubbles],
  );

  const chainOffsets = React.useMemo(() => computeBubbleChainOffsets(bubbles), [bubbles]);
  const maxBubbleSize = React.useMemo(() => Math.max(...bubbles.map((b) => b.size), 1), [bubbles]);
  const sortedBubbles = React.useMemo(
    () => [...bubbles].sort((a, b) => a.timestamp - b.timestamp),
    [bubbles],
  );

  const usePixelTop = embedded && scrollLayout !== undefined;

  React.useEffect(() => {
    if (!onLevelHighlight) return;
    onLevelHighlight(buildTapeLevelHighlights(bubbles));
  }, [bubbles, onLevelHighlight]);

  React.useEffect(() => {
    if (!onClusterPulse || bubbles.length === 0) return;
    const maxClusterVol = Math.max(...clusters.map((c) => c.totalVolume), 1);
    onClusterPulse(buildClusterPulses(bubbles, nowMs, maxClusterVol));
  }, [bubbles, nowMs, clusters, onClusterPulse]);

  const laneWidth = laneRef.current?.clientWidth ?? 76;

  const layoutMode = usePixelTop
    ? {
        kind: "dom-scroll" as const,
        layout: scrollLayout,
        scrollTopPx,
        laneWidthPx: laneWidth,
        viewport: priceViewport,
      }
    : { kind: "viewport-pct" as const, viewport: priceViewport, laneWidthPx: laneWidth };

  return (
    <div
      className={cn(
        embedded
          ? "tape-bubble-lane-embedded relative h-full min-h-0 w-full shrink-0"
          : "orderflow-terminal-panel flex min-h-0 flex-col overflow-hidden rounded-none border-0 bg-[#010306]",
        className,
      )}
    >
      {!embedded ? (
        <>
          <div className="orderflow-pane-header shrink-0">Лента</div>
          {showMergeControls ? (
            <div className="flex flex-wrap items-center gap-0.5 border-b border-indigo-500/10 bg-[#030508] px-1.5 py-0.5">
              <span className="text-[8px] uppercase tracking-wider text-slate-600">Складывать тики</span>
              {TAPE_MERGE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={cn(
                    "rounded border px-1 py-0.5 font-mono text-[8px] transition",
                    mergeMs === opt.value
                      ? "border-violet-500/35 bg-violet-950/40 text-violet-100"
                      : "border-white/[0.07] text-slate-500 hover:text-slate-300",
                  )}
                  onClick={() => handleMergeChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <div
        ref={laneRef}
        className={cn("relative w-full", embedded ? "h-full" : "min-h-0 flex-1")}
        style={embedded ? { minHeight: contentHeightPx } : undefined}
      >
        {!embedded ? (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-4 bg-gradient-to-b from-rose-950/30 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-4 bg-gradient-to-t from-emerald-950/30 to-transparent" />
          </>
        ) : null}

        <div
          className="pointer-events-none absolute inset-x-0 z-[1] border-t border-sky-400/25"
          style={{
            top: usePixelTop
              ? scrollLayout.priceToTopPx(currentPrice) - scrollTopPx
              : `${priceToTopPct(currentPrice, priceViewport)}%`,
          }}
        />

        <div
          className="relative w-full"
          style={{ minHeight: embedded ? contentHeightPx : 120, height: embedded ? contentHeightPx : "100%" }}
        >
          {sortedBubbles.length === 0 ? (
            embedded ? null : (
              <p className="absolute inset-0 flex items-center justify-center px-1 text-center font-mono text-[8px] leading-tight text-slate-600">
                Сделки · симуляция
              </p>
            )
          ) : (
            sortedBubbles.map((bubble) => {
              const key = `${bubble.id}-${bubble.timestamp}`;
              const chainPx = chainOffsets.get(key) ?? 0;
              const layout = layoutLaneBubble(bubble, chainPx, layoutMode);
              const ageMs = nowMs - bubble.timestamp;
              const opacity = bubbleOpacity(ageMs);
              if (opacity <= 0.02) return null;
              const freshness = bubbleFreshness(ageMs);
              const diameter = bubbleDiameter(bubble.size, maxBubbleSize);

              return (
                <LaneBubble
                  key={key}
                  bubble={bubble}
                  layout={layout}
                  diameter={diameter}
                  opacity={opacity}
                  freshness={freshness}
                  ageMs={ageMs}
                  usePixelTop={usePixelTop}
                  onHover={onTradeHover ?? (() => undefined)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
