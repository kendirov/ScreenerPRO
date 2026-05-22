"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Учебная сделка в ленте (справа → налево) */
export type TapeFlowTrade = {
  id: string;
  side: "buy" | "sell";
  size: number;
  hitZone: "best-ask" | "best-bid" | "ask-area" | "bid-area";
  createdAt: number;
};

export type TapeFlowSize = "small" | "medium" | "large" | "huge";

const SIZE_PX: Record<TapeFlowSize, number> = {
  small: 18,
  medium: 28,
  large: 44,
  huge: 64,
};

const BASE_FLOW_MS = 6_500;

export function formatTapeVolumeLabel(size: number): string {
  if (size >= 1000) return "1K";
  return String(size);
}

export function tapeBubbleSize(size: number): { tier: TapeFlowSize; px: number } {
  if (size >= 1000) return { tier: "huge", px: SIZE_PX.huge };
  if (size >= 100) return { tier: "large", px: SIZE_PX.large };
  if (size >= 50) return { tier: "medium", px: SIZE_PX.medium };
  return { tier: "small", px: SIZE_PX.small };
}

function verticalPercent(trade: TapeFlowTrade): number {
  const seed = trade.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const jitter = ((seed % 7) - 3) * 1.2;

  switch (trade.hitZone) {
    case "best-ask":
      return 16 + jitter;
    case "ask-area":
      return 26 + jitter;
    case "best-bid":
      return 84 + jitter;
    case "bid-area":
      return 74 + jitter;
    default:
      return 50;
  }
}

function flowDurationMs(speed: number): number {
  const clamped = Math.max(0.5, Math.min(2, speed));
  return BASE_FLOW_MS / clamped;
}

type SimpleTapeFlowProps = {
  trades: TapeFlowTrade[];
  isPlaying?: boolean;
  speed?: number;
  selectedScenario?: string | null;
  height?: number;
  className?: string;
  presentation?: boolean;
  onTradeExpired?: (id: string) => void;
};

export function SimpleTapeFlow({
  trades,
  isPlaying = false,
  speed = 1,
  selectedScenario = null,
  height = 748,
  className,
  presentation = false,
  onTradeExpired,
}: SimpleTapeFlowProps) {
  const [now, setNow] = React.useState(() => Date.now());
  const expiredRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const duration = flowDurationMs(speed);

  React.useEffect(() => {
    if (!onTradeExpired) return;
    for (const trade of trades) {
      if (expiredRef.current.has(trade.id)) continue;
      if (now - trade.createdAt >= duration) {
        expiredRef.current.add(trade.id);
        onTradeExpired(trade.id);
      }
    }
  }, [trades, now, duration, onTradeExpired]);

  React.useEffect(() => {
    expiredRef.current.clear();
  }, [trades.length === 0]);

  const visibleTrades = trades.filter((t) => now - t.createdAt < duration);

  return (
    <div
      className={cn(
        "simple-tape-flow flex min-w-[148px] shrink-0 flex-col",
        presentation && "simple-tape-flow--presentation",
        className,
      )}
    >
      <p
        className={cn(
          "mb-1 text-center font-mono uppercase tracking-wide text-slate-600",
          presentation ? "text-[11px] text-slate-400" : "text-[8px]",
        )}
      >
        Лента сделок
      </p>
      <div
        className="simple-tape-flow-lane relative overflow-hidden rounded border border-white/[0.05] bg-[#010306]"
        style={{ height }}
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-0 w-8 bg-gradient-to-l from-emerald-950/25 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-0 w-6 bg-gradient-to-r from-[#010306] to-transparent"
          aria-hidden
        />
        {isPlaying && selectedScenario ? (
          <p className="absolute left-1 top-1 z-[1] font-mono text-[7px] text-violet-400/70">
            сценарий · симуляция
          </p>
        ) : null}
        {visibleTrades.map((trade) => {
          const age = now - trade.createdAt;
          const progress = Math.min(1, age / duration);
          const leftPct = 96 - progress * 96;
          const fadeStart = 0.82;
          const opacity =
            progress > fadeStart ? Math.max(0, 1 - (progress - fadeStart) / (1 - fadeStart)) : 1;
          const { px } = tapeBubbleSize(trade.size);
          const isBuy = trade.side === "buy";
          const topPct = verticalPercent(trade);
          const label = formatTapeVolumeLabel(trade.size);
          const fontSize = px <= 18 ? 8 : px <= 28 ? 9 : px <= 44 ? 10 : 11;

          return (
            <div
              key={trade.id}
              className={cn(
                "simple-tape-bubble absolute z-[2] flex items-center justify-center rounded-full border font-mono font-semibold tabular-nums shadow-md",
                isBuy
                  ? "border-emerald-300/40 bg-emerald-500 text-emerald-950"
                  : "border-rose-300/40 bg-rose-500 text-rose-50",
              )}
              style={{
                width: px,
                height: px,
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: "translate(-50%, -50%)",
                opacity,
                fontSize,
                transition: "opacity 120ms linear",
              }}
              title={isBuy ? "Рыночная покупка" : "Рыночная продажа"}
            >
              {label}
            </div>
          );
        })}
      </div>
      {presentation ? null : <TapeFlowLegend />}
    </div>
  );
}

function TapeFlowLegend() {
  const items = [
    { color: "bg-emerald-500", label: "зелёный = рыночная покупка" },
    { color: "bg-rose-500", label: "красный = рыночная продажа" },
    { color: "border border-white/20 bg-slate-700", label: "размер = объём сделки" },
  ];

  return (
    <div className="mt-1.5 space-y-0.5 px-0.5 font-mono text-[8px] leading-snug text-slate-500">
      {items.map((item) => (
        <p key={item.label} className="flex items-center gap-1.5">
          <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", item.color)} />
          <span>{item.label}</span>
        </p>
      ))}
      <p className="pt-0.5 text-slate-600">направление времени: справа → налево</p>
    </div>
  );
}

export function nextTapeTradeId(): string {
  return `tape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
