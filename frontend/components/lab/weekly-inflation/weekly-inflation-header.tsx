"use client";

import { cn } from "@/lib/utils/cn";

export function WeeklyInflationHeader({ className }: { className?: string }) {
  return (
    <div className={cn("lab-glass-panel relative overflow-hidden px-4 py-3", className)}>
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-40" aria-hidden />
      <p className="text-sm leading-relaxed text-lab-muted">
        Макро-дашборд для недельной инфляции РФ: последняя неделя, импульс 4/8/12 недель, годовой темп,
        отклонение от цели ЦБ 4%, вклад категорий и рыночная интерпретация для ОФЗ, банков, рубля и
        индекса.
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-lab-violet/75">
        черновик · данные только из явного источника · без подстановки фейковых рядов
      </p>
    </div>
  );
}
