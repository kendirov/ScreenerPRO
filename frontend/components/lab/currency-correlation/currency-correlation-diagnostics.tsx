"use client";

import { CURRENCY_FAMILY_META, type CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { CurrencyHistoryInstrument, CurrencyHistoryResponse } from "@/lib/domain/currency-correlation-history";
import { cn } from "@/lib/utils/cn";

const FAMILY_ORDER: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];

function statusLabel(inst: CurrencyHistoryInstrument): string {
  const n = inst.pointsCount ?? inst.points.length;
  if (inst.coverageStatus === "excluded" || inst.coverageStatus === "no_overlap") {
    return "не совпадают даты";
  }
  if (inst.status === "error") return "ошибка загрузки";
  if (n === 0 || inst.coverageStatus === "empty") return "нет свечей";
  if (inst.coverageStatus === "sparse" || n < 5) return "мало точек";
  return "история есть";
}

function statusTone(inst: CurrencyHistoryInstrument): string {
  const label = statusLabel(inst);
  if (label === "история есть") return "text-emerald-300/90 border-emerald-500/25 bg-emerald-950/25";
  if (label === "мало точек") return "text-amber-300/90 border-amber-500/25 bg-amber-950/25";
  return "text-slate-500 border-slate-700/40 bg-slate-950/40";
}

function formatRange(inst: CurrencyHistoryInstrument): string {
  if (!inst.firstDate || !inst.lastDate) return "—";
  return `${inst.firstDate} → ${inst.lastDate}`;
}

export function CurrencyCorrelationDiagnostics({ history }: { history: CurrencyHistoryResponse }) {
  const byFamily = Object.fromEntries(history.instruments.map((i) => [i.family, i])) as Record<
    CurrencyCorrelationFamily,
    CurrencyHistoryInstrument | undefined
  >;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/45 px-3 py-3 backdrop-blur-xl">
      <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">Диагностика истории</p>
      <p className="mb-3 text-[10px] text-slate-600">
        Источник: {history.source} · endpoint: {history.endpointUsed} · горизонт {history.days}д
      </p>
      <ul className="space-y-2">
        {FAMILY_ORDER.map((family) => {
          const inst = byFamily[family];
          const meta = CURRENCY_FAMILY_META[family];
          const n = inst?.pointsCount ?? inst?.points.length ?? 0;
          return (
            <li
              key={family}
              className="rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] text-violet-400/70">{family}</span>
                  <span className="ml-2 text-slate-300">{meta.label}</span>
                  <p className="mt-0.5 font-mono text-sm text-white">{inst?.ticker ?? "—"}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-0.5 text-[9px] uppercase tracking-wide",
                    inst ? statusTone(inst) : statusTone({} as CurrencyHistoryInstrument),
                  )}
                >
                  {inst ? statusLabel(inst) : "нет данных"}
                </span>
              </div>
              <p className="mt-1.5 tabular-nums text-slate-500">
                {n > 0 ? (
                  <>
                    {n} {n === 1 ? "точка" : n < 5 ? "точки" : "точек"}, {formatRange(inst!)}
                  </>
                ) : (
                  "0 точек"
                )}
              </p>
              {inst?.selectedContractReason ? (
                <p className="mt-1 text-[10px] leading-snug text-slate-600">{inst.selectedContractReason}</p>
              ) : null}
              {inst?.excludedReason && inst.coverageStatus !== "ok" ? (
                <p className="mt-1 text-[10px] text-amber-400/80">Исключён: {inst.excludedReason}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {history.chartWarnings.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-white/[0.05] pt-3">
          {history.chartWarnings.map((w) => (
            <li key={w} className="text-[11px] text-amber-300/85">
              {w}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
