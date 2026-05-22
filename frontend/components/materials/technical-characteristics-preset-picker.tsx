"use client";

import type { TechnicalPreset } from "@/lib/domain/technical-characteristics-presets";
import { TECHNICAL_PRESET_CARDS } from "@/lib/domain/technical-characteristics-presets";
import { cn } from "@/lib/utils/cn";

export function TechnicalCharacteristicsPresetPicker({
  selected,
  onSelect,
}: {
  selected: TechnicalPreset | null;
  onSelect: (preset: TechnicalPreset) => void;
}) {
  return (
    <section className="rounded-lg border border-cyan-500/15 bg-slate-900/50 p-3 sm:p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Подобрать инструмент</h2>
        <p className="mt-0.5 text-xs text-slate-400">Стиль торговли — таблица отсортирует и покажет, почему инструмент в подборке.</p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {TECHNICAL_PRESET_CARDS.map((card) => {
          const active = selected === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelect(card.id)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition",
                active
                  ? "border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
                  : "border-slate-700/80 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-900/80",
              )}
            >
              <p className={cn("text-sm font-medium", active ? "text-cyan-100" : "text-slate-100")}>{card.title}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{card.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
