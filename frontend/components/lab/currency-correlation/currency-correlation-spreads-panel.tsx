"use client";

import type { PairSpreadSnapshot, SpreadStatusLabel } from "@/lib/domain/currency-correlation-points-model";
import { getPairConfig } from "@/lib/domain/currency-pair-config";
import { formatPairSpreadValue } from "@/lib/domain/currency-pair-divergence";
import type { SpreadUnitMode } from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

const STATUS_TONE: Record<SpreadStatusLabel, string> = {
  норма: "border-emerald-500/30 bg-emerald-950/25 text-emerald-200",
  наблюдение: "border-amber-500/30 bg-amber-950/25 text-amber-200",
  растяжение: "border-violet-500/30 bg-violet-950/25 text-violet-200",
  экстрим: "border-rose-500/35 bg-rose-950/30 text-rose-200",
  "—": "border-slate-600/40 bg-slate-950/40 text-slate-500",
};

function fmtZ(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

export function CurrencyCorrelationSpreadsPanel({
  spreads,
  compact,
  unitMode = "raw-points",
}: {
  spreads: PairSpreadSnapshot[];
  compact?: boolean;
  unitMode?: SpreadUnitMode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-slate-900/50 backdrop-blur-xl",
        compact ? "px-2.5 py-2" : "px-3 py-3",
      )}
    >
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">Спреды сейчас</p>
      <ul className={cn(compact ? "space-y-2" : "space-y-3")}>
        {spreads.map((row) => (
          <li
            key={row.pairKey}
            className={cn(
              "rounded-lg border border-white/[0.05] bg-black/25",
              compact ? "px-2 py-2" : "px-3 py-2.5",
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <span className="font-mono text-xs text-violet-200/90">{row.label}</span>
                <p className="text-[9px] text-slate-600">режим: {row.modeLabelRu}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md border px-2 py-0.5 text-[9px] uppercase tracking-wide",
                  STATUS_TONE[row.status],
                )}
              >
                {row.status}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <dt className="text-slate-600">Сейчас</dt>
              <dd className="text-right font-mono tabular-nums text-slate-100">
                {formatPairSpreadValue(row.currentSpread, getPairConfig(row.pairKey))}
              </dd>
              <dt className="text-slate-600">Мин. за период</dt>
              <dd className="text-right font-mono tabular-nums text-slate-400">
                {formatPairSpreadValue(row.minSpread, getPairConfig(row.pairKey))}
              </dd>
              <dt className="text-slate-600">Макс. за период</dt>
              <dd className="text-right font-mono tabular-nums text-slate-400">
                {formatPairSpreadValue(row.maxSpread, getPairConfig(row.pairKey))}
              </dd>
              <dt className="text-slate-600">Отклонение</dt>
              <dd className="text-right font-mono tabular-nums text-cyan-200/90">{fmtZ(row.currentZ)}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
