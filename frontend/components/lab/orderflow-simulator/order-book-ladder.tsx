"use client";

import * as React from "react";
import {
  DEFAULT_LADDER_SETTINGS,
  OrderBookLadderSettings,
} from "@/components/lab/orderflow-simulator/order-book-ladder-settings";
import { ScalpPriceLadder } from "@/components/lab/orderflow-simulator/scalp-price-ladder";
import type { TapeLevelHighlight } from "@/lib/domain/tape-bubbles-model";
import type { LadderLevelCount } from "@/lib/domain/order-book-ladder-model";
import type { PriceViewport } from "@/lib/domain/orderflow-price-viewport";
import type { ExecutedLevelFlash, ScenarioAnnotation } from "@/lib/domain/orderflow-simulator-engine";
import type { SimClusterCell, SimOrderBookLevel, SimTradePrint } from "@/lib/domain/orderflow-simulator";
import {
  buildLevelTooltip,
  computeDepthStats,
  cumulativeAskDepth,
  cumulativeBidDepth,
  findBestBidAsk,
  flashesAtPrice,
  formatLots,
  getActiveFlashes,
  getLevelZone,
  isDensitySize,
  pricesEqual,
  profileWidth,
  resolveDepthScale,
  selectVisibleLevels,
  volumeDepthPercent,
  type ActiveFlash,
  type LadderSettings,
  type LevelTooltipData,
} from "@/lib/domain/order-book-ladder-model";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

type OrderBookLadderProps = {
  levels: SimOrderBookLevel[];
  currentPrice: number;
  trades?: SimTradePrint[];
  clusters?: SimClusterCell[];
  recentExecutedLevels?: ExecutedLevelFlash[];
  annotations?: ScenarioAnnotation[];
  showTeachingHints?: boolean;
  presentation?: boolean;
  terminal?: boolean;
  scalp?: boolean;
  tapeHighlights?: TapeLevelHighlight[];
  priceViewport?: PriceViewport;
  viewportAutoCenter?: boolean;
  onViewportAutoCenterChange?: (value: boolean) => void;
  onViewportLevelCountChange?: (count: LadderLevelCount) => void;
  onRecenterViewport?: () => void;
  className?: string;
};

const GRID_COLS =
  "grid-cols-[minmax(14px,0.45fr)_minmax(36px,0.7fr)_minmax(18px,0.35fr)_minmax(54px,0.95fr)_minmax(18px,0.35fr)_minmax(36px,0.7fr)_minmax(14px,0.45fr)]";

const ZONE_BG: Record<string, string> = {
  ask: "bg-rose-950/25",
  bid: "bg-emerald-950/22",
  spread: "bg-slate-900/50",
  neutral: "",
};

