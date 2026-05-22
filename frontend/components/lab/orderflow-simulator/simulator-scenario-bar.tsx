"use client";

import type { Dispatch } from "react";
import {
  LESSON_SCENARIO_IDS,
  ORDERFLOW_SCENARIOS,
} from "@/lib/domain/orderflow-simulator-scenarios";
import type { OrderflowEngineState, OrderflowSimulatorAction } from "@/lib/domain/orderflow-simulator-engine";
import { cn } from "@/lib/utils/cn";

type SimulatorScenarioBarProps = {
  state: OrderflowEngineState;
  dispatch: Dispatch<OrderflowSimulatorAction>;
  className?: string;
};

const btnClass =
  "shrink-0 rounded border border-white/[0.07] bg-[#0a0f18] px-1.5 py-0.5 font-mono text-[9px] text-slate-300 transition hover:border-violet-500/25 disabled:opacity-40";

export function SimulatorScenarioBar({ state, dispatch, className }: SimulatorScenarioBarProps) {
  const activeId = state.scenarioPlayback.activeScenarioId ?? state.scenario;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 border-b border-white/[0.04] bg-[#030508]/90 px-2 py-0.5",
        className,
      )}
    >
      <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-slate-600">Сценарии</span>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
        {LESSON_SCENARIO_IDS.map((id) => {
          const scenario = ORDERFLOW_SCENARIOS.find((s) => s.id === id)!;
          const isActive = activeId === id;
          return (
            <button
              key={id}
              type="button"
              title={scenario.description}
              className={cn(
                btnClass,
                isActive && "border-violet-500/40 bg-violet-950/45 text-violet-100",
              )}
              onClick={() => dispatch({ type: "SELECT_SCENARIO", scenarioId: id })}
            >
              {scenario.title}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={cn(btnClass, "border-emerald-500/25 text-emerald-200/90")}
        disabled={state.scenarioPlayback.isScenarioComplete}
        onClick={() => dispatch({ type: "START_SCENARIO" })}
      >
        ▶
      </button>
      <button
        type="button"
        className={btnClass}
        disabled={state.scenarioPlayback.isScenarioComplete}
        onClick={() => dispatch({ type: "SCENARIO_STEP" })}
      >
        Шаг
      </button>
    </div>
  );
}
