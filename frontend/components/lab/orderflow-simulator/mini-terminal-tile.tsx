"use client";

import type { OrderflowEngineState } from "@/lib/domain/orderflow-simulator-engine";
import type { SimInstrumentPreset } from "@/lib/domain/orderflow-instrument-presets";
import { selectVisibleLevels } from "@/lib/domain/order-book-ladder-model";
import { formatCompact, formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

type MiniTerminalTileProps = {
  preset: SimInstrumentPreset;
  state: OrderflowEngineState;
  selected?: boolean;
  onOpen: () => void;
  className?: string;
};

function formatTilePrice(value: number, tickSize: number): string {
  if (value >= 1000) return formatCompact(value);
  if (tickSize < 0.01) return value.toFixed(4);
  return formatPrice(value);
}

function MiniSparkline({ candles }: { candles: OrderflowEngineState["candles"] }) {
  const visible = candles.slice(-14);
  if (visible.length < 2) {
    return <div className="h-12 rounded bg-slate-950/60" />;
  }

  const w = 100;
  const h = 48;
  const lows = visible.map((c) => c.low);
  const highs = visible.map((c) => c.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;

  const points = visible
    .map((c, i) => {
      const x = (i / (visible.length - 1)) * w;
      const y = h - ((c.close - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full rounded bg-[#010306]" preserveAspectRatio="none">
      <polyline fill="none" stroke="rgba(56,189,248,0.55)" strokeWidth="1.2" points={points} />
    </svg>
  );
}

function MiniLadder({ state }: { state: OrderflowEngineState }) {
  const levels = selectVisibleLevels(state.levels, state.currentPrice, 20).slice(0, 7);
  const maxBid = Math.max(...levels.map((l) => l.bidSize), 1);
  const maxAsk = Math.max(...levels.map((l) => l.askSize), 1);

  return (
    <div className="font-mono text-[7px] leading-none">
      {levels.map((level) => {
        const isCurrent = Math.abs(level.price - state.currentPrice) < state.tickSize / 2;
        const bidW = level.bidSize > 0 ? (level.bidSize / maxBid) * 100 : 0;
        const askW = level.askSize > 0 ? (level.askSize / maxAsk) * 100 : 0;
        return (
          <div
            key={level.price}
            className={cn("grid grid-cols-[1fr_auto_1fr] gap-0.5 py-[1px]", isCurrent && "bg-sky-500/15")}
          >
            <div className="relative flex justify-end pr-0.5">
              {level.bidSize > 0 ? (
                <>
                  <div className="absolute inset-y-0 right-0 bg-emerald-600/25" style={{ width: `${bidW}%` }} />
                  <span className="relative text-emerald-400/90">{level.bidSize > 999 ? "k" : level.bidSize}</span>
                </>
              ) : (
                <span className="text-slate-800">·</span>
              )}
            </div>
            <span className={cn("text-center tabular-nums text-slate-400", isCurrent && "text-sky-300")}>
              {formatTilePrice(level.price, state.tickSize)}
            </span>
            <div className="relative flex justify-start pl-0.5">
              {level.askSize > 0 ? (
                <>
                  <div className="absolute inset-y-0 left-0 bg-rose-600/25" style={{ width: `${askW}%` }} />
                  <span className="relative text-rose-400/90">{level.askSize > 999 ? "k" : level.askSize}</span>
                </>
              ) : (
                <span className="text-slate-800">·</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniTapeBubbles({ state }: { state: OrderflowEngineState }) {
  const trades = state.trades.slice(0, 6);
  if (trades.length === 0) {
    return <div className="flex h-10 items-center justify-center font-mono text-[7px] text-slate-700">нет принтов</div>;
  }

  return (
    <div className="relative h-10 rounded bg-[#010306]">
      {trades.map((t, i) => {
        const isBuy = t.aggressorSide === "buy";
        const size = Math.min(14, 8 + t.size / (state.lotSize * 8));
        return (
          <span
            key={t.id}
            className={cn(
              "absolute flex items-center justify-center rounded-full font-mono text-[6px] font-semibold",
              isBuy ? "bg-emerald-500/80 text-emerald-950" : "bg-rose-500/80 text-rose-950",
            )}
            style={{
              width: size,
              height: size,
              top: `${12 + (i % 3) * 10}%`,
              left: isBuy ? `${58 + (i % 2) * 8}%` : `${18 + (i % 2) * 8}%`,
            }}
            title={`${isBuy ? "покупка" : "продажа"} ${t.size}`}
          />
        );
      })}
    </div>
  );
}

export function MiniTerminalTile({ preset, state, selected, onOpen, className }: MiniTerminalTileProps) {
  const sessionOpen = state.candles[0]?.open ?? state.currentPrice;
  const change = state.currentPrice - sessionOpen;
  const changePct = sessionOpen > 0 ? (change / sessionOpen) * 100 : 0;
  const isUp = change >= 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "orderflow-mini-tile flex min-h-[220px] w-full flex-col overflow-hidden rounded-md border text-left transition",
        selected
          ? "border-violet-400/50 bg-[#060a14] shadow-[0_0_24px_rgba(99,102,241,0.2)]"
          : "border-indigo-500/25 bg-[#030508] hover:border-violet-400/35 hover:bg-[#050810]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1 border-b border-indigo-500/20 px-2 py-1">
        <div>
          <span className="font-mono text-[11px] font-semibold text-slate-100">{preset.symbol}</span>
          <span className="ml-1 font-mono text-[8px] text-slate-500">{preset.title}</span>
        </div>
        <span className="rounded border border-violet-500/30 bg-violet-950/40 px-1 py-0.5 font-mono text-[7px] uppercase text-violet-300/90">
          demo
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-2 px-2 py-1 font-mono">
        <span className="text-sm font-semibold tabular-nums text-cyan-100">
          {formatTilePrice(state.currentPrice, preset.tickSize)}
        </span>
        <span className={cn("text-[9px] tabular-nums", isUp ? "text-emerald-400" : "text-rose-400")}>
          {isUp ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_72px_56px] gap-1 px-1 pb-1">
        <div className="flex min-w-0 flex-col gap-1">
          <MiniSparkline candles={state.candles} />
          <span className="font-mono text-[7px] text-slate-600">график · симуляция</span>
        </div>
        <div className="min-w-0 overflow-hidden rounded border border-white/[0.04] bg-[#020408] p-0.5">
          <p className="mb-0.5 text-center font-mono text-[6px] uppercase text-slate-600">DOM</p>
          <MiniLadder state={state} />
        </div>
        <div className="min-w-0">
          <p className="mb-0.5 text-center font-mono text-[6px] uppercase text-slate-600">лента</p>
          <MiniTapeBubbles state={state} />
        </div>
      </div>

      <p className="border-t border-white/[0.04] px-2 py-0.5 text-center font-mono text-[7px] text-slate-600">
        клик — открыть в режиме «Привод»
      </p>
    </button>
  );
}

