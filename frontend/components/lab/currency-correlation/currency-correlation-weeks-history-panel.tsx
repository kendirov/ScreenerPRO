"use client";

import type {
  WeekCompareSnapshot,
  WeekCompareStats,
} from "@/lib/domain/currency-correlation-weeks-compare";
import { getPairConfig } from "@/lib/domain/currency-pair-config";
import { formatPairSpreadValue } from "@/lib/domain/currency-pair-divergence";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import { cn } from "@/lib/utils/cn";

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span
        className={cn(
          "font-mono text-[11px] tabular-nums",
          accent ? "text-cyan-200/90" : "text-slate-300",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function CurrencyCorrelationWeeksHistoryPanel({
  pairKey,
  stats,
  snapshot,
  className,
}: {
  pairKey: PointsPairKey;
  stats: WeekCompareStats;
  snapshot: WeekCompareSnapshot | null;
  className?: string;
}) {
  const config = getPairConfig(pairKey);
  const fmt = (v: number | null) =>
    v != null && Number.isFinite(v) ? formatPairSpreadValue(v, config) : "—";

  const useSnapshot = snapshot != null;
  const currentSpread = useSnapshot
    ? fmt(snapshot.currentSpread)
    : stats.formatted.currentSpread;
  const historicalMean = useSnapshot
    ? fmt(snapshot.historicalMean)
    : stats.formatted.historicalMean;
  const deviation =
    useSnapshot && snapshot.deviationFromMean != null
      ? `${snapshot.deviationFromMean >= 0 ? "+" : ""}${formatPairSpreadValue(snapshot.deviationFromMean, config)}`
      : stats.formatted.deviation;

  return (
    <div
      className={cn(
        "rounded-lg border border-cyan-500/10 bg-slate-900/50 px-2.5 py-2 backdrop-blur-sm",
        className,
      )}
    >
      <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-cyan-500/55">
        Неделя против истории
      </p>

      {!stats.hasEnoughHistory ? (
        <p className="mb-2 rounded-md border border-amber-500/15 bg-amber-950/25 px-2 py-1.5 text-[11px] text-amber-200/90">
          мало недель для статистики
        </p>
      ) : null}

      <StatRow label="Текущий спред" value={currentSpread} accent />
      <StatRow label="Среднее прошлых (сейчас)" value={historicalMean} />
      <StatRow label="Отклонение от средней" value={deviation} />
      <StatRow label="Макс. текущей недели" value={stats.formatted.max} />
      <StatRow label="Мин. текущей недели" value={stats.formatted.min} />
      <StatRow label="Вне коридора 25–75%" value={stats.formatted.outsidePct} />

      <p className="mt-2 font-mono text-[9px] text-slate-600">
        {stats.historyWeekCount} прошл. нед. в выборке · MOEX ISS
      </p>
    </div>
  );
}
