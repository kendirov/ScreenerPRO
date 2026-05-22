"use client";

import * as React from "react";
import type { TickMergeMs } from "@/lib/domain/orderflow-simulator-engine";
import type { SimClusterCell, SimOrderBookLevel, SimTradePrint } from "@/lib/domain/orderflow-simulator";
import { TapeBubbleLane } from "@/components/lab/orderflow-simulator/tape-bubble-lane";
import {
  aggressorLabelRu,
  bubbleDiameter,
  bubbleOpacity,
  buildActiveBubbles,
  buildClusterPulses,
  getVisiblePriceRange,
  groupTapeForBubbles,
  layoutBubble,
  TAPE_MERGE_OPTIONS,
  type ClusterPulse,
  type TapeBubble,
  type TapeLevelHighlight,
  type TapeMergeMs,
} from "@/lib/domain/tape-bubbles-model";
import type { PriceViewport } from "@/lib/domain/orderflow-price-viewport";
import { formatPrice } from "@/lib/formatters/number";
import { isLargeTrade, type GroupedTapeRow } from "@/lib/domain/orderflow-simulator-engine";
import { cn } from "@/lib/utils/cn";

export type { ClusterPulse, TapeLevelHighlight } from "@/lib/domain/tape-bubbles-model";

type TapePrintFeedProps = {
  trades: SimTradePrint[];
  tickMergeMs: TickMergeMs;
  levels?: SimOrderBookLevel[];
  currentPrice?: number;
  clusters?: SimClusterCell[];
  onClusterPulse?: (pulses: ClusterPulse[]) => void;
  onLevelHighlight?: (highlights: TapeLevelHighlight[]) => void;
  showTeachingHints?: boolean;
  presentation?: boolean;
  terminal?: boolean;
  scalp?: boolean;
  priceViewport?: PriceViewport;
  className?: string;
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatSize(size: number): string {
  if (size >= 1000) return `${(size / 1000).toFixed(1)}k`;
  return String(size);
}

function TapeListRow({ row }: { row: GroupedTapeRow }) {
  const isBuy = row.aggressorSide === "buy";
  const large = isLargeTrade(row.size);

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-1.5 px-1.5 py-[3px] font-mono text-[10px] leading-none hover:bg-white/[0.03]">
      <span className="tabular-nums text-slate-500">
        {formatTime(row.timestamp)}
        {row.printCount > 1 ? <span className="ml-0.5 text-amber-400/80">×{row.printCount}</span> : null}
      </span>
      <span className={cn("text-right tabular-nums", isBuy ? "text-emerald-300" : "text-rose-300")}>
        {formatPrice(row.price)}
      </span>
      <span className={cn("text-right tabular-nums", large ? "font-semibold text-slate-100" : "text-slate-300")}>
        {formatSize(row.size)}
      </span>
      <span className={cn("text-right text-[9px]", isBuy ? "text-emerald-400/80" : "text-rose-400/80")}>
        {isBuy ? "пок" : "прод"}
      </span>
    </div>
  );
}

function TapeBubbleView({
  bubble,
  layout,
  diameter,
  opacity,
}: {
  bubble: TapeBubble;
  layout: ReturnType<typeof layoutBubble>;
  diameter: number;
  opacity: number;
}) {
  const isBuy = bubble.aggressorSide === "buy";
  const large = bubble.large || isLargeTrade(bubble.size);

  if (layout.edge) {
    return (
      <div
        className={cn(
          "tape-bubble-edge absolute z-[2] font-mono text-[8px]",
          layout.edge === "top" ? "top-0" : "bottom-0",
        )}
        style={{ left: `${layout.leftPct}%`, transform: "translateX(-50%)", opacity }}
        title={`${aggressorLabelRu(bubble.aggressorSide)} · ${formatPrice(bubble.price)} · ${bubble.size}`}
      >
        <span className={isBuy ? "text-emerald-400" : "text-rose-400"}>{layout.edge === "top" ? "▲" : "▼"}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "tape-bubble-enter absolute z-[3] flex items-center justify-center rounded-full font-mono font-semibold tabular-nums",
        isBuy ? "bg-emerald-500/85 text-emerald-950" : "bg-rose-500/85 text-rose-950",
        large && "tape-bubble-large ring-2 ring-amber-400/70",
        large && "tape-bubble-trail",
      )}
      style={{
        top: `${layout.topPct}%`,
        left: `${layout.leftPct}%`,
        width: diameter,
        height: diameter,
        marginTop: -diameter / 2,
        marginLeft: -diameter / 2,
        opacity,
        fontSize: diameter > 32 ? 10 : 8,
      }}
      title={[
        `Время: ${formatTime(bubble.timestamp)}`,
        `Цена: ${formatPrice(bubble.price)}`,
        `Объём: ${bubble.size}`,
        `Сторона: ${aggressorLabelRu(bubble.aggressorSide)}`,
        bubble.levelLabel,
      ].join("\n")}
    >
      {formatSize(bubble.size)}
    </div>
  );
}

