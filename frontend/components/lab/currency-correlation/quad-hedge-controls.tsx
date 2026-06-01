"use client";

import * as React from "react";
import type { QuadHedgeSpreadUnitMode, QuadHedgeViewMode } from "@/lib/domain/quad-hedge/types";
import {
  SPREAD_LAB_DEFAULT_HISTORY_DEPTH,
  SPREAD_LAB_HISTORY_DEPTH_OPTIONS,
  type SpreadLabHistoryDepth,
} from "@/lib/domain/quad-hedge/spread-lab-config";
import { cn } from "@/lib/utils/cn";

const PAIR_MODES: Array<{ id: QuadHedgeViewMode; label: string }> = [
  { id: "SI-CN", label: "SI–CN" },
  { id: "SI-EU", label: "SI–EU" },
  { id: "EU-CN", label: "EU–CN" },
];

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-md border border-white/[0.06] bg-slate-950/50 p-0.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded px-2.5 py-0.5 font-mono text-[10px] tracking-wide transition-colors",
            value === opt.id
              ? "bg-cyan-950/60 text-cyan-100/90"
              : "text-slate-500 hover:text-slate-300",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function QuadHedgeSpreadLabControls({
  viewMode,
  onViewModeChange,
  spreadUnitMode,
  onSpreadUnitModeChange,
  historyDepth = SPREAD_LAB_DEFAULT_HISTORY_DEPTH,
  onHistoryDepthChange,
  className,
}: {
  viewMode: QuadHedgeViewMode;
  onViewModeChange: (v: QuadHedgeViewMode) => void;
  spreadUnitMode: QuadHedgeSpreadUnitMode;
  onSpreadUnitModeChange: (v: QuadHedgeSpreadUnitMode) => void;
  historyDepth?: SpreadLabHistoryDepth;
  onHistoryDepthChange?: (v: SpreadLabHistoryDepth) => void;
  className?: string;
}) {
  const unitOptions: Array<{ id: QuadHedgeSpreadUnitMode; label: string }> = [
    { id: "points", label: "пункты" },
    { id: "pct", label: "%" },
  ];

  const depthOptions = SPREAD_LAB_HISTORY_DEPTH_OPTIONS.map((o) => ({
    id: o.id,
    label: o.label,
  }));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <SegmentedControl options={PAIR_MODES} value={viewMode} onChange={onViewModeChange} />
      {onHistoryDepthChange ? (
        <SegmentedControl
          options={depthOptions}
          value={historyDepth}
          onChange={onHistoryDepthChange}
        />
      ) : null}
      <SegmentedControl
        options={unitOptions}
        value={spreadUnitMode}
        onChange={onSpreadUnitModeChange}
      />
    </div>
  );
}

/** @deprecated Legacy controls — см. QuadHedgeSpreadLabControls */
export {
  QuadHedgeSpreadLabControls as QuadHedgeControls,
};

export type QuadHedgeDatePreset = "today" | "yesterday" | "pick";
export type QuadHedgeIntervalPreset = "30m" | "60m" | "day" | "5d";
