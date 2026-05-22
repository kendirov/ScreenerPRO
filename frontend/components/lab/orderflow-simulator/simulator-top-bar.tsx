"use client";

import type { Dispatch } from "react";
import {
  ORDERFLOW_SCENARIOS,
} from "@/lib/domain/orderflow-simulator-scenarios";
import type { OrderflowEngineState, OrderflowSimulatorAction } from "@/lib/domain/orderflow-simulator-engine";
import { UI_MODE_LABELS, type SimulatorUiMode } from "@/lib/domain/orderflow-teaching";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

type SimulatorTopBarProps = {
  state: OrderflowEngineState;
  dispatch: Dispatch<OrderflowSimulatorAction>;
  uiMode: SimulatorUiMode;
  onUiModeChange: (mode: SimulatorUiMode) => void;
  hasLesson: boolean;
  className?: string;
};

const btnClass =
  "rounded border border-white/[0.08] bg-[#0a0f18] px-2 py-1 font-mono text-[11px] text-slate-200 transition hover:border-violet-500/30 hover:bg-violet-950/25 disabled:opacity-40";

export function SimulatorTopBar({
  state,
  dispatch,
  uiMode,
  onUiModeChange,
  hasLesson,
  className,
}: SimulatorTopBarProps) {
  const sessionOpen = state.candles[0]?.open ?? state.currentPrice;
  const change = state.currentPrice - sessionOpen;
  const changePct = sessionOpen > 0 ? (change / sessionOpen) * 100 : 0;
  const isUp = change >= 0;

  const activeScenario = ORDERFLOW_SCENARIOS.find(
    (s) => s.id === (state.scenarioPlayback.activeScenarioId ?? state.scenario),
  );

  return (
    <header
      className={cn(
        "orderflow-top-bar flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-violet-500/20 bg-[#020308] px-2 py-1",
        className,
      )}
    >
      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-[13px] font-semibold tracking-tight text-slate-100">{state.symbol}</span>
        <span className="text-[11px] text-slate-500">·</span>
        <span className="text-[11px] text-slate-400">{state.candleTimeframe}м</span>
        <span className="text-[11px] text-slate-500">·</span>
        <span className="rounded border border-violet-500/25 bg-violet-950/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-violet-300/90">
          Симуляция
        </span>
      </div>

      <div className="h-4 w-px bg-white/[0.08]" />

      <div className="flex items-baseline gap-2 font-mono tabular-nums">
        <span className="text-lg font-semibold text-cyan-100">{formatPrice(state.currentPrice)}</span>
        <span className={cn("text-[11px]", isUp ? "text-emerald-400" : "text-rose-400")}>
          {isUp ? "+" : ""}
          {change.toFixed(2)} ({isUp ? "+" : ""}
          {changePct.toFixed(2)}%)
        </span>
      </div>

      <div className="h-4 w-px bg-white/[0.08]" />

      <p className="max-w-[200px] truncate font-mono text-[10px] text-slate-500" title={activeScenario?.title}>
        {activeScenario ? `Сценарий: ${activeScenario.title}` : "Ручной режим"}
      </p>

      <div className="ml-auto flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={btnClass}
          onClick={() => dispatch(state.isPlaying ? { type: "PAUSE" } : { type: "PLAY" })}
        >
          {state.isPlaying ? "Пауза" : "Пуск"}
        </button>
        <button
          type="button"
          className={btnClass}
          onClick={() => dispatch({ type: hasLesson ? "SCENARIO_STEP" : "STEP" })}
        >
          Шаг
        </button>
        <button type="button" className={btnClass} onClick={() => dispatch({ type: "RESET_SCENARIO" })}>
          Сброс
        </button>

        <span className="mx-1 h-4 w-px bg-white/[0.08]" />

        {(["lesson", "presentation"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={cn(
              btnClass,
              uiMode === mode && "border-cyan-500/35 bg-cyan-950/35 text-cyan-100",
            )}
            onClick={() => onUiModeChange(uiMode === mode ? "workspace" : mode)}
          >
            {UI_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
    </header>
  );
}
