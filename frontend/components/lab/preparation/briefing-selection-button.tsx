"use client";

import { cn } from "@/lib/utils/cn";

export function BriefingSelectionButton({
  selected,
  onToggle,
  compact = false,
  className,
}: {
  selected: boolean;
  onToggle: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "lab-status-chip transition",
        compact ? "px-1.5 py-px text-[8px]" : "px-2 py-0.5 text-[10px]",
        selected
          ? "border-lab-violet/40 bg-lab-violet/12 text-lab-violet shadow-[var(--lab-glow-violet)]"
          : "text-lab-muted hover:border-lab-violet/30 hover:text-lab-violet",
        className,
      )}
    >
      {selected ? "Убрать" : "Добавить в эфир"}
    </button>
  );
}
