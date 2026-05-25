"use client";

import Link from "next/link";
import { Crosshair, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  applyFocusItemsToBriefing,
  formatFocusReasonLine,
  type PreparationFocusItem,
  type PreparationFocusPack,
} from "@/lib/domain/preparation-focus-score";
import { cn } from "@/lib/utils/cn";

const KIND_LABEL: Record<PreparationFocusItem["kind"], string> = {
  event: "событие",
  instrument: "инструмент",
  driver: "драйвер",
};

const KIND_TONE: Record<PreparationFocusItem["kind"], string> = {
  event: "border-lab-amber/25 bg-lab-amber/5",
  instrument: "border-lab-cyan/22 bg-lab-cyan/5",
  driver: "border-lab-violet/25 bg-lab-violet/5",
};

export function PreparationBriefingFocus({
  focus,
  onApplyToBriefing,
  className,
}: {
  focus: PreparationFocusPack;
  onApplyToBriefing: (items: PreparationFocusItem[]) => void;
  className?: string;
}) {
  const handleApply = () => {
    onApplyToBriefing(focus.items);
  };

  return (
    <LabGlassPanel depth={30} variant="strong" className={cn("p-2.5", className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Crosshair className="h-3.5 w-3.5 text-lab-violet/85" />
          <h2 className="text-xs font-semibold text-lab-text">Фокус брифинга</h2>
          <span className="lab-chip px-1.5 py-px text-[8px] text-lab-dim">до 8 · без AI</span>
        </div>
        {focus.hasEnoughData ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-[10px] text-lab-violet hover:bg-lab-violet/10 hover:text-lab-violet"
            onClick={handleApply}
          >
            <ListPlus className="h-3 w-3" />
            Собрать порядок эфира
          </Button>
        ) : null}
      </div>

      {!focus.hasEnoughData ? (
        <p className="rounded-lg border border-dashed border-lab-border/60 bg-lab-surface-soft px-2.5 py-3 text-[11px] text-lab-muted">
          Недостаточно данных. Используем ручной список подготовки.
        </p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {focus.items.map((item) => (
            <li
              key={item.id}
              className={cn("rounded-lg border px-2 py-2", KIND_TONE[item.kind])}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[8px] uppercase tracking-wide text-lab-dim">
                  {KIND_LABEL[item.kind]}
                </span>
                <span className="lab-number font-mono text-[8px] text-lab-violet/70">{item.score}</span>
              </div>
              <p className="line-clamp-1 text-[11px] font-semibold leading-snug text-lab-text">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-lab-muted">
                {formatFocusReasonLine(item)}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-lab-border/40 pt-1.5">
                <span className="text-[8px] uppercase tracking-wide text-lab-dim">Открыть</span>
                {item.actionHref ? (
                  <Link
                    href={item.actionHref}
                    className="truncate text-[10px] font-medium text-lab-cyan hover:underline"
                  >
                    {item.actionLabel}
                  </Link>
                ) : (
                  <span className="truncate text-[10px] text-lab-dim">{item.actionLabel}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </LabGlassPanel>
  );
}

export { applyFocusItemsToBriefing };
