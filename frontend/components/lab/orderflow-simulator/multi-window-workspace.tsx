"use client";

import * as React from "react";
import { MiniTerminalTile } from "@/components/lab/orderflow-simulator/mini-terminal-tile";
import {
  DEMO_INSTRUMENT_PRESETS,
  getPresetBySymbol,
} from "@/lib/domain/orderflow-instrument-presets";
import {
  MARKET_PRESSURE_TITLE,
  type MultiMarketAction,
  type MultiMarketState,
} from "@/lib/domain/orderflow-multi-market";
import { cn } from "@/lib/utils/cn";

type MultiWindowWorkspaceProps = {
  state: MultiMarketState;
  dispatch: React.Dispatch<MultiMarketAction>;
  selectedSymbol: string | null;
  onOpenInstrument: (symbol: string) => void;
  className?: string;
};

function SimulationBanner({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "orderflow-sim-banner px-2 py-1 text-center font-mono text-[10px] text-amber-200/85",
        className,
      )}
    >
      Симуляция. Не реальные котировки MOEX. Все инструменты — demo.
    </p>
  );
}

export function MultiWindowWorkspace({
  state,
  dispatch,
  selectedSymbol,
  onOpenInstrument,
  className,
}: MultiWindowWorkspaceProps) {
  const { pressure } = state;
  const sceneActive = pressure.playing || pressure.tick >= 0;
  const sceneDone = pressure.tick >= pressure.maxTick;

  return (
    <section className={cn("orderflow-multi-desk flex flex-col gap-2", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-indigo-500/25 bg-[#030508] px-2 py-1.5">
        <div>
          <p className="font-mono text-[11px] font-medium text-slate-200">Рабочий стол · мультиокно</p>
          <p className="font-mono text-[9px] text-slate-500">
            {DEMO_INSTRUMENT_PRESETS.length} demo-инструментов · клик по плитке → режим «Привод»
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => dispatch({ type: "START_PRESSURE_SCENE" })}
            className="rounded border border-violet-500/35 bg-violet-950/40 px-2 py-1 font-mono text-[10px] text-violet-200 hover:bg-violet-900/50"
          >
            Сцена «{MARKET_PRESSURE_TITLE}»
          </button>
          <button
            type="button"
            disabled={!sceneActive || sceneDone}
            onClick={() => dispatch({ type: "PRESSURE_STEP" })}
            className="rounded border border-indigo-500/30 bg-indigo-950/30 px-2 py-1 font-mono text-[10px] text-indigo-200 hover:bg-indigo-900/40 disabled:opacity-40"
          >
            Шаг сцены
          </button>
          {pressure.playing ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "STOP_PRESSURE" })}
              className="rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-400 hover:text-slate-200"
            >
              Стоп
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => dispatch({ type: "RESET_ALL" })}
            className="rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-500 hover:text-slate-300"
          >
            Сброс всех
          </button>
        </div>
      </header>

      <SimulationBanner className="rounded-md" />

      {pressure.lastNote ? (
        <p className="rounded border border-sky-500/15 bg-sky-950/20 px-2 py-1 font-mono text-[10px] text-sky-100/90">
          {pressure.lastNote}
          {sceneActive && !sceneDone ? (
            <span className="ml-2 text-slate-500">
              шаг {Math.max(0, pressure.tick + 1)} / {pressure.maxTick + 1}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="orderflow-multi-grid grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {state.order.map((symbol) => {
          const preset = getPresetBySymbol(symbol);
          const engine = state.instruments[symbol];
          if (!preset || !engine) return null;
          return (
            <MiniTerminalTile
              key={symbol}
              preset={preset}
              state={engine}
              selected={selectedSymbol === symbol}
              onOpen={() => onOpenInstrument(symbol)}
            />
          );
        })}
      </div>

      <SimulationBanner className="rounded-md" />
    </section>
  );
}

