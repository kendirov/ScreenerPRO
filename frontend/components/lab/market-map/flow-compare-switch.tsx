"use client";

import type { FlowCompareMode } from "@/lib/domain/market-flow-map";
import { cn } from "@/lib/utils/cn";

export function FlowCompareSwitch({
  value,
  onChange,
  yesterdayAvailable,
  className,
}: {
  value: FlowCompareMode;
  onChange: (mode: FlowCompareMode) => void;
  yesterdayAvailable: boolean;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-white/[0.06] bg-black/30 p-0.5", className)}>
      <button
        type="button"
        onClick={() => onChange("today")}
        className={cn(
          "rounded-md px-2.5 py-1 text-[11px] transition",
          value === "today" ? "bg-slate-800/90 text-slate-100" : "text-slate-500 hover:text-slate-300",
        )}
      >
        Сегодня
      </button>
      <button
        type="button"
        onClick={() => yesterdayAvailable && onChange("vs-yesterday")}
        disabled={!yesterdayAvailable}
        className={cn(
          "rounded-md px-2.5 py-1 text-[11px] transition",
          value === "vs-yesterday" ? "bg-violet-950/60 text-violet-100" : "text-slate-500 hover:text-slate-300",
          !yesterdayAvailable && "cursor-not-allowed opacity-40",
        )}
      >
        Сегодня vs вчера
      </button>
    </div>
  );
}
