"use client";

import type { BriefingMode } from "@/components/lab/preparation/preparation-types";
import { cn } from "@/lib/utils/cn";

export function PreparationHeader({
  mode,
  eventCount,
  driverCount,
  nextImportantTime,
  manualEventCount = 0,
  className,
}: {
  mode: BriefingMode;
  eventCount: number;
  driverCount: number;
  nextImportantTime: string | null;
  manualEventCount?: number;
  className?: string;
}) {
  const periodLabel = mode === "day" ? "Сегодня" : "Неделя";

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 xl:grid-cols-4", className)}>
      <SummaryTile
        title={periodLabel}
        value={mode === "day" ? "Дневной брифинг" : "Недельный обзор"}
        caption={mode === "day" ? "Фокус на открытии и событиях дня" : "Драйверы недели и 5 торговых дней"}
        accent="cyan"
      />
      <SummaryTile
        title="События"
        value={eventCount > 0 ? String(eventCount) : "—"}
        caption={
          manualEventCount > 0
            ? `${manualEventCount} вручную · остальное — примеры структуры`
            : eventCount > 0
              ? "Примеры структуры · фильтры по категориям"
              : "Добавьте события вручную"
        }
        accent="amber"
      />
      <SummaryTile
        title="Активные драйверы"
        value={driverCount > 0 ? String(driverCount) : "—"}
        caption="Горячие и остывающие темы · учебная модель"
        accent="violet"
      />
      <SummaryTile
        title="Следующее важное"
        value={nextImportantTime ?? "—"}
        caption={nextImportantTime ? "Ближайшее событие в окне" : "Нет важного события в окне"}
        accent="amber"
      />
    </div>
  );
}

function SummaryTile({
  title,
  value,
  caption,
  accent,
}: {
  title: string;
  value: string;
  caption: string;
  accent: "cyan" | "amber" | "violet";
}) {
  const accentBorder = {
    cyan: "border-lab-cyan/25 shadow-[var(--lab-glow-cyan)]",
    amber: "border-lab-amber/30 shadow-[var(--lab-glow-amber)]",
    violet: "border-lab-violet/30 shadow-[var(--lab-glow-violet)]",
  }[accent];

  const accentLine = {
    cyan: "from-lab-cyan/60 via-lab-cyan/20 to-transparent",
    amber: "from-lab-amber/70 via-lab-amber/25 to-transparent",
    violet: "from-lab-violet/60 via-lab-violet/20 to-transparent",
  }[accent];

  return (
    <div
      className={cn(
        "lab-glass-card relative overflow-hidden border px-3 py-2.5",
        accentBorder,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80", accentLine)} aria-hidden />
      <p className="lab-type-caption text-[10px] uppercase tracking-[0.12em] text-lab-dim">{title}</p>
      <p className="mt-1 font-semibold tracking-tight text-lab-text">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-lab-muted">{caption}</p>
    </div>
  );
}
