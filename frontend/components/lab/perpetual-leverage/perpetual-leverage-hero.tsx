"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { StatusChip } from "@/components/ui/metrics-minimalism";

const STEPS = [
  "Задай депозит и плечо",
  "Смотри стоп и ликвидацию",
  "Сравни сценарии",
] as const;

export function PerpetualLeverageHero() {
  return (
    <LabGlassPanel
      depth={30}
      className="perp-lab-hero relative overflow-hidden border-white/10 px-4 py-5 sm:px-6 sm:py-6"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_15%_0%,rgba(34,211,238,0.08),transparent_55%),radial-gradient(ellipse_60%_45%_at_95%_10%,rgba(139,92,246,0.07),transparent_50%)]"
        aria-hidden
      />
      <div className="relative space-y-3">
        <StatusChip label="учебная симуляция" tone="muted" />

        <div className="max-w-3xl space-y-2">
          <h1 className="text-balance text-xl font-semibold leading-snug tracking-tight text-slate-50 sm:text-2xl lg:text-[1.65rem]">
            Плечо приближает ликвидацию быстрее, чем кажется
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-400">
            Калькулятор для перехода с MOEX: маржа, стоп и ликвидация на одном экране.
          </p>
        </div>

        <ol className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-4" aria-label="Сценарий за 10 секунд">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2 text-xs text-slate-400">
              <span className="lab-number flex h-5 w-5 shrink-0 items-center justify-center rounded border border-cyan-500/25 bg-cyan-950/30 text-[10px] font-semibold text-cyan-300/90">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </LabGlassPanel>
  );
}