function LevelTooltip({ data }: { data: LevelTooltipData }) {
  const zoneLabel =
    data.zone === "ask" ? "зона ask" : data.zone === "bid" ? "зона bid" : data.zone === "spread" ? "спред" : "—";

  return (
    <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden min-w-[200px] rounded border border-white/10 bg-[#0c1018] p-2 text-left font-mono text-[10px] leading-relaxed text-slate-300 shadow-xl group-hover/level:block">
      <p className="text-sky-300">Цена: {formatPrice(data.price)}</p>
      <p>Bid: {data.bidSize || "—"} · Ask: {data.askSize || "—"}</p>
      <p className="text-slate-500">{zoneLabel}</p>
      <p>Крупная плотность bid: {data.bidDensity ? "да" : "нет"}</p>
      <p>Крупная плотность ask: {data.askDensity ? "да" : "нет"}</p>
      <p>Айсберг bid: {data.bidIceberg ? "да" : "нет"}</p>
      <p>Айсберг ask: {data.askIceberg ? "да" : "нет"}</p>
      <p>Сделок по уровню: {data.tradeCount}</p>
      {data.delta !== null ? (
        <p>
          Δ кластера: {data.delta > 0 ? "+" : ""}
          {data.delta}
        </p>
      ) : null}
      {data.aggressorHint ? (
        <p className="text-amber-200/90">
          Последний удар: {data.aggressorHint === "buy" ? "рыночная покупка" : "рыночная продажа"}
        </p>
      ) : null}
    </div>
  );
}

function PrintFlash({ flashes, side }: { flashes: ActiveFlash[]; side: "bid" | "ask" }) {
  if (flashes.length === 0) return <span className="text-slate-800">·</span>;

  const latest = flashes[0]!;
  const isBuy = latest.aggressorSide === "buy";
  const opacity = Math.max(0.35, 1 - latest.ageMs / 600);

  return (
    <span
      className={cn(
        "dom-print-flash inline-block h-2 w-2 rounded-full",
        side === "ask"
          ? isBuy
            ? "bg-rose-300"
            : "bg-rose-500/60"
          : isBuy
            ? "bg-emerald-500/60"
            : "bg-emerald-300",
      )}
      style={{ opacity, boxShadow: `0 0 10px ${side === "ask" ? "rgba(251,113,133,0.7)" : "rgba(52,211,153,0.7)"}` }}
      title={`${latest.size} @ ${formatPrice(latest.price)}`}
    />
  );
}

export function OrderBookLadder({
  levels,
  currentPrice,
  trades = [],
  clusters = [],
  recentExecutedLevels = [],
  annotations = [],
  showTeachingHints = false,
  presentation = false,
  terminal = false,
  scalp = false,
  tapeHighlights = [],
  priceViewport,
  viewportAutoCenter = true,
  onViewportAutoCenterChange,
  onViewportLevelCountChange,
  onRecenterViewport,
  className,
}: OrderBookLadderProps) {
  const [settings, setSettings] = React.useState<LadderSettings>(DEFAULT_LADDER_SETTINGS);
  const [hoveredPrice, setHoveredPrice] = React.useState<number | null>(null);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const currentRowRef = React.useRef<HTMLDivElement>(null);

  const visibleLevels = React.useMemo(
    () => selectVisibleLevels(levels, currentPrice, settings.levelCount),
    [levels, currentPrice, settings.levelCount],
  );

  const best = React.useMemo(() => findBestBidAsk(visibleLevels), [visibleLevels]);
  const stats = React.useMemo(() => computeDepthStats(visibleLevels), [visibleLevels]);
  const resolvedDepthScale = React.useMemo(
    () => resolveDepthScale(settings.depthScale, stats),
    [settings.depthScale, stats],
  );

  const bidCum = React.useMemo(
    () => cumulativeBidDepth(visibleLevels, best.bestBid ?? currentPrice),
    [visibleLevels, best.bestBid, currentPrice],
  );
  const askCum = React.useMemo(
    () => cumulativeAskDepth(visibleLevels, best.bestAsk ?? currentPrice),
    [visibleLevels, best.bestAsk, currentPrice],
  );

  const maxBidCum = Math.max(...bidCum.values(), 1);
  const maxAskCum = Math.max(...askCum.values(), 1);

  const activeFlashes = React.useMemo(
    () => getActiveFlashes(recentExecutedLevels, nowMs, 600),
    [recentExecutedLevels, nowMs],
  );

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 80);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!settings.autoCenter || !currentRowRef.current || !scrollRef.current) return;
    currentRowRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentPrice, settings.autoCenter, settings.levelCount, visibleLevels.length]);

  const [lessonHintVisible, setLessonHintVisible] = React.useState(false);

  if (scalp && priceViewport) {
    return (
      <ScalpPriceLadder
        levels={levels}
        currentPrice={currentPrice}
        trades={trades}
        clusters={clusters}
        recentExecutedLevels={recentExecutedLevels}
        tapeHighlights={tapeHighlights}
        priceViewport={priceViewport}
        viewportAutoCenter={viewportAutoCenter}
        onViewportAutoCenterChange={onViewportAutoCenterChange}
        onViewportLevelCountChange={onViewportLevelCountChange}
        onRecenterViewport={onRecenterViewport}
        showTeachingHints={showTeachingHints}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        "orderflow-terminal-panel flex min-h-0 flex-col overflow-hidden",
        terminal ? "rounded-none border-0 bg-[#020408]" : "rounded-lg border border-white/[0.06] bg-[#060a14]",
        className,
      )}
      onMouseEnter={() => showTeachingHints && setLessonHintVisible(true)}
      onMouseLeave={() => setLessonHintVisible(false)}
    >
      {!terminal ? (
        <div className="border-b border-white/[0.05] px-3 py-2">
          <h3 className={cn("font-medium uppercase tracking-[0.12em] text-slate-400", presentation ? "text-sm" : "text-xs")}>
            Стакан · price ladder
          </h3>
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">симуляция · не биржевой поток</p>
        </div>
      ) : (
        <div className="orderflow-pane-header">DOM · симуляция</div>
      )}

      <OrderBookLadderSettings settings={settings} onChange={setSettings} />

      {lessonHintVisible && showTeachingHints ? (
        <p className="border-b border-violet-500/15 bg-violet-950/25 px-2 py-1 font-mono text-[10px] leading-snug text-violet-200/90">
          Лимитные заявки стоят в стакане. Рыночная сделка забирает встречную ликвидность.
        </p>
      ) : null}

      <div
        className={cn(
          "grid border-b border-white/[0.04] px-1 py-1 font-mono text-[8px] uppercase tracking-wider text-slate-600",
          GRID_COLS,
          !settings.showProfile && "grid-cols-[minmax(36px,0.7fr)_minmax(18px,0.35fr)_minmax(48px,0.85fr)_minmax(18px,0.35fr)_minmax(36px,0.7fr)]",
        )}
      >
        {settings.showProfile ? <span className="text-right">Проф.b</span> : null}
        <span className="text-right">Bid</span>
        <span className="text-center">Пр.</span>
        <span className="text-center">Цена</span>
        <span className="text-center">Пр.</span>
        <span>Ask</span>
        {settings.showProfile ? <span>Проф.a</span> : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {visibleLevels.map((level) => {
          const isCurrent = pricesEqual(level.price, currentPrice);
          const zone = getLevelZone(level.price, best);
          const bidDepthPct = volumeDepthPercent(level.bidSize, resolvedDepthScale);
          const askDepthPct = volumeDepthPercent(level.askSize, resolvedDepthScale);
          const bidWall = Boolean(level.bidIsLarge);
          const askWall = Boolean(level.askIsLarge);
          const bidDense =
            settings.showDensities &&
            !bidWall &&
            isDensitySize(level.bidSize, "bid", stats, false);
          const askDense =
            settings.showDensities &&
            !askWall &&
            isDensitySize(level.askSize, "ask", stats, false);
          const bidFlashes = flashesAtPrice(activeFlashes, level.price, "bid");
          const askFlashes = flashesAtPrice(activeFlashes, level.price, "ask");
          const bidHit = bidFlashes.length > 0;
          const askHit = askFlashes.length > 0;

          const bidCumulative = bidCum.get(level.price) ?? 0;
          const askCumulative = askCum.get(level.price) ?? 0;
          const bidProfilePct = profileWidth(bidCumulative, maxBidCum);
          const askProfilePct = profileWidth(askCumulative, maxAskCum);

          const tooltip = buildLevelTooltip(
            level,
            zone,
            stats,
            settings.showDensities,
            trades,
            clusters,
            [...bidFlashes, ...askFlashes].sort((a, b) => a.ageMs - b.ageMs)[0],
          );

          const annotation = annotations.find(
            (a) => typeof a.price === "number" && pricesEqual(a.price!, level.price),
          );

          return (
            <div
              key={level.price}
              ref={isCurrent ? currentRowRef : undefined}
              className={cn(
                "group/level relative grid items-center gap-x-0.5 px-0.5 font-mono leading-none",
                settings.showProfile ? GRID_COLS : "grid-cols-[minmax(36px,0.7fr)_minmax(18px,0.35fr)_minmax(48px,0.85fr)_minmax(18px,0.35fr)_minmax(36px,0.7fr)]",
                terminal ? "py-[2px] text-[10px]" : "py-[3px] text-[11px]",
                ZONE_BG[zone],
                isCurrent && "orderflow-current-price-line z-[2] bg-sky-500/20 ring-1 ring-inset ring-sky-300/55",
                level.isRoundLevel && "ring-1 ring-inset ring-slate-400/20",
                level.isMarketMakerLevel && "ring-1 ring-inset ring-cyan-500/12",
                bidWall && "dom-wall-bid",
                askWall && "dom-wall-ask",
                bidHit && "dom-hit-bid",
                askHit && "dom-hit-ask",
                annotation && "ring-1 ring-inset ring-amber-400/25",
              )}
              onMouseEnter={() => setHoveredPrice(level.price)}
              onMouseLeave={() => setHoveredPrice(null)}
            >
              {hoveredPrice !== null && pricesEqual(hoveredPrice, level.price) ? (
                <LevelTooltip data={tooltip} />
              ) : null}

              {settings.showProfile ? (
                <div className="relative h-3">
                  <div
                    className="absolute inset-y-0 right-0 rounded-sm bg-emerald-600/20"
                    style={{ width: `${bidProfilePct}%` }}
                  />
                </div>
              ) : null}

              <div className="relative flex min-h-[18px] items-center justify-end pr-0.5">
                {level.bidSize > 0 ? (
                  <>
                    <div
                      className={cn(
                        "absolute inset-y-0 right-0 rounded-sm",
                        bidWall ? "bg-amber-500/40" : bidDense ? "bg-amber-500/28" : "bg-emerald-600/22",
                        bidHit && "dom-depth-flash-bid",
                      )}
                      style={{ width: `${bidDepthPct}%` }}
                    />
                    <span
                      className={cn(
                        "relative z-[1] tabular-nums",
                        level.bidIsIceberg &&
                          "rounded border border-violet-400/60 px-0.5 shadow-[0_0_6px_rgba(167,139,250,0.35)]",
                        bidWall ? "font-bold text-amber-100" : bidDense ? "font-semibold text-amber-200" : "text-emerald-300/95",
                      )}
                      title={
                        level.bidIsIceberg
                          ? "Видимый объём восстановился после исполнения — модель айсберга."
                          : bidDense
                            ? "крупная лимитная заявка"
                            : undefined
                      }
                    >
                      {formatLots(level.bidSize, settings.lotStep)}
                      {level.bidIsIceberg ? (
                        <span className="ml-0.5 text-[7px] text-violet-300">ice</span>
                      ) : null}
                      {bidWall ? (
                        <span className="ml-0.5 text-[7px] font-semibold uppercase text-amber-300">крупн.</span>
                      ) : bidDense && !level.bidIsIceberg ? (
                        <span className="ml-0.5 text-[7px] text-amber-400/90">плотн.</span>
                      ) : null}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-800">—</span>
                )}
              </div>

              <div className="flex justify-center">
                <PrintFlash flashes={bidFlashes} side="bid" />
              </div>

              <span
                className={cn(
                  "text-center tabular-nums tracking-tight",
                  isCurrent ? "text-[11px] font-bold text-sky-100 drop-shadow-[0_0_6px_rgba(56,189,248,0.45)]" : zone === "ask" ? "text-rose-200/90" : zone === "bid" ? "text-emerald-200/90" : "text-slate-300",
                )}
              >
                {formatPrice(level.price)}
              </span>

              <div className="flex justify-center">
                <PrintFlash flashes={askFlashes} side="ask" />
              </div>

              <div className="relative flex min-h-[18px] items-center justify-start pl-0.5">
                {level.askSize > 0 ? (
                  <>
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-sm",
                        askWall ? "bg-amber-500/40" : askDense ? "bg-amber-500/28" : "bg-rose-600/22",
                        askHit && "dom-depth-flash-ask",
                      )}
                      style={{ width: `${askDepthPct}%` }}
                    />
                    <span
                      className={cn(
                        "relative z-[1] tabular-nums",
                        level.askIsIceberg &&
                          "rounded border border-violet-400/60 px-0.5 shadow-[0_0_6px_rgba(167,139,250,0.35)]",
                        askWall ? "font-bold text-amber-100" : askDense ? "font-semibold text-amber-200" : "text-rose-300/95",
                      )}
                      title={
                        level.askIsIceberg
                          ? "Видимый объём восстановился после исполнения — модель айсберга."
                          : askDense
                            ? "крупная лимитная заявка"
                            : undefined
                      }
                    >
                      {formatLots(level.askSize, settings.lotStep)}
                      {level.askIsIceberg ? (
                        <span className="ml-0.5 text-[7px] text-violet-300">ice</span>
                      ) : null}
                      {askWall ? (
                        <span className="ml-0.5 text-[7px] font-semibold uppercase text-amber-300">крупн.</span>
                      ) : askDense && !level.askIsIceberg ? (
                        <span className="ml-0.5 text-[7px] text-amber-400/90">плотн.</span>
                      ) : null}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-800">—</span>
                )}
              </div>

              {settings.showProfile ? (
                <div className="relative h-3">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm bg-rose-600/20"
                    style={{ width: `${askProfilePct}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

