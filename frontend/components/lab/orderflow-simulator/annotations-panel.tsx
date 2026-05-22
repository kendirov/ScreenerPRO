"use client";

import type { SimOrderBookLevel } from "@/lib/domain/orderflow-simulator";
import {
  buildArrowToAsk,
  buildArrowToBid,
  buildCurrentPriceAnnotation,
  buildLargeOrderAnnotation,
  type TeachingAnnotation,
} from "@/lib/domain/orderflow-teaching";
import { cn } from "@/lib/utils/cn";

type AnnotationsPanelProps = {
  levels: SimOrderBookLevel[];
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  annotations: TeachingAnnotation[];
  onAdd: (annotation: TeachingAnnotation) => void;
  onClear: () => void;
  compact?: boolean;
  className?: string;
};

const btnClass =
  "rounded-md border border-white/[0.08] bg-slate-900/80 px-2 py-1.5 text-[11px] text-slate-200 transition hover:border-violet-500/25 hover:bg-violet-950/30";

export function AnnotationsPanel({
  levels,
  currentPrice,
  minPrice,
  maxPrice,
  annotations,
  onAdd,
  onClear,
  compact = false,
  className,
}: AnnotationsPanelProps) {
  const addOrSkip = (item: TeachingAnnotation | null) => {
    if (item) onAdd(item);
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-violet-500/10 bg-slate-950/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(167,139,250,0.06)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-violet-300/90">Аннотации</h3>
          {!compact ? (
            <p className="mt-0.5 text-[10px] text-slate-500">Подсказки для урока и записи · симуляция</p>
          ) : null}
        </div>
        <span className="font-mono text-[10px] text-slate-600">{annotations.length} шт.</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className={btnClass} onClick={() => addOrSkip(buildArrowToBid(levels, minPrice, maxPrice))}>
          → Стрелка к bid
        </button>
        <button type="button" className={btnClass} onClick={() => addOrSkip(buildArrowToAsk(levels, minPrice, maxPrice))}>
          → Стрелка к ask
        </button>
        <button type="button" className={btnClass} onClick={() => onAdd(buildCurrentPriceAnnotation(currentPrice))}>
          Подсветить цену
        </button>
        <button
          type="button"
          className={btnClass}
          onClick={() => addOrSkip(buildLargeOrderAnnotation(levels, minPrice, maxPrice))}
        >
          Крупная заявка
        </button>
        <button
          type="button"
          className={cn(btnClass, "border-rose-500/20 text-rose-300/90 hover:bg-rose-950/30")}
          onClick={onClear}
        >
          Очистить
        </button>
      </div>
    </div>
  );
}
