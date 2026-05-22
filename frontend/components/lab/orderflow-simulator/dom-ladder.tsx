"use client";

import * as React from "react";
import { DomLadderRow } from "@/components/lab/orderflow-simulator/dom-ladder-row";
import { DomLadderSettings } from "@/components/lab/orderflow-simulator/dom-ladder-settings";
import type { ExecutedLevelFlash } from "@/lib/domain/orderflow-simulator-engine";
import type { SimClusterCell, SimIcebergLevel, SimOrderBookLevel, SimTradePrint } from "@/lib/domain/orderflow-simulator";
import type { DomFocusLevelSelection, DomFocusTeachingHighlight } from "@/lib/domain/dom-focus-teaching";
import { isTeachingHighlight, selectionMatches } from "@/lib/domain/dom-focus-teaching";
import type { DomLevelTooltipData } from "@/lib/domain/order-book-ladder-model";
import type { TapeLevelHighlight } from "@/lib/domain/tape-bubbles-model";
import { buildDomScrollLayout, type DomScrollLayout } from "@/lib/domain/dom-tape-layout";
import { BUBBLE_LIFETIME_MS } from "@/lib/domain/tape-bubbles-model";
import type { PriceViewport } from "@/lib/domain/orderflow-price-viewport";
import type { LadderLevelCount } from "@/lib/domain/order-book-ladder-model";
import {
  DEFAULT_DOM_LADDER_SETTINGS,
  buildDomLevelTooltip,
  findBestBidAsk,
  flashesAtPrice,
  getActiveFlashes,
  getDomGridLineKind,
  pricesEqual,
  resolveDepthScale,
  spreadTicks,
  volumeDepthPercent,
  type LadderSettings,
  computeDepthStats,
} from "@/lib/domain/order-book-ladder-model";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

export type DomLadderProps = {
  levels: SimOrderBookLevel[];
  currentPrice: number;
  trades?: SimTradePrint[];
  clusters?: SimClusterCell[];
  icebergs?: SimIcebergLevel[];
  recentExecutedLevels?: ExecutedLevelFlash[];
  tapeHighlights?: TapeLevelHighlight[];
  priceViewport: PriceViewport;
  viewportAutoCenter?: boolean;
  onViewportAutoCenterChange?: (value: boolean) => void;
  onViewportLevelCountChange?: (count: LadderLevelCount) => void;
  onRecenterViewport?: () => void;
  showTeachingHints?: boolean;
  /** В составе DomTapeStack: общий скролл с лентой */
  stacked?: boolean;
  ladderSettings?: LadderSettings;
  onLadderSettingsChange?: (settings: LadderSettings) => void;
  scrollLayout?: DomScrollLayout;
  onScrollTopChange?: (scrollTop: number) => void;
  selectedLevel?: DomFocusLevelSelection | null;
  onLevelSelect?: (selection: DomFocusLevelSelection, tooltip: DomLevelTooltipData) => void;
  teachingHighlights?: DomFocusTeachingHighlight[];
  className?: string;
};

