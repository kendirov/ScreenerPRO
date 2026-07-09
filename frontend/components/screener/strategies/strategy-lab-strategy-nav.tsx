"use client";

import { cn } from "@/lib/utils/cn";
import {
  STRATEGY_LAB_STRATEGY_OPTIONS,
  STRATEGY_LAB_STRATEGY_NAV_COMPACT,
  type StrategyLabStrategyId,
} from "@/lib/strategies/strategy-lab-ux";

export function StrategyLabStrategyNav({
  activeStrategy,
  onStrategyChange,
}: {
  activeStrategy: StrategyLabStrategyId;
  onStrategyChange: (strategy: StrategyLabStrategyId) => void;
}) {
  if (!STRATEGY_LAB_STRATEGY_NAV_COMPACT) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STRATEGY_LAB_STRATEGY_OPTIONS.map((option) => {
          const active = activeStrategy === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={!option.available}
              onClick={() => option.available && onStrategyChange(option.id)}
              className={cn(
                "rounded border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-cyan-800/50 bg-cyan-950/25"
                  : "border-white/[0.08] bg-black/25 hover:border-white/[0.12]",
                !option.available && "cursor-not-allowed opacity-50",
              )}
            >
              <p
                className={cn(
                  "font-mono text-[11px] font-medium",
                  active ? "text-cyan-100" : "text-lab-text",
                )}
              >
                {option.label}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{option.description}</p>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-11 max-h-14 items-stretch gap-1 overflow-x-auto rounded border border-white/[0.06] bg-black/25 p-0.5">
      {STRATEGY_LAB_STRATEGY_OPTIONS.map((option) => {
        const active = activeStrategy === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={!option.available}
            onClick={() => option.available && onStrategyChange(option.id)}
            title={option.available ? option.description : "В разработке"}
            className={cn(
              "min-w-[7.5rem] shrink-0 rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
              active
                ? "border border-cyan-800/45 bg-cyan-950/25 text-cyan-100"
                : "border border-transparent text-lab-muted hover:text-lab-text",
              !option.available && "cursor-not-allowed opacity-45",
            )}
          >
            <span className="block truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
