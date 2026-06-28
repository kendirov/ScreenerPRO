"use client";

const BRIEFING_STEPS = [
  "Контекст",
  "События",
  "Внешний фон",
  "Товары",
  "Валюта",
  "Индекс",
  "Фишки",
  "В игре",
  "Итог",
] as const;

export function BriefingOrder() {
  return (
    <div className="flex flex-wrap items-center gap-1 px-0.5">
      {BRIEFING_STEPS.map((step, index) => (
        <span key={step} className="flex items-center gap-1">
          <span className="rounded border border-white/[0.08] bg-slate-950/30 px-1.5 py-0.5 font-mono text-[9px] text-lab-text-dim">
            {step}
          </span>
          {index < BRIEFING_STEPS.length - 1 ? (
            <span className="font-mono text-[8px] text-white/20">→</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
