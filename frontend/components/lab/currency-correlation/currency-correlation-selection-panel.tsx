"use client";

import { CURRENCY_FAMILY_META, type CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { CurrencyHistoryResponse } from "@/lib/domain/currency-correlation-history";
import { cn } from "@/lib/utils/cn";

const ORDER: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];

export function CurrencyCorrelationSelectionPanel({ history }: { history: CurrencyHistoryResponse }) {
  const selections = history.contractSelections?.length
    ? history.contractSelections
    : ORDER.map((family) => {
        const inst = history.instruments.find((i) => i.family === family);
        return {
          family,
          label: CURRENCY_FAMILY_META[family].label,
          activeNowTicker: inst?.activeNowTicker ?? inst?.ticker ?? "—",
          chartTicker: inst?.ticker ?? "—",
          pointsCount: inst?.pointsCount ?? inst?.points.length ?? 0,
          selectionReason: inst?.selectedContractReason ?? "—",
          sameAsActiveNow: inst?.sameAsActiveNow ?? true,
          excludedFromChart: inst?.ticker === "—" || inst?.status !== "ok",
        };
      });

  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/45 px-3 py-3 backdrop-blur-xl">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Выбор контрактов</p>
        {history.commonDatesOnChart > 0 ? (
          <span className="font-mono text-[10px] text-violet-400/80">
            {history.commonDatesOnChart} общих дат на графике
          </span>
        ) : null}
      </div>
      <ul className="space-y-2">
        {selections.map((row) => (
          <li
            key={row.family}
            className="rounded-lg border border-white/[0.04] bg-black/25 px-3 py-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-violet-400/75">{row.family}</span>
              <span className="text-slate-400">{row.label}</span>
            </div>
            <p className="mt-1.5 font-mono text-sm text-slate-200">
              {row.activeNowTicker}
              {row.excludedFromChart ? (
                <span className="text-slate-500"> → исключён</span>
              ) : row.sameAsActiveNow ? (
                <span className="text-slate-500"> → {row.chartTicker}</span>
              ) : (
                <span className="text-amber-300/90"> → {row.chartTicker}</span>
              )}
            </p>
            <p className="mt-1 tabular-nums text-slate-500">
              {row.excludedFromChart
                ? "не в графике"
                : `${row.pointsCount} ${row.pointsCount === 1 ? "точка" : row.pointsCount < 5 ? "точки" : "точек"}`}
              {!row.excludedFromChart && row.sameAsActiveNow ? " · активный и в графике" : null}
            </p>
            <p
              className={cn(
                "mt-1 text-[10px] leading-snug",
                row.excludedFromChart ? "text-amber-400/75" : "text-slate-600",
              )}
              title={row.selectionReason}
            >
              {row.selectionReason}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
