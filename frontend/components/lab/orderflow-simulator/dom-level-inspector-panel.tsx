"use client";

import type { DomLevelTooltipData } from "@/lib/domain/order-book-ladder-model";
import { formatLots } from "@/lib/domain/order-book-ladder-model";
import { buildLevelInspectorLesson } from "@/lib/domain/dom-level-inspector";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

type DomLevelInspectorPanelProps = {
  data: DomLevelTooltipData | null;
  teachingCaption?: string | null;
  className?: string;
};

export function DomLevelInspectorPanel({ data, teachingCaption, className }: DomLevelInspectorPanelProps) {
  const lesson = data ? buildLevelInspectorLesson(data) : null;

  return (
    <aside
      className={cn(
        "dom-level-inspector flex min-h-0 flex-col overflow-hidden border-l border-white/[0.06] bg-[#030508]",
        className,
      )}
    >
      <header className="shrink-0 border-b border-white/[0.04] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">
        Инспектор уровня
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
        {!data ? (
          <p className="text-slate-500">
            Кликните по строке стакана (bid или ask), чтобы разобрать уровень. Все цифры — симуляция GAZP.
          </p>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-wider text-slate-600">Выбранный уровень</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-sky-100">{formatPrice(data.price)}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Сторона: <span className={data.side === "ask" ? "text-rose-300" : "text-emerald-300"}>{data.side}</span>
            </p>

            <dl className="mt-3 space-y-1.5 text-[10px]">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Объём</dt>
                <dd className="tabular-nums text-slate-200">{data.volume > 0 ? formatLots(data.volume) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">% от scale</dt>
                <dd className="tabular-nums">{data.pctOfScale.toFixed(1)}%</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Крупная плотность</dt>
                <dd>{data.isLarge ? "да" : "нет"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Круглый уровень</dt>
                <dd>{data.isRoundLevel ? "да" : "нет"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Айсберг</dt>
                <dd>{data.side === "ask" ? (data.askIceberg ? "да" : "нет") : data.bidIceberg ? "да" : "нет"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600">Сделок по цене</dt>
                <dd className="tabular-nums">{data.tradeCount}</dd>
              </div>
            </dl>

            {lesson ? (
              <p className="mt-4 rounded border border-violet-500/15 bg-violet-950/20 px-2 py-1.5 text-[10px] leading-snug text-violet-100/90">
                {lesson}
              </p>
            ) : null}
          </>
        )}

        {teachingCaption ? (
          <p className="mt-3 rounded border border-amber-500/20 bg-amber-950/25 px-2 py-1.5 text-[10px] leading-snug text-amber-100/90">
            {teachingCaption}
          </p>
        ) : null}
      </div>

      <p className="shrink-0 border-t border-white/[0.04] px-2 py-1 text-center font-mono text-[8px] text-amber-200/70">
        Симуляция · не MOEX
      </p>
    </aside>
  );
}
