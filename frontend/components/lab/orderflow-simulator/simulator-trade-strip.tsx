"use client";

import * as React from "react";
import type { Dispatch } from "react";
import { roundPrice } from "@/lib/domain/orderflow-simulator";
import type {
  CandleTimeframeMinutes,
  OrderflowEngineState,
  OrderflowSimulatorAction,
  TickMergeMs,
} from "@/lib/domain/orderflow-simulator-engine";
import { cn } from "@/lib/utils/cn";

type SimulatorTradeStripProps = {
  state: OrderflowEngineState;
  dispatch: Dispatch<OrderflowSimulatorAction>;
  tradeSize: number;
  onTradeSizeChange: (n: number) => void;
  limitSize: number;
  onLimitSizeChange: (n: number) => void;
  className?: string;
};

const SPEED_OPTIONS = [0.5, 1, 2, 5] as const;
const TICK_MERGE_OPTIONS: TickMergeMs[] = [50, 100, 250];
const TIMEFRAME_OPTIONS: CandleTimeframeMinutes[] = [1, 5];

const btnClass =
  "rounded border border-white/[0.07] bg-[#0a0f18] px-1.5 py-0.5 font-mono text-[10px] text-slate-300 hover:border-white/15";

const btnBuy =
  "rounded border border-emerald-500/25 bg-emerald-950/35 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200";
const btnSell =
  "rounded border border-rose-500/25 bg-rose-950/35 px-1.5 py-0.5 font-mono text-[10px] text-rose-200";

export function SimulatorTradeStrip({
  state,
  dispatch,
  tradeSize,
  onTradeSizeChange,
  limitSize,
  onLimitSizeChange,
  className,
}: SimulatorTradeStripProps) {
  const [limitPrice, setLimitPrice] = React.useState(state.currentPrice);

  React.useEffect(() => {
    setLimitPrice(state.currentPrice);
  }, [state.currentPrice]);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.04] bg-[#030508]/80 px-2 py-1 font-mono text-[10px]",
        className,
      )}
    >
      <label className="flex items-center gap-1 text-slate-600">
        Лот
        <input
          type="number"
          min={10}
          step={10}
          value={tradeSize}
          onChange={(e) => onTradeSizeChange(Number(e.target.value) || 0)}
          className="w-14 rounded border border-white/[0.08] bg-[#0a0f18] px-1 py-0.5 text-slate-200"
        />
      </label>
      <button type="button" className={btnBuy} onClick={() => dispatch({ type: "MARKET_BUY", size: tradeSize })}>
        Покупка
      </button>
      <button type="button" className={btnSell} onClick={() => dispatch({ type: "MARKET_SELL", size: tradeSize })}>
        Продажа
      </button>

      <span className="h-3 w-px bg-white/[0.06]" />

      <label className="flex items-center gap-1 text-slate-600">
        Цена
        <input
          type="number"
          step={0.01}
          value={limitPrice}
          onChange={(e) => setLimitPrice(Number(e.target.value) || 0)}
          className="w-16 rounded border border-white/[0.08] bg-[#0a0f18] px-1 py-0.5 text-slate-200"
        />
      </label>
      <label className="flex items-center gap-1 text-slate-600">
        Объём
        <input
          type="number"
          min={10}
          step={10}
          value={limitSize}
          onChange={(e) => onLimitSizeChange(Number(e.target.value) || 0)}
          className="w-14 rounded border border-white/[0.08] bg-[#0a0f18] px-1 py-0.5 text-slate-200"
        />
      </label>
      <button
        type="button"
        className={btnClass}
        onClick={() => dispatch({ type: "ADD_LIMIT_BID", price: roundPrice(limitPrice), size: limitSize })}
      >
        +Bid
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={() => dispatch({ type: "ADD_LIMIT_ASK", price: roundPrice(limitPrice), size: limitSize })}
      >
        +Ask
      </button>

      <span className="ml-auto flex flex-wrap items-center gap-1">
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            type="button"
            className={cn(btnClass, state.speed === speed && "border-violet-500/30 text-violet-200")}
            onClick={() => dispatch({ type: "SET_SPEED", speed })}
          >
            ×{speed}
          </button>
        ))}
        {TIMEFRAME_OPTIONS.map((tf) => (
          <button
            key={tf}
            type="button"
            className={cn(btnClass, state.candleTimeframe === tf && "border-sky-500/30 text-sky-200")}
            onClick={() => dispatch({ type: "SET_CANDLE_TIMEFRAME", timeframe: tf })}
          >
            {tf}м
          </button>
        ))}
        {TICK_MERGE_OPTIONS.map((ms) => (
          <button
            key={ms}
            type="button"
            className={cn(btnClass, state.tickMergeMs === ms && "border-amber-500/30 text-amber-200")}
            onClick={() => dispatch({ type: "SET_TICK_MERGE", mergeMs: ms })}
          >
            {ms}мс
          </button>
        ))}
      </span>
    </div>
  );
}
