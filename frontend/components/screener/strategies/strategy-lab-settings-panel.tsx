"use client";

import { cn } from "@/lib/utils/cn";
import { STRATEGY_LAB_FIELD_LABELS } from "@/lib/strategies/strategy-lab-labels";
import type { SessionPreset } from "@/lib/strategies/session-box-engine";
import type { ApproachFactorMode } from "@/lib/strategies/round-approach-zone-engine";

type AnalysisPresetId = "quick" | "normal" | "deep";

const ANALYSIS_PRESET_OPTIONS: Array<{ id: AnalysisPresetId; label: string; description: string }> = [
  { id: "quick", label: "Быстро", description: "4–6 св. · рядом с ценой" },
  { id: "normal", label: "Нормально", description: "8 св. · диапазон + padding" },
  { id: "deep", label: "Глубоко", description: "12 св. · все уровни периода" },
];

const SESSION_PRESET_OPTIONS: Array<{ id: SessionPreset; label: string }> = [
  { id: "moex_stocks", label: "MOEX акции" },
  { id: "extended_msk", label: "Расширенная" },
  { id: "utc_day", label: "UTC 00–24" },
];

const APPROACH_FACTOR_OPTIONS: Array<{ id: ApproachFactorMode; label: string }> = [
  { id: "auto", label: "auto" },
  { id: "2x", label: "2x" },
  { id: "2.5x", label: "2.5x" },
  { id: "3x", label: "3x" },
];

export function StrategyLabSettingsPanel({
  analysisPreset,
  onAnalysisPresetChange,
  bufferAuto,
  onBufferAutoChange,
  customBuffer,
  onCustomBufferChange,
  sessionPreset,
  onSessionPresetChange,
  showNearMiss,
  onShowNearMissChange,
  approachFactor,
  onApproachFactorChange,
  contextHudExpanded,
  onContextHudExpandedChange,
}: {
  analysisPreset: AnalysisPresetId;
  onAnalysisPresetChange: (value: AnalysisPresetId) => void;
  bufferAuto: boolean;
  onBufferAutoChange: (value: boolean) => void;
  customBuffer: string;
  onCustomBufferChange: (value: string) => void;
  sessionPreset: SessionPreset;
  onSessionPresetChange: (value: SessionPreset) => void;
  showNearMiss: boolean;
  onShowNearMissChange: (value: boolean) => void;
  approachFactor: ApproachFactorMode;
  onApproachFactorChange: (value: ApproachFactorMode) => void;
  contextHudExpanded: boolean;
  onContextHudExpandedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-white/[0.06] bg-black/25 px-2.5 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">Настройки анализа</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] text-zinc-600">Глубина</span>
        {ANALYSIS_PRESET_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.description}
            onClick={() => onAnalysisPresetChange(option.id)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[10px] transition-colors",
              analysisPreset === option.id
                ? "border-cyan-800/50 bg-cyan-950/20 text-cyan-200"
                : "border-white/[0.06] text-lab-muted hover:border-white/[0.10] hover:text-lab-text",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-lab-muted">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={bufferAuto}
            onChange={(e) => onBufferAutoChange(e.target.checked)}
            className="accent-cyan-500"
          />
          <span>{STRATEGY_LAB_FIELD_LABELS.bufferAuto}</span>
        </label>
        {!bufferAuto ? (
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={customBuffer}
            onChange={(e) => onCustomBufferChange(e.target.value)}
            className="w-16 rounded border border-white/[0.08] bg-black/20 px-1 py-0.5 text-right text-[10px] text-lab-text outline-none focus:border-cyan-800/40"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] text-zinc-600">Сессии</span>
        {SESSION_PRESET_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSessionPresetChange(option.id)}
            className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
              sessionPreset === option.id
                ? "border-cyan-800/50 bg-cyan-950/20 text-cyan-200"
                : "border-white/[0.06] text-lab-muted hover:border-white/[0.10] hover:text-lab-text",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-1 border-t border-white/[0.06] pt-2">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">Chart HUD</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 font-mono text-[10px] text-lab-muted">
            <input
              type="checkbox"
              checked={showNearMiss}
              onChange={(e) => onShowNearMissChange(e.target.checked)}
              className="accent-cyan-500"
            />
            <span>Show near miss</span>
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-zinc-600">Approach factor</span>
            {APPROACH_FACTOR_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onApproachFactorChange(option.id)}
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                  approachFactor === option.id
                    ? "border-cyan-800/50 bg-cyan-950/20 text-cyan-200"
                    : "border-white/[0.06] text-lab-muted hover:border-white/[0.10] hover:text-lab-text",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-zinc-600">Context HUD</span>
            <button
              type="button"
              onClick={() => onContextHudExpandedChange(false)}
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                !contextHudExpanded
                  ? "border-cyan-800/50 bg-cyan-950/20 text-cyan-200"
                  : "border-white/[0.06] text-lab-muted hover:border-white/[0.10] hover:text-lab-text",
              )}
            >
              collapsed
            </button>
            <button
              type="button"
              onClick={() => onContextHudExpandedChange(true)}
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                contextHudExpanded
                  ? "border-cyan-800/50 bg-cyan-950/20 text-cyan-200"
                  : "border-white/[0.06] text-lab-muted hover:border-white/[0.10] hover:text-lab-text",
              )}
            >
              expanded
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
