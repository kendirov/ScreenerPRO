"use client";

import {
  SPREAD_UNIT_MODE_HINT,
  SPREAD_UNIT_MODE_LABELS,
  type SpreadUnitMode,
} from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

const MODES: SpreadUnitMode[] = ["raw-points", "normalized-points", "money-value"];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition",
        active
          ? "border-cyan-500/40 bg-cyan-950/50 text-cyan-100"
          : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
      )}
    >
      {children}
    </button>
  );
}

export function CurrencyCorrelationUnitControls({
  unitMode,
  onUnitModeChange,
  warning,
}: {
  unitMode: SpreadUnitMode;
  onUnitModeChange: (mode: SpreadUnitMode) => void;
  warning?: string | null;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-slate-950/45 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 w-[4.5rem] shrink-0 text-[10px] uppercase tracking-[0.12em] text-slate-600">
          Единицы
        </span>
        {MODES.map((mode) => (
          <Pill key={mode} active={unitMode === mode} onClick={() => onUnitModeChange(mode)}>
            {SPREAD_UNIT_MODE_LABELS[mode]}
          </Pill>
        ))}
      </div>
      <p className="pl-[4.75rem] text-[10px] leading-snug text-slate-600">{SPREAD_UNIT_MODE_HINT}</p>
      {warning ? (
        <p className="rounded-md border border-amber-500/20 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-200/90">
          {warning}
        </p>
      ) : null}
    </div>
  );
}