export function DomLadder({
  levels,
  currentPrice,
  trades = [],
  clusters = [],
  icebergs = [],
  recentExecutedLevels = [],
  tapeHighlights = [],
  priceViewport,
  viewportAutoCenter = true,
  onViewportAutoCenterChange,
  onViewportLevelCountChange,
  onRecenterViewport,
  showTeachingHints = false,
  stacked = false,
  ladderSettings: controlledSettings,
  onLadderSettingsChange,
  scrollLayout: scrollLayoutProp,
  onScrollTopChange,
  selectedLevel = null,
  onLevelSelect,
  teachingHighlights = [],
  className,
}: DomLadderProps) {
  const [internalSettings, setInternalSettings] = React.useState<LadderSettings>({
    ...DEFAULT_DOM_LADDER_SETTINGS,
    levelCount: priceViewport.levelsCount as LadderLevelCount,
    autoCenter: viewportAutoCenter,
  });
  const settings = controlledSettings ?? internalSettings;
  const [hoveredPrice, setHoveredPrice] = React.useState<number | null>(null);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [icebergPulses, setIcebergPulses] = React.useState<Map<string, number>>(new Map());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const currentRowRef = React.useRef<HTMLDivElement>(null);
  const prevLevelsRef = React.useRef(levels);

  React.useEffect(() => {
    if (controlledSettings) return;
    setInternalSettings((prev) => ({
      ...prev,
      levelCount: priceViewport.levelsCount as LadderLevelCount,
      autoCenter: viewportAutoCenter,
    }));
  }, [priceViewport.levelsCount, viewportAutoCenter, controlledSettings]);

  const levelAtPrice = React.useCallback(
    (price: number): SimOrderBookLevel =>
      levels.find((l) => pricesEqual(l.price, price)) ?? { price, bidSize: 0, askSize: 0 },
    [levels],
  );

  const handleSettingsChange = (next: LadderSettings) => {
    if (next.levelCount !== settings.levelCount) {
      onViewportLevelCountChange?.(next.levelCount);
    }
    if (next.autoCenter !== settings.autoCenter) {
      onViewportAutoCenterChange?.(next.autoCenter);
    }
    if (onLadderSettingsChange) onLadderSettingsChange(next);
    else setInternalSettings(next);
  };

  const scrollLayout = React.useMemo(
    () => scrollLayoutProp ?? buildDomScrollLayout(priceViewport, currentPrice, settings.rowHeight),
    [scrollLayoutProp, priceViewport, currentPrice, settings.rowHeight],
  );

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      onScrollTopChange?.(e.currentTarget.scrollTop);
    },
    [onScrollTopChange],
  );

  const visibleLevels = React.useMemo(
    () => priceViewport.prices.map(levelAtPrice),
    [priceViewport.prices, levelAtPrice],
  );

  const best = React.useMemo(() => findBestBidAsk(visibleLevels), [visibleLevels]);
  const stats = React.useMemo(() => computeDepthStats(visibleLevels), [visibleLevels]);
  const resolvedScale = React.useMemo(
    () => resolveDepthScale(settings.depthScale, stats),
    [settings.depthScale, stats],
  );
  const ticks = spreadTicks(best);

  const activeFlashes = React.useMemo(
    () => getActiveFlashes(recentExecutedLevels, nowMs, 600),
    [recentExecutedLevels, nowMs],
  );

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 80);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const prev = prevLevelsRef.current;
    const nextPulses = new Map<string, number>();
    const ts = Date.now();
    for (const level of levels) {
      const prevLevel = prev.find((l) => pricesEqual(l.price, level.price));
      if (!prevLevel) continue;
      if (level.bidIsIceberg && level.bidSize > prevLevel.bidSize + 1) {
        nextPulses.set(`bid-${level.price}`, ts);
      }
      if (level.askIsIceberg && level.askSize > prevLevel.askSize + 1) {
        nextPulses.set(`ask-${level.price}`, ts);
      }
    }
    if (nextPulses.size > 0) {
      setIcebergPulses((current) => new Map([...current, ...nextPulses]));
    }
    prevLevelsRef.current = levels;
  }, [levels]);

  React.useEffect(() => {
    if (icebergPulses.size === 0) return undefined;
    const id = window.setTimeout(() => {
      setIcebergPulses((current) => {
        const cutoff = Date.now() - 500;
        const next = new Map<string, number>();
        for (const [key, ts] of current) {
          if (ts > cutoff) next.set(key, ts);
        }
        return next;
      });
    }, 520);
    return () => window.clearTimeout(id);
  }, [icebergPulses]);

  React.useEffect(() => {
    if (!settings.autoCenter || !currentRowRef.current) return;
    currentRowRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentPrice, settings.autoCenter, settings.levelCount, visibleLevels.length]);

  const askLevels = React.useMemo(
    () =>
      priceViewport.prices
        .filter((p) => p > currentPrice + priceViewport.tickSize / 2)
        .map(levelAtPrice),
    [priceViewport, levelAtPrice, currentPrice],
  );

  const bidLevels = React.useMemo(
    () =>
      priceViewport.prices
        .filter((p) => p < currentPrice - priceViewport.tickSize / 2)
        .map(levelAtPrice)
        .sort((a, b) => b.price - a.price),
    [priceViewport, levelAtPrice, currentPrice],
  );

  const isTapeHighlighted = React.useCallback(
    (price: number, bookSide: "ask" | "bid") => {
      const hit = tapeHighlights.find(
        (h) => h.bookSide === bookSide && pricesEqual(h.price, price) && nowMs - h.timestamp <= BUBBLE_LIFETIME_MS,
      );
      return hit;
    },
    [tapeHighlights, nowMs],
  );

  const tapeHighlightStrong = React.useCallback(
    (price: number, bookSide: "ask" | "bid") => {
      const hit = tapeHighlights.find(
        (h) => h.bookSide === bookSide && pricesEqual(h.price, price) && nowMs - h.timestamp <= BUBBLE_LIFETIME_MS,
      );
      return Boolean(hit?.strong);
    },
    [tapeHighlights, nowMs],
  );

  const renderRow = (level: SimOrderBookLevel, side: "ask" | "bid") => {
    const size = side === "ask" ? level.askSize : level.bidSize;
    const flashes = flashesAtPrice(activeFlashes, level.price, side);
    const isBestTouch =
      side === "ask"
        ? best.bestAsk !== null && pricesEqual(level.price, best.bestAsk)
        : best.bestBid !== null && pricesEqual(level.price, best.bestBid);

    const tooltip = buildDomLevelTooltip(
      level,
      side,
      stats,
      settings,
      trades,
      clusters,
      flashes[0],
      resolvedScale,
    );

    const teach = isTeachingHighlight(teachingHighlights, level.price, side);
    const icebergHit = icebergs.find(
      (ib) => ib.side === side && pricesEqual(ib.price, level.price),
    );

    return (
      <DomLadderRow
        key={`${side}-${level.price}`}
        level={level}
        side={side}
        rowHeight={settings.rowHeight}
        depthScale={resolvedScale}
        depthPct={volumeDepthPercent(size, resolvedScale)}
        isBestTouch={isBestTouch && size > 0}
        gridLine={getDomGridLineKind(level.price, priceViewport.tickSize)}
        flashes={flashes}
        showRoundPrints={settings.showRoundPrints}
        icebergPulse={icebergPulses.has(`${side}-${level.price}`)}
        tapeHighlight={Boolean(isTapeHighlighted(level.price, side))}
        tapeHighlightStrong={tapeHighlightStrong(level.price, side)}
        teachingHighlight={teach.active}
        teachingHighlightStrong={teach.strong}
        selected={selectionMatches(selectedLevel, level.price, side)}
        tooltip={tooltip}
        icebergExecuted={icebergHit?.executedTotal}
        hovered={hoveredPrice !== null && pricesEqual(hoveredPrice, level.price)}
        onHover={setHoveredPrice}
        onSelect={onLevelSelect ? () => onLevelSelect({ price: level.price, side }, tooltip) : undefined}
      />
    );
  };

  const [lessonHintVisible, setLessonHintVisible] = React.useState(false);

  const scrollBody = (
    <>
      {askLevels.map((level) => renderRow(level, "ask"))}
      <div
        ref={currentRowRef}
        className="orderflow-current-price-line dom-last-price sticky z-[5] border-y border-sky-400/40 bg-sky-950/35"
        style={{ minHeight: settings.rowHeight + 4 }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_46px] items-center gap-0 px-0 font-mono leading-none">
          <span className="pl-1 text-[7px] uppercase tracking-wider text-sky-300/80">текущая · симуляция</span>
          <span className="pr-0.5 text-right text-[11px] font-bold tabular-nums text-sky-50">
            {formatPrice(currentPrice)}
          </span>
        </div>
      </div>
      {bidLevels.map((level) => renderRow(level, "bid"))}
    </>
  );

  const spreadBand = (
    <div className="dom-spread-band shrink-0 border-b border-white/[0.04] px-1.5 py-px font-mono text-[8px] tabular-nums text-slate-500">
      <span className="text-rose-300/75">{best.bestAsk != null ? formatPrice(best.bestAsk) : "—"}</span>
      <span className="mx-1 text-slate-700">|</span>
      <span>спред {ticks ?? 0}т</span>
      <span className="mx-1 text-slate-700">|</span>
      <span className="text-emerald-300/75">{best.bestBid != null ? formatPrice(best.bestBid) : "—"}</span>
    </div>
  );

  if (stacked) {
    return (
      <div
        className={cn("dom-ladder dom-ladder--stacked flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#010204]", className)}
        onMouseEnter={() => showTeachingHints && setLessonHintVisible(true)}
        onMouseLeave={() => setLessonHintVisible(false)}
      >
        {spreadBand}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="dom-ladder-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div style={{ minHeight: scrollLayout.contentHeightPx }}>{scrollBody}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "dom-ladder flex min-h-0 w-full min-w-[148px] max-w-[188px] flex-col overflow-hidden rounded-none border-0 bg-[#010204]",
        className,
      )}
      onMouseEnter={() => showTeachingHints && setLessonHintVisible(true)}
      onMouseLeave={() => setLessonHintVisible(false)}
    >
      <div className="orderflow-pane-header shrink-0 border-b border-white/[0.04] px-1.5 py-0.5 text-[9px]">
        Стакан · GAZP
      </div>

      <DomLadderSettings settings={settings} onChange={handleSettingsChange} onRecenter={onRecenterViewport} />

      {lessonHintVisible && showTeachingHints ? (
        <p className="border-b border-violet-500/12 bg-violet-950/20 px-1.5 py-0.5 font-mono text-[8px] leading-snug text-violet-200/85">
          Объём слева · цена справа · симуляция
        </p>
      ) : null}

      {spreadBand}

      <div ref={scrollRef} onScroll={handleScroll} className="dom-ladder-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {scrollBody}
      </div>
    </div>
  );
}