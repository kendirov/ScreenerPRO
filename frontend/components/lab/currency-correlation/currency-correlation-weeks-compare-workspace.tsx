"use client";

import * as React from "react";
import { CurrencyCorrelationWeeksCompareChart } from "@/components/lab/currency-correlation/currency-correlation-weeks-compare-chart";
import { CurrencyCorrelationWeeksHistoryPanel } from "@/components/lab/currency-correlation/currency-correlation-weeks-history-panel";
import { CurrencyCorrelationWeeksHowToRead } from "@/components/lab/currency-correlation/currency-correlation-weeks-how-to-read";
import { LabErrorState, LabLoadingState } from "@/components/lab/lab-ui";
import {
  buildWeekCompareModel,
  snapshotAtMinute,
} from "@/lib/domain/currency-correlation-weeks-compare";
import {
  ROLLOVER_TODO_NOTE,
  WEEKS_DEFAULT_COUNT,
} from "@/lib/domain/currency-correlation-weeks";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { IntradayIntervalOption } from "@/lib/domain/currency-correlation-intraday";
import type { SpreadAnchorMode } from "@/lib/domain/currency-spread-anchor";
import { useCurrencyCorrelationWeeks } from "@/lib/hooks/use-currency-correlation-weeks";
import { CurrencyCorrelationCollapsibleAside } from "@/components/lab/currency-correlation/currency-correlation-collapsible-aside";
import { cn } from "@/lib/utils/cn";

export function CurrencyCorrelationWeeksCompareWorkspace({
  pair,
  interval,
  anchorMode,
  className,
}: {
  pair: PointsPairKey;
  interval: IntradayIntervalOption;
  anchorMode: SpreadAnchorMode;
  className?: string;
}) {
  const [hoverMinute, setHoverMinute] = React.useState<number | null>(null);

  const query = useCurrencyCorrelationWeeks(
    pair,
    interval,
    WEEKS_DEFAULT_COUNT,
    anchorMode,
    true,
  );

  const compareModel = React.useMemo(
    () => (query.data ? buildWeekCompareModel(query.data.weeks, pair) : null),
    [query.data, pair],
  );

  const snapshot = React.useMemo(() => {
    if (!compareModel || hoverMinute == null) return null;
    return snapshotAtMinute(compareModel, hoverMinute);
  }, [compareModel, hoverMinute]);

  if (query.isLoading) {
    return (
      <div className={className}>
        <LabLoadingState message="Загрузка недель для сравнения (MOEX ISS)…" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={cn("space-y-2", className)}>
        <LabErrorState
          message={
            query.error instanceof Error ? query.error.message : "Ошибка загрузки недель"
          }
        />
        <p className="text-[10px] text-slate-500">
          Переключите режим графика на «Ноги» или «Расхождение», чтобы увидеть текущую связку по
          интрадей MOEX ISS.
        </p>
      </div>
    );
  }

  if (!compareModel) {
    return null;
  }

  const weekCount = query.data?.weeks.length ?? 0;
  const pastWithData = compareModel.pastWeeks.filter((w) => w.points.length >= 5).length;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_min(200px,22%)]">
        <div className="relative min-h-[min(74vh,720px)] overflow-hidden rounded-xl border border-cyan-500/10 bg-[radial-gradient(ellipse_90%_70%_at_50%_40%,rgba(8,51,68,0.18),rgba(2,6,23,0.98))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <p className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-2 text-[10px] uppercase tracking-[0.14em] text-cyan-500/55">
            Сравнение недель · {pair} · {interval}м · {weekCount} нед.
          </p>
          <CurrencyCorrelationWeeksCompareChart
            model={compareModel}
            className="min-h-[min(74vh,720px)] pt-6"
            onCrosshairMinute={setHoverMinute}
          />
        </div>

        <CurrencyCorrelationCollapsibleAside title="Неделя против истории" defaultOpen>
          <CurrencyCorrelationWeeksHistoryPanel
            pairKey={pair}
            stats={compareModel.stats}
            snapshot={snapshot}
          />
          <ul className="mt-2 rounded-lg border border-white/[0.04] bg-black/20 px-2 py-1.5 font-mono text-[10px] text-slate-500">
            {compareModel.diagnostics.slice(0, 6).map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </CurrencyCorrelationCollapsibleAside>
      </div>

      <CurrencyCorrelationWeeksHowToRead />

      <p className="text-[9px] leading-snug text-slate-600">
        {query.data?.weeks[0]?.usedTickers.length
          ? `Контракты: ${query.data.weeks[0]!.usedTickers.join(" · ")}. `
          : ""}
        Прошлых недель с данными: {pastWithData}. Коридоры: p10–p90 (широкий), p25–p75 (узкий), при
        ≥2 прошлых неделях. {query.data?.rolloverTodo ?? ROLLOVER_TODO_NOTE}
      </p>
    </div>
  );
}
