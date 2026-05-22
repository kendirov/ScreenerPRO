"use client";

import * as React from "react";
import type { Dispatch } from "react";
import {
  LESSON_SCENARIO_IDS,
  ORDERFLOW_SCENARIOS,
} from "@/lib/domain/orderflow-simulator-scenarios";
import {
  type OrderflowEngineState,
  type OrderflowSimulatorAction,
  type TickMergeMs,
  type CandleTimeframeMinutes,
} from "@/lib/domain/orderflow-simulator-engine";
import { roundPrice } from "@/lib/domain/orderflow-simulator";
import { UI_MODE_LABELS, type SimulatorUiMode } from "@/lib/domain/orderflow-teaching";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

type SimulatorControlPanelProps = {
  state: OrderflowEngineState;
  dispatch: Dispatch<OrderflowSimulatorAction>;
  uiMode: SimulatorUiMode;
  onUiModeChange: (mode: SimulatorUiMode) => void;
  tradeSize: number;
  onTradeSizeChange: (size: number) => void;
  limitSize: number;
  onLimitSizeChange: (size: number) => void;
  className?: string;
};

const SPEED_OPTIONS = [0.5, 1, 2, 5] as const;
const TICK_MERGE_OPTIONS: TickMergeMs[] = [50, 100, 250];
const TIMEFRAME_OPTIONS: CandleTimeframeMinutes[] = [1, 5];

const btnClass =
  "rounded-md border border-white/[0.08] bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-200 transition hover:border-white/15 hover:bg-slate-800/90 disabled:cursor-not-allowed disabled:opacity-45";

const btnAccentClass =
  "rounded-md border border-emerald-500/25 bg-emerald-950/40 px-2.5 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-950/60 disabled:cursor-not-allowed disabled:opacity-45";

const btnDangerClass =
  "rounded-md border border-rose-500/25 bg-rose-950/40 px-2.5 py-1.5 text-xs text-rose-200 transition hover:bg-rose-950/60 disabled:cursor-not-allowed disabled:opacity-45";

const btnScenarioClass =
  "rounded-lg border border-white/[0.07] bg-slate-900/70 px-2.5 py-2 text-left transition hover:border-violet-500/25 hover:bg-violet-950/20";

