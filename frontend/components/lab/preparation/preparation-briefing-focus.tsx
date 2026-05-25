"use client";

import Link from "next/link";
import { Crosshair, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className={cn("lab-glass-panel p-2.5", className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Crosshair className="h-3.5 w-3.5 text-lab-violet/85" />
          <h2 className="text-xs font-semibold text-lab-text">Фокус брифинга</h2>
          <span className="font-mono text-[9px] text-lab-dim">до 8 · без AI</span>
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
            Собрать порядок эфира из фокуса
          </Button>
        ) : null}
      </div>

      {!focus.hasEnoughData ? (
        <p className="rounded-md border border-lab-border/50 bg-lab-bg-deep/30 px-2.5 py-2 text-[11px] text-lab-muted">
          Недостаточно данных. Используем ручной список подготовки.
        </p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {focus.items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-lab-border/55 bg-lab-bg-deep/25 px-2 py-2"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[8px] uppercase tracking-wide text-lab-dim">
                  {KIND_LABEL[item.kind]}
                </span>
                <span className="font-mono text-[8px] tabular-nums text-lab-violet/70">{item.score}</span>
              </div>
              <p className="line-clamp-2 text-[11px] font-medium leading-snug text-lab-text">
                <span className="text-lab-dim">Почему в фокусе · </span>
                {formatFocusReasonLine(item)}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[9px] text-lab-muted">Что открыть</span>
                {item.actionHref ? (
                  <Link
                    href={item.actionHref}
                    className="truncate text-[10px] font-medium text-lab-cyan hover:underline"
                  >
                    {item.actionLabel}
                  </Link>
                ) : (
                  <span className="text-[10px] text-lab-dim">{item.actionLabel}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { applyFocusItemsToBriefing };
