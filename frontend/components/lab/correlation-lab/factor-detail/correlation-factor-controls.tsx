"use client";

import type { ReactNode } from "react";
import type { CorrelationApiInterval, CorrelationApiPeriod } from "@/lib/domain/correlation-api";
import {
  CORRELATION_SORT_LABELS,
  type CorrelationSortMode,
  type CorrelationWindowMode,
} from "@/lib/domain/correlation-factor-detail-display";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";

const PERIODS: CorrelationApiPeriod[] = [5, 20, 60];
const INTERVALS: { value: CorrelationApiInterval; label: string }[] = [
  { value: 10, label: "10м" },
  { value: 60, label: "60м" },
  { value: 24, label: "день" },
];
const WINDOWS: CorrelationWindowMode[] = [20, 60, 120];
const SORTS: CorrelationSortMode[] = ["strong", "inverse", "break", "weak"];

export function CorrelationFactorControls({
  period,
  interval,
  windowMode,
  sortMode,
  onPeriodChange,
  onIntervalChange,
  onWindowChange,
  onSortChange,
  periodLockedInterval,
}: {
  period: CorrelationApiPeriod;
  interval: CorrelationApiInterval;
  windowMode: CorrelationWindowMode;
  sortMode: CorrelationSortMode;
  onPeriodChange: (p: CorrelationApiPeriod) => void;
  onIntervalChange: (i: CorrelationApiInterval) => void;
  onWindowChange: (w: CorrelationWindowMode) => void;
  onSortChange: (s: CorrelationSortMode) => void;
  periodLockedInterval: boolean;
}) {
  return (
    <LabGlassPanel depth={10} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
      <ControlGroup label="Период">
        {PERIODS.map((p) => (
          <ToggleChip key={p} active={period === p} onClick={() => onPeriodChange(p)}>
            {p}д
          </ToggleChip>
        ))}
      </ControlGroup>

      <ControlGroup label="Интервал">
        {INTERVALS.map(({ value, label }) => (
          <ToggleChip
            key={value}
            active={interval === value || (periodLockedInterval && value === 24)}
            disabled={periodLockedInterval && value !== 24}
            onClick={() => onIntervalChange(value)}
            title={periodLockedInterval && value !== 24 ? "Для 20/60д — только дневные свечи" : undefined}
          >
            {label}
          </ToggleChip>
        ))}
      </ControlGroup>

      <ControlGroup label="Окно">
        {WINDOWS.map((w) => (
          <ToggleChip key={w} active={windowMode === w} onClick={() => onWindowChange(w)}>
            {w}
          </ToggleChip>
        ))}
      </ControlGroup>

      <ControlGroup label="Сортировка">
        {SORTS.map((s) => (
          <ToggleChip key={s} active={sortMode === s} onClick={() => onSortChange(s)}>
            {CORRELATION_SORT_LABELS[s]}
          </ToggleChip>
        ))}
      </ControlGroup>
    </LabGlassPanel>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.1em] text-lab-dim">{label}</span>
      {children}
    </div>
  );
}

function ToggleChip({
  children,
  active,
  disabled,
  onClick,
  title,
}: {
  children: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] transition",
        active
          ? "border-lab-cyan/40 bg-lab-cyan/12 text-lab-cyan"
          : "border-lab-border-soft/50 text-lab-muted hover:text-lab-text",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}