export function SimulatorControlPanel({
  state,
  dispatch,
  uiMode,
  onUiModeChange,
  tradeSize,
  onTradeSizeChange,
  limitSize,
  onLimitSizeChange,
  className,
}: SimulatorControlPanelProps) {
  const [limitPrice, setLimitPrice] = React.useState(state.currentPrice);

  const activeScenario = ORDERFLOW_SCENARIOS.find(
    (s) => s.id === (state.scenarioPlayback.activeScenarioId ?? state.scenario),
  );
  const hasLesson = Boolean(state.scenarioPlayback.activeScenarioId);

  React.useEffect(() => {
    setLimitPrice(state.currentPrice);
  }, [state.currentPrice]);

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-white/[0.06] bg-slate-950/60 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.04] pb-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Режим</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(Object.keys(UI_MODE_LABELS) as SimulatorUiMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  btnClass,
                  uiMode === mode && "border-cyan-500/35 bg-cyan-950/35 text-cyan-100",
                )}
                onClick={() => onUiModeChange(mode)}
              >
                {UI_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
        <p className="font-mono text-[10px] text-slate-600">Горячие клавиши: Space, →, R, B, S</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Сценарий урока</p>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {LESSON_SCENARIO_IDS.map((id) => {
            const scenario = ORDERFLOW_SCENARIOS.find((s) => s.id === id)!;
            const isActive = (state.scenarioPlayback.activeScenarioId ?? state.scenario) === id;
            return (
              <button
                key={id}
                type="button"
                className={cn(
                  btnScenarioClass,
                  isActive && "border-violet-500/35 bg-violet-950/35 ring-1 ring-violet-500/20",
                )}
                onClick={() => dispatch({ type: "SELECT_SCENARIO", scenarioId: id })}
              >
                <span className="block text-xs font-medium text-slate-100">{scenario.title}</span>
                <span className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">{scenario.description}</span>
              </button>
            );
          })}
        </div>

        {activeScenario ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btnAccentClass}
              disabled={state.scenarioPlayback.isScenarioComplete}
              onClick={() => dispatch({ type: "START_SCENARIO" })}
            >
              ▶ Запустить сценарий
            </button>
            <button
              type="button"
              className={btnClass}
              disabled={state.scenarioPlayback.isScenarioComplete}
              onClick={() => dispatch({ type: "SCENARIO_STEP" })}
            >
              Пошагово
            </button>
            <button type="button" className={btnClass} onClick={() => dispatch({ type: "RESET_SCENARIO" })}>
              Сброс урока
            </button>
            {state.scenarioPlayback.isScenarioPlaying ? (
              <span className="font-mono text-[10px] text-violet-300/80">
                такт {state.scenarioPlayback.scenarioTick}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.04] pt-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Инструмент</p>
          <p className="font-mono text-sm font-semibold text-slate-100">
            {state.symbol} · {formatPrice(state.currentPrice)}
          </p>
        </div>

        <div className="h-8 w-px bg-white/[0.06]" />

        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Урок</p>
          <p className="text-sm text-slate-300">
            {hasLesson ? activeScenario?.title ?? "Сценарий" : "Ручное управление"}
          </p>
        </div>

        <div className="h-8 w-px bg-white/[0.06]" />

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={btnClass}
            onClick={() => dispatch(state.isPlaying ? { type: "PAUSE" } : { type: "PLAY" })}
          >
            {state.isPlaying ? "⏸ Пауза" : "▶ Пуск"}
          </button>
          <button
            type="button"
            className={btnClass}
            onClick={() => dispatch({ type: hasLesson ? "SCENARIO_STEP" : "STEP" })}
          >
            {hasLesson ? "Пошагово" : "Шаг"}
          </button>
          <button type="button" className={btnClass} onClick={() => dispatch({ type: "RESET_SCENARIO" })}>
            Сброс
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-white/[0.04] pt-2">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Размер сделки</span>
          <input
            type="number"
            min={10}
            step={10}
            value={tradeSize}
            onChange={(e) => onTradeSizeChange(Number(e.target.value) || 0)}
            className="block w-24 rounded-md border border-white/[0.08] bg-slate-900/80 px-2 py-1 font-mono text-xs text-slate-200"
          />
        </label>

        <button
          type="button"
          className={btnAccentClass}
          onClick={() => dispatch({ type: "MARKET_BUY", size: tradeSize })}
        >
          Рыночная покупка
        </button>
        <button
          type="button"
          className={btnDangerClass}
          onClick={() => dispatch({ type: "MARKET_SELL", size: tradeSize })}
        >
          Рыночная продажа
        </button>

        <div className="h-8 w-px bg-white/[0.06]" />

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Цена заявки</span>
          <input
            type="number"
            step={0.01}
            value={limitPrice}
            onChange={(e) => setLimitPrice(Number(e.target.value) || 0)}
            className="block w-24 rounded-md border border-white/[0.08] bg-slate-900/80 px-2 py-1 font-mono text-xs text-slate-200"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Размер заявки</span>
          <input
            type="number"
            min={10}
            step={10}
            value={limitSize}
            onChange={(e) => onLimitSizeChange(Number(e.target.value) || 0)}
            className="block w-24 rounded-md border border-white/[0.08] bg-slate-900/80 px-2 py-1 font-mono text-xs text-slate-200"
          />
        </label>

        <button
          type="button"
          className={btnClass}
          onClick={() => dispatch({ type: "ADD_LIMIT_BID", price: roundPrice(limitPrice), size: limitSize })}
        >
          Добавить bid-плотность
        </button>
        <button
          type="button"
          className={btnClass}
          onClick={() => dispatch({ type: "ADD_LIMIT_ASK", price: roundPrice(limitPrice), size: limitSize })}
        >
          Добавить ask-плотность
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.04] pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Скорость</span>
          {SPEED_OPTIONS.map((speed) => (
            <button
              key={speed}
              type="button"
              className={cn(
                btnClass,
                state.speed === speed && "border-violet-500/30 bg-violet-950/40 text-violet-200",
              )}
              onClick={() => dispatch({ type: "SET_SPEED", speed })}
            >
              ×{speed}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-white/[0.06]" />

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Таймфрейм</span>
          {TIMEFRAME_OPTIONS.map((tf) => (
            <button
              key={tf}
              type="button"
              className={cn(
                btnClass,
                state.candleTimeframe === tf && "border-sky-500/30 bg-sky-950/40 text-sky-200",
              )}
              onClick={() => dispatch({ type: "SET_CANDLE_TIMEFRAME", timeframe: tf })}
            >
              {tf}м
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-white/[0.06]" />

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Складывать тики</span>
          {TICK_MERGE_OPTIONS.map((mergeMs) => (
            <button
              key={mergeMs}
              type="button"
              className={cn(
                btnClass,
                state.tickMergeMs === mergeMs && "border-amber-500/30 bg-amber-950/30 text-amber-200",
              )}
              onClick={() => dispatch({ type: "SET_TICK_MERGE", mergeMs })}
            >
              {mergeMs}мс
            </button>
          ))}
        </div>
      </div>

      {state.lastExplanation ? (
        <div className="rounded-md border border-sky-500/15 bg-sky-950/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-sky-400/80">Что происходит</p>
          <p className="mt-0.5 text-sm text-sky-100/90">{state.lastExplanation}</p>
        </div>
      ) : null}
    </div>
  );
}
