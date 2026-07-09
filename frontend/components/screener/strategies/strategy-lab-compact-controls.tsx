"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { STRATEGY_LAB_FIELD_LABELS } from "@/lib/strategies/strategy-lab-labels";
import type { StrategyCandlePeriodId } from "@/lib/screener/strategies/strategy-candle-range";
import type { StrategyTimeframeMinutes } from "@/lib/screener/strategies/strategy-candles";
import {
  BUFFERS_LAYER_OPTIONS,
  EXTREMUMS_LAYER_OPTIONS,
  LEVELS_LAYER_OPTIONS,
  REACTIONS_LAYER_OPTIONS,
  SESSIONS_LAYER_OPTIONS,
  STRATEGY_LAB_PERIOD_OPTIONS,
  STRATEGY_LAB_TIMEFRAME_OPTIONS,
  type StrategyLabLayerModes,
} from "@/lib/strategies/strategy-lab-ux";

function CompactSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 font-mono text-[10px] text-lab-muted">
      <span className="text-zinc-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-white/[0.08] bg-black/30 px-1.5 py-0.5 text-[10px] text-lab-text outline-none focus:border-cyan-800/40"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LayerInlineSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1 font-mono text-[10px] text-lab-muted">
      <span className="text-zinc-600">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-white/[0.06] bg-black/20 px-1 py-0.5 text-[10px] text-lab-text outline-none focus:border-cyan-800/35"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StrategyLabCompactControls({
  draftSecid,
  onDraftSecidChange,
  onLoadInstrument,
  timeframe,
  onTimeframeChange,
  period,
  onPeriodChange,
  layerModes,
  onLayerModesChange,
  candlesSummary,
}: {
  draftSecid: string;
  onDraftSecidChange: (value: string) => void;
  onLoadInstrument: () => void;
  timeframe: StrategyTimeframeMinutes;
  onTimeframeChange: (value: StrategyTimeframeMinutes) => void;
  period: StrategyCandlePeriodId;
  onPeriodChange: (value: StrategyCandlePeriodId) => void;
  layerModes: StrategyLabLayerModes;
  onLayerModesChange: (patch: Partial<StrategyLabLayerModes>) => void;
  candlesSummary: string | null;
}) {
  const [layersExpanded, setLayersExpanded] = React.useState(false);

  const layerSummary = `Уровни: ${LEVELS_LAYER_OPTIONS.find((o) => o.id === layerModes.levels)?.label} · Буферы: ${BUFFERS_LAYER_OPTIONS.find((o) => o.id === layerModes.buffers)?.label} · Экстремумы: ${EXTREMUMS_LAYER_OPTIONS.find((o) => o.id === layerModes.extremums)?.label} · Реакции: ${REACTIONS_LAYER_OPTIONS.find((o) => o.id === layerModes.reactions)?.label} · Сессии: ${SESSIONS_LAYER_OPTIONS.find((o) => o.id === layerModes.sessions)?.label}`;

  return (
    <div className="flex w-full flex-col gap-1.5 rounded border border-white/[0.06] bg-black/25 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <label className="flex items-center gap-1.5 font-mono text-[10px] text-lab-muted">
          <span>{STRATEGY_LAB_FIELD_LABELS.ticker}</span>
          <input
            type="text"
            value={draftSecid}
            onChange={(e) => onDraftSecidChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onLoadInstrument()}
            className="w-20 rounded border border-white/[0.08] bg-black/20 px-1.5 py-0.5 font-mono text-[11px] text-lab-text uppercase outline-none focus:border-cyan-800/40"
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          onClick={onLoadInstrument}
          disabled={!draftSecid.trim()}
          className="rounded border border-white/[0.08] px-2 py-0.5 font-mono text-[10px] text-lab-muted transition hover:border-cyan-800/40 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {STRATEGY_LAB_FIELD_LABELS.load}
        </button>
        <CompactSelect
          label="ТФ"
          value={String(timeframe)}
          options={STRATEGY_LAB_TIMEFRAME_OPTIONS.map((o) => ({
            id: String(o.value),
            label: o.label,
          }))}
          onChange={(raw) => onTimeframeChange(Number(raw) as StrategyTimeframeMinutes)}
        />
        <CompactSelect
          label="Период"
          value={period}
          options={STRATEGY_LAB_PERIOD_OPTIONS}
          onChange={onPeriodChange}
        />
        {candlesSummary ? (
          <span className="font-mono text-[10px] tabular-nums text-zinc-500">{candlesSummary}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded border border-white/[0.05] bg-black/20 px-2 py-1">
        <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
          <LayerInlineSelect
            label="Уровни"
            value={layerModes.levels}
            options={LEVELS_LAYER_OPTIONS}
            onChange={(levels) => onLayerModesChange({ levels })}
          />
          <span className="text-zinc-700">·</span>
          <LayerInlineSelect
            label="Буферы"
            value={layerModes.buffers}
            options={BUFFERS_LAYER_OPTIONS}
            onChange={(buffers) => onLayerModesChange({ buffers })}
          />
          <span className="text-zinc-700">·</span>
          <LayerInlineSelect
            label="Экстремумы"
            value={layerModes.extremums}
            options={EXTREMUMS_LAYER_OPTIONS}
            onChange={(extremums) => onLayerModesChange({ extremums })}
          />
          <span className="text-zinc-700">·</span>
          <LayerInlineSelect
            label="Реакции"
            value={layerModes.reactions}
            options={REACTIONS_LAYER_OPTIONS}
            onChange={(reactions) => onLayerModesChange({ reactions })}
          />
          <span className="text-zinc-700">·</span>
          <LayerInlineSelect
            label="Сессии"
            value={layerModes.sessions}
            options={SESSIONS_LAYER_OPTIONS}
            onChange={(sessions) => onLayerModesChange({ sessions })}
          />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setLayersExpanded((prev) => !prev)}
            className="rounded border border-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-lab-muted"
          >
            {layersExpanded ? "Скрыть слои" : "Слои"}
          </button>
          {!layersExpanded ? (
            <span className="truncate font-mono text-[10px] text-zinc-600">{layerSummary}</span>
          ) : null}
        </div>
      </div>

      {layersExpanded ? (
        <div className="flex flex-wrap items-center gap-2 rounded border border-white/[0.05] bg-black/15 px-2 py-1.5 lg:hidden">
          <LayerInlineSelect
            label="Уровни"
            value={layerModes.levels}
            options={LEVELS_LAYER_OPTIONS}
            onChange={(levels) => onLayerModesChange({ levels })}
          />
          <LayerInlineSelect
            label="Буферы"
            value={layerModes.buffers}
            options={BUFFERS_LAYER_OPTIONS}
            onChange={(buffers) => onLayerModesChange({ buffers })}
          />
          <LayerInlineSelect
            label="Экстремумы"
            value={layerModes.extremums}
            options={EXTREMUMS_LAYER_OPTIONS}
            onChange={(extremums) => onLayerModesChange({ extremums })}
          />
          <LayerInlineSelect
            label="Реакции"
            value={layerModes.reactions}
            options={REACTIONS_LAYER_OPTIONS}
            onChange={(reactions) => onLayerModesChange({ reactions })}
          />
          <LayerInlineSelect
            label="Сессии"
            value={layerModes.sessions}
            options={SESSIONS_LAYER_OPTIONS}
            onChange={(sessions) => onLayerModesChange({ sessions })}
          />
        </div>
      ) : null}
    </div>
  );
}
