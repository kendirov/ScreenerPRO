"use client";

import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { CurrencyHistoryResponse } from "@/lib/domain/currency-correlation-history";
import {
  alignSeriesByDate,
  buildCorrelationDiagnostics,
  type CurrencyCorrelationDiagnostics,
} from "@/lib/domain/currency-correlation-series";
import { cn } from "@/lib/utils/cn";

const FAMILY_ORDER: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];

function formatCorr(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function CorrRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono tabular-nums text-slate-200">{formatCorr(value)}</span>
    </div>
  );
}

export function CurrencyCorrelationHistoryPanel({
  history,
  isLoading,
  isError,
  errorMessage,
}: {
  history: CurrencyHistoryResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
}) {
  const diagnostics: CurrencyCorrelationDiagnostics | null = history
    ? buildCorrelationDiagnostics(
        alignSeriesByDate(
          history.instruments
            .filter((i) => i.status === "ok" && i.points.length > 0)
            .map((i) => ({ key: i.family, points: i.points })),
        ),
        Object.fromEntries(history.instruments.map((i) => [i.family, i.family])),
        history.instruments.map((i) => ({
          family: i.family,
          ticker: i.ticker,
          status: i.status,
          pointCount: i.points.length,
        })),
      )
    : null;

  if (isLoading) {
    return (
      <section className="rounded-xl border border-white/[0.06] bg-slate-900/40 px-4 py-4">
        <p className="text-sm text-slate-500">Загрузка истории MOEX ISS…</p>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-4">
        <p className="text-sm text-rose-300/90">
          {errorMessage ?? "Не удалось загрузить историю. Повторите позже."}
        </p>
      </section>
    );
  }

  if (!history || !diagnostics) return null;

  const partialEmpty =
    diagnostics.emptyFamilies.length > 0 || diagnostics.errorTickers.length > 0;
  const allEmpty = !diagnostics.hasHistory;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-slate-900/45 px-4 py-4 backdrop-blur-xl">
      <h2 className="text-sm font-semibold text-slate-200">История и расчёты</h2>

      {allEmpty ? (
        <p className="mt-2 text-sm text-amber-200/85">
          История недоступна для части контрактов. Проверьте тикеры и доступность MOEX ISS.
        </p>
      ) : partialEmpty ? (
        <p className="mt-2 text-sm text-amber-200/80">
          История недоступна для части контрактов
          {diagnostics.emptyFamilies.length
            ? `: ${diagnostics.emptyFamilies.join(", ")}`
            : ""}
          {diagnostics.errorTickers.length ? ` (ошибка: ${diagnostics.errorTickers.join(", ")})` : ""}
          .
        </p>
      ) : (
        <p className="mt-2 text-sm text-emerald-300/85">
          История загружена: {diagnostics.commonDates} общих точек · источник {history.source}
        </p>
      )}

      <p className="mt-1 text-[11px] text-slate-500">
        Расчёт: нормализация от 100, корреляция по дневным изменениям (returns)
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5">
          <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-slate-600">Точек по ряду</p>
          <ul className="space-y-1.5">
            {FAMILY_ORDER.map((family) => {
              const inst = history.instruments.find((i) => i.family === family);
              const n = inst?.status === "ok" ? inst.points.length : 0;
              return (
                <li key={family} className="flex justify-between text-[11px]">
                  <span className="text-slate-400">
                    {family}
                    {inst?.ticker && inst.ticker !== "—" ? ` (${inst.ticker})` : ""}
                  </span>
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      inst?.status === "ok" ? "text-slate-200" : "text-slate-600",
                    )}
                  >
                    {inst?.status === "ok" ? n : inst?.status === "error" ? "ошибка" : "нет данных"}
                  </span>
                </li>
              );
            })}
            <li className="flex justify-between border-t border-white/[0.05] pt-1.5 text-[11px]">
              <span className="text-slate-500">Общих дат</span>
              <span className="font-mono tabular-nums text-violet-200/90">{diagnostics.commonDates}</span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2.5">
          <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-slate-600">Корреляция returns</p>
          <div className="space-y-1.5">
            <CorrRow label="SI / CNY" value={diagnostics.correlations["SI/CNY"]} />
            <CorrRow label="SI / ED" value={diagnostics.correlations["SI/ED"]} />
            <CorrRow label="CNY / ED" value={diagnostics.correlations["CNY/ED"]} />
          </div>
        </div>
      </div>

      {history.instruments.some((i) => i.status === "error" && i.error) ? (
        <p className="mt-3 text-[10px] text-slate-600">
          {history.instruments
            .filter((i) => i.error)
            .map((i) => `${i.ticker}: ${i.error}`)
            .join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
