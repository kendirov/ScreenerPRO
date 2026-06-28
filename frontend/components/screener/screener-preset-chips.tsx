"use client";

import { cn } from "@/lib/utils/cn";

export function ScreenerPresetChips<T extends string>({
  presets,
  activeId,
  counts,
  onSelect,
  onReset,
}: {
  presets: readonly { id: T; label: string; description: string }[];
  activeId: T | null;
  counts: Record<string, number>;
  onSelect: (id: T) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {presets.map((preset) => {
        const active = activeId === preset.id;
        const count = counts[preset.id] ?? 0;
        return (
          <button
            key={preset.id}
            type="button"
            title={preset.description}
            onClick={() => onSelect(preset.id)}
            className={cn(
              "lab-chip inline-flex items-center gap-1 px-2 py-1 text-[11px] transition",
              active
                ? "lab-chip-active border-lab-cyan/40 bg-lab-cyan/12 text-lab-cyan"
                : "text-lab-muted hover:text-lab-text",
            )}
          >
            <span>{preset.label}</span>
            <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
          </button>
        );
      })}
      {activeId ? (
        <button type="button" onClick={onReset} className="px-2 text-[10px] text-lab-dim hover:text-lab-text">
          сброс
        </button>
      ) : null}
    </div>
  );
}
