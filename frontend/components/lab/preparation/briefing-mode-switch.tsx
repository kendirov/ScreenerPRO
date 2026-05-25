"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BriefingMode } from "@/components/lab/preparation/preparation-types";
import { cn } from "@/lib/utils/cn";

const MODE_LABELS: Record<BriefingMode, string> = {
  day: "День",
  week: "Неделя",
};

const MODE_HINTS: Record<BriefingMode, string> = {
  day: "Сегодня · вчера + сегодня · инструменты в игре · открытие",
  week: "Неделя · главные драйверы · 5 торговых дней · уровни и сценарии",
};

export function BriefingModeSwitch({
  mode,
  onModeChange,
  className,
}: {
  mode: BriefingMode;
  onModeChange: (mode: BriefingMode) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Tabs value={mode} onValueChange={(value) => onModeChange(value as BriefingMode)}>
        <TabsList className="h-9 w-fit rounded-lg border border-lab-border bg-lab-bg-deep/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {(Object.keys(MODE_LABELS) as BriefingMode[]).map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className={cn(
                "rounded-md px-4 text-xs text-lab-muted",
                "data-[state=active]:border data-[state=active]:border-lab-cyan/35",
                "data-[state=active]:bg-lab-cyan/10 data-[state=active]:text-lab-cyan",
                "data-[state=active]:shadow-[var(--lab-glow-cyan)]",
              )}
            >
              {MODE_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="lab-type-caption text-[11px] text-lab-dim">{MODE_HINTS[mode]}</p>
    </div>
  );
}
