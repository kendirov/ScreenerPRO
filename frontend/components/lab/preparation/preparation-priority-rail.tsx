"use client";

import type { PreparationPriorityCard } from "@/lib/domain/preparation-priority-highlights";
import { priorityKindLabel } from "@/lib/domain/preparation-priority-highlights";
import { cn } from "@/lib/utils/cn";

const ACCENT: Record<PreparationPriorityCard["accent"], string> = {
  amber: "border-lab-amber/35 bg-gradient-to-br from-lab-amber/10 to-transparent shadow-[var(--lab-glow-amber)]",
  violet: "border-lab-violet/30 bg-gradient-to-br from-lab-violet/8 to-transparent",
  cyan: "border-lab-cyan/30 bg-gradient-to-br from-lab-cyan/8 to-transparent",
  green: "border-lab-green/30 bg-gradient-to-br from-lab-green/8 to-transparent",
  red: "border-lab-red/35 bg-gradient-to-br from-lab-red/8 to-transparent",
};

export function PreparationPriorityRail({ cards }: { cards: PreparationPriorityCard[] }) {
  return (
    <div className="lab-glass-panel p-2">
      <p className="mb-2 px-1 text-xs font-semibold text-lab-amber/90">Что важно сегодня</p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((card) => (
          <article
            key={card.id}
            className={cn(
              "min-w-[148px] max-w-[200px] shrink-0 rounded-lg border px-2.5 py-2",
              ACCENT[card.accent],
            )}
          >
            <p className="text-[9px] uppercase tracking-wide text-lab-dim">{priorityKindLabel(card.kind)}</p>
            <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug text-lab-text">{card.value}</p>
            {card.hint ? <p className="mt-1 line-clamp-1 text-[10px] text-lab-muted">{card.hint}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
