"use client";

import { cn } from "@/lib/utils/cn";
import type { LadderScaleMode } from "@/lib/domain/entry-anchored-ladder-scale";

type Props = {
  mode: LadderScaleMode;
  onChange: (mode: LadderScaleMode) => void;
  className?: string;
};

const MODES: { id: LadderScaleMode; label: string }[] = [
  { id: "risk_focus", label: "Фокус на риске" },
  { id: "full_range", label: "Полный диапазон" },
];

export function LadderScaleModeToggle({ mode, onChange, className }: Props) {
  return (
    <div
      className={cn("flex gap-1 rounded-lg border border-white/[0.06] bg-black/40 p-0.5", className)}
      role="group"
      aria-label="Режим масштаба графика"
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(m.id)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition sm:text-[11px]",
              active
                ? "bg-cyan-950/50 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
