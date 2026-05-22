"use client";

import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { SpreadPairLifecycleCurrent } from "@/lib/domain/spread-lifecycle";
import { LIFECYCLE_BREAKDOWN_DISCLAIMER } from "@/lib/domain/spread-lifecycle";
import {
  formatUnitValueShort,
  type SpreadUnitMode,
} from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

const STATE_TONE: Record<string, string> = {
  норма: "border-emerald-500/25 bg-emerald-950/25 text-emerald-200",
  наблюдение: "border-amber-500/25 bg-amber-950/20 text-amber-200",
  растяжение: "border-violet-500/30 bg-violet-950/25 text-violet-200",
  экстрим: "border-orange-500/30 bg-orange-950/25 text-orange-200",
  возврат: "border-emerald-500/30 bg-emerald-950/30 text-emerald-200",
  невозврат: "border-rose-500/35 bg-rose-950/30 text-rose-200",
  "вне недельного контекста": "border-cyan-500/30 bg-cyan-950/25 text-cyan-200",
};

function fmtZ(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

export function CurrencyCorrelationPairStatePanel({
  pairs,
  selectedPair,
  onSelectedPairChange,
  unitMode,
  compact,
}: {
  pairs: Partial<Record<PointsPairKey, SpreadPairLifecycleCurrent | undefined>>;
  selectedPair: PointsPairKey;
  onSelectedPairChange: (p: PointsPairKey) => void;
  unitMode: SpreadUnitMode;
  compact?: boolean;
}) {
  const available = (["SI/CNY", "SI/ED", "CNY/ED"] as const).filter((k) => pairs[k]);
  const current = pairs[selectedPair];

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-slate-900/50 backdrop-blur-xl",
        compact ? "px-2.5 py-2" : "px-3 py-3",
      )}
    >
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">
        Текущее состояние пары
      </p>

      <div className="mb-2 flex flex-wrap gap-1">
        {available.map((pk) => (
          <button
            key={pk}
            type="button"
            onClick={() => onSelectedPairChange(pk)}
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[10px] transition",
              selectedPair === pk
                ? "border-cyan-500/35 bg-cyan-950/40 text-cyan-100"
                : "border-white/[0.06] text-slate-500 hover:text-slate-300",
            )}
          >
            {pk.replace("/", " − ")}
          </button>
        ))}
      </div>

      {!current ? (
        <p className="text-[11px] text-slate-500">Нет данных по выбранной паре.</p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-violet-200/90">{current.pairLabel}</span>
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[9px] uppercase tracking-wide",
                STATE_TONE[current.stateLabel] ?? STATE_TONE["норма"],
              )}
            >
              {current.stateLabel}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            <dt className="text-slate-600">Спред (разница)</dt>
            <dd className="text-right font-mono tabular-nums text-slate-100">
              {formatUnitValueShort(current.currentSpread, unitMode)}
            </dd>
            <dt className="text-slate-600">Отклонение</dt>
            <dd className="text-right font-mono tabular-nums text-cyan-200/90">
              {fmtZ(current.currentZ)}
            </dd>
            <dt className="text-slate-600">Кто убежал</dt>
            <dd className="text-right text-slate-300">{current.leaderLabel}</dd>
            <dt className="text-slate-600">Свечей в зоне</dt>
            <dd className="text-right font-mono text-slate-400">{current.barsInZone}</dd>
            <dt className="text-slate-600">Недельный контекст</dt>
            <dd className="text-right text-slate-300">{current.weeklyContextSummary}</dd>
            <dt className="text-slate-600">Сейчас относительно прошлых недель</dt>
            <dd className="text-right text-slate-300">{current.weeklyPositionLabel}</dd>
            <dt className="text-slate-600">Вернулось / не вернулось</dt>
            <dd className="text-right text-slate-300">{current.returnStatusLabel}</dd>
            <dt className="text-slate-600">Свечей вне нормы</dt>
            <dd className="text-right font-mono text-slate-400">{current.barsOutsideNorm}</dd>
          </dl>

          {current.lastEvent ? (
            <div className="mt-2 rounded-md border border-white/[0.05] bg-black/20 px-2 py-1.5 text-[10px]">
              <p className="text-slate-500">Последнее событие</p>
              <p className="mt-0.5 font-medium text-slate-300">{current.lastEvent.label}</p>
              <p className="mt-0.5 leading-snug text-slate-500">{current.lastEvent.description}</p>
            </div>
          ) : null}
        </>
      )}

      <p className="mt-2 border-t border-white/[0.04] pt-2 text-[9px] leading-relaxed text-slate-600">
        {LIFECYCLE_BREAKDOWN_DISCLAIMER}
      </p>
    </div>
  );
}
