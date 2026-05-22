"use client";

import type { TrajectoryReturnStats } from "@/lib/domain/spread-trajectory";
import {
  formatUnitValueShort,
  type SpreadUnitMode,
} from "@/lib/domain/currency-spread-units";
import { cn } from "@/lib/utils/cn";

export function CurrencyCorrelationReturnStats({
  stats,
  unitMode,
  compact,
}: {
  stats: TrajectoryReturnStats;
  unitMode: SpreadUnitMode;
  compact?: boolean;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Всего растяжений", value: String(stats.stretchCount) },
    { label: "Возвратов", value: String(stats.returnCount) },
    { label: "Невозвратов", value: String(stats.breakdownCount) },
    {
      label: "Среднее время до возврата",
      value:
        stats.avgBarsToReturn != null ? `${stats.avgBarsToReturn} св.` : "—",
    },
    {
      label: "Макс. растяжение (|z|)",
      value: stats.maxAbsZ != null ? stats.maxAbsZ.toFixed(2) : "—",
    },
    {
      label: "Средний спред на растяжении",
      value:
        stats.avgSpreadOnStretch != null
          ? formatUnitValueShort(stats.avgSpreadOnStretch, unitMode)
          : "—",
    },
  ];

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-slate-900/45 backdrop-blur-xl",
        compact ? "px-2.5 py-2" : "px-3 py-3",
      )}
    >
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">
        Статистика возвратов
      </p>
      {stats.fewObservations ? (
        <p className="mb-2 text-[11px] text-amber-300/85">Мало наблюдений за период.</p>
      ) : null}
      <dl className="grid gap-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex justify-between gap-2 rounded-md border border-white/[0.03] bg-black/15 px-2 py-1 text-[11px]"
          >
            <dt className="text-slate-500">{r.label}</dt>
            <dd className="font-mono text-slate-200">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
