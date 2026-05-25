"use client";

import type { PreparationEventSourceFilter } from "@/lib/domain/smartlab-calendar";
import { PREPARATION_EVENT_SOURCE_LABELS } from "@/lib/domain/smartlab-calendar";
import { cn } from "@/lib/utils/cn";

const SOURCE_KEYS = Object.keys(PREPARATION_EVENT_SOURCE_LABELS) as PreparationEventSourceFilter[];

export function PreparationEventSourceSwitch({
  value,
  onChange,
  smartLabStatus,
  className,
}: {
  value: PreparationEventSourceFilter;
  onChange: (value: PreparationEventSourceFilter) => void;
  smartLabStatus?: "ok" | "empty" | "error" | "loading";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-[10px] uppercase tracking-wide text-lab-dim">Источник</span>
      <div className="flex flex-wrap gap-1">
        {SOURCE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "lab-status-chip px-2 py-0.5 text-[10px] transition",
              value === key
                ? "border-lab-cyan/35 bg-lab-cyan/10 text-lab-cyan"
                : "text-lab-muted hover:text-lab-text",
            )}
          >
            {PREPARATION_EVENT_SOURCE_LABELS[key]}
          </button>
        ))}
      </div>
      {smartLabStatus === "loading" ? (
        <span className="font-mono text-[9px] text-lab-dim">Smart-Lab · загрузка…</span>
      ) : smartLabStatus === "ok" ? (
        <span className="font-mono text-[9px] text-lab-cyan/80">Smart-Lab · эксперимент</span>
      ) : smartLabStatus === "error" ? (
        <span className="font-mono text-[9px] text-lab-amber/85">Smart-Lab · ошибка · ручной импорт</span>
      ) : null}
    </div>
  );
}
