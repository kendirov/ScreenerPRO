"use client";

import type { Dispatch } from "react";
import type { OrderflowEngineState, OrderflowSimulatorAction } from "@/lib/domain/orderflow-simulator-engine";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

type PresentationToolbarProps = {
  state: OrderflowEngineState;
  dispatch: Dispatch<OrderflowSimulatorAction>;
  onExitPresentation: () => void;
  className?: string;
};

const btnClass =
  "rounded border border-white/[0.1] bg-[#0a0f18] px-3 py-1 font-mono text-[12px] text-slate-100 transition hover:border-cyan-500/35 hover:bg-cyan-950/30 disabled:opacity-40";

export function PresentationToolbar({
  state,
  dispatch,
  onExitPresentation,
  className,
}: PresentationToolbarProps) {
  const hasLesson = Boolean(state.scenarioPlayback.activeScenarioId);

  return (
    <header
      className={cn(
        "orderflow-top-bar flex flex-wrap items-center gap-2 border-b border-cyan-500/20 bg-[#020308] px-2 py-1",
        className,
      )}
    >
      <div className="flex min-w-[140px] items-baseline gap-2 font-mono tabular-nums">
        <span className="text-[13px] font-semibold text-slate-200">{state.symbol}</span>
        <span className="text-2xl font-semibold text-cyan-100">{formatPrice(state.currentPrice)}</span>
      </div>

      <span className="rounded border border-violet-500/30 bg-violet-950/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-violet-300/90">
        Симуляция
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
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
          Шаг →
        </button>
        <button type="button" className={btnClass} onClick={() => dispatch({ type: "RESET_SCENARIO" })}>
          Сброс
        </button>
      </div>

      <button
        type="button"
        className="ml-auto rounded border border-white/[0.08] px-2 py-1 font-mono text-[10px] text-slate-500 hover:text-slate-200"
        onClick={onExitPresentation}
      >
        Выйти из презентации
      </button>
    </header>
  );
}