export function TapePrintFeed({
  trades,
  tickMergeMs,
  levels = [],
  currentPrice = 0,
  clusters = [],
  onClusterPulse,
  onLevelHighlight,
  showTeachingHints = false,
  presentation = false,
  terminal = false,
  scalp = false,
  priceViewport,
  className,
}: TapePrintFeedProps) {
  const [mergeMs, setMergeMs] = React.useState<TapeMergeMs>(tickMergeMs);
  const [listOpen, setListOpen] = React.useState(!terminal && !presentation && !scalp);
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    setMergeMs(tickMergeMs);
  }, [tickMergeMs]);

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 80);
    return () => window.clearInterval(id);
  }, []);

  const bubbles = React.useMemo(
    () => buildActiveBubbles(trades, mergeMs, nowMs),
    [trades, mergeMs, nowMs],
  );

  const listLimit = terminal ? 36 : presentation ? 24 : 80;
  const listRows = React.useMemo(
    () => groupTapeForBubbles(trades, mergeMs).slice(0, listLimit),
    [trades, mergeMs, listLimit],
  );

  const priceRange = React.useMemo(
    () => getVisiblePriceRange(levels, currentPrice),
    [levels, currentPrice],
  );

  const maxBubbleSize = React.useMemo(
    () => Math.max(...bubbles.map((b) => b.size), 1),
    [bubbles],
  );

  const maxClusterVol = React.useMemo(
    () => Math.max(...clusters.map((c) => c.totalVolume), 1),
    [clusters],
  );

  React.useEffect(() => {
    if (scalp || !onClusterPulse || bubbles.length === 0) return;
    onClusterPulse(buildClusterPulses(bubbles, nowMs, maxClusterVol));
  }, [scalp, bubbles, nowMs, maxClusterVol, onClusterPulse]);

  const showBubbles = true;

  if (scalp && priceViewport) {
    return (
      <TapeBubbleLane
        trades={trades}
        priceViewport={priceViewport}
        currentPrice={currentPrice}
        aggregationWindowMs={mergeMs}
        onLevelHighlight={onLevelHighlight}
        clusters={clusters}
        onClusterPulse={onClusterPulse}
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
    >
      <div className={cn(terminal || presentation ? "orderflow-pane-header" : "border-b border-white/[0.05] px-3 py-2")}>
        <h3 className={cn(!terminal && !presentation && "text-xs font-medium uppercase tracking-[0.12em] text-slate-400")}>
          {terminal || presentation ? "Лента · симуляция" : "Лента сделок"}
        </h3>
        {!terminal && !presentation ? (
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">симуляция · Time &amp; Sales</p>
        ) : null}
      </div>

      {!presentation ? (
      <div className="flex flex-wrap items-center gap-1 border-b border-indigo-500/10 bg-[#030508] px-2 py-1">
        <span className="text-[9px] uppercase tracking-wider text-slate-600">Складывать тики</span>
        {TAPE_MERGE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[9px] transition",
              mergeMs === opt.value
                ? "border-violet-500/35 bg-violet-950/40 text-violet-100"
                : "border-white/[0.07] text-slate-500 hover:text-slate-300",
            )}
            onClick={() => setMergeMs(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      ) : null}

      {showBubbles ? (
        <div
          className={cn(
            "relative flex-1 border-b border-white/[0.04] bg-[#010306]",
            presentation ? "min-h-[160px]" : "min-h-[120px]",
          )}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-4 bg-gradient-to-b from-rose-950/20 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-4 bg-gradient-to-t from-emerald-950/20 to-transparent" />

          <div className="relative h-full min-h-[100px] w-full">
            {bubbles.length === 0 ? (
              <p className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-slate-600">
                Принты появятся после сделок
              </p>
            ) : (
              bubbles.map((bubble) => {
                const layout = layoutBubble(bubble, priceRange);
                const ageMs = nowMs - bubble.timestamp;
                const opacity = bubbleOpacity(ageMs);
                if (opacity <= 0.02) return null;
                const diameter = bubbleDiameter(bubble.size, maxBubbleSize);
                return (
                  <TapeBubbleView
                    key={`${bubble.id}-${bubble.timestamp}`}
                    bubble={bubble}
                    layout={layout}
                    diameter={diameter}
                    opacity={opacity}
                  />
                );
              })
            )}
          </div>

          {showTeachingHints ? (
            <p className="border-t border-white/[0.04] px-2 py-0.5 font-mono text-[8px] text-slate-600">
              ● зелёный — покупка · ● красный — продажа
            </p>
          ) : null}
        </div>
      ) : null}

      <details
        open={listOpen}
        onToggle={(e) => setListOpen((e.target as HTMLDetailsElement).open)}
        className={cn(
          "flex min-h-0 flex-col",
          showBubbles ? (terminal ? "max-h-[32%] shrink-0" : "max-h-[38%] shrink-0") : "min-h-0 flex-1",
        )}
      >
        <summary className="cursor-pointer border-b border-white/[0.04] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
          Список сделок ({listRows.length})
        </summary>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-1.5 border-b border-white/[0.04] px-1.5 py-1 text-[8px] uppercase tracking-wider text-slate-600">
          <span>Время</span>
          <span className="text-right">Цена</span>
          <span className="text-right">Объём</span>
          <span className="text-right">Стор.</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {listRows.length === 0 ? (
            <p className="px-2 py-4 text-center font-mono text-[10px] text-slate-600">Список пуст</p>
          ) : (
            listRows.map((row) => <TapeListRow key={row.id} row={row} />)
          )}
        </div>
      </details>
    </div>
  );
}
