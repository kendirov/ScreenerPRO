"use client";

import * as React from "react";
import { LabLoadingState } from "@/components/lab/lab-ui";
import {
  buildIntradayLabDiagnostics,
  type IntradayCurrencyResponse,
  type IntradayDiagnosticsStatus,
} from "@/lib/domain/currency-correlation-intraday";
import { cn } from "@/lib/utils/cn";

const STATUS_TONE: Record<IntradayDiagnosticsStatus, string> = {
  готово: "border-emerald-500/30 bg-emerald-950/25 text-emerald-200",
  "мало точек": "border-amber-500/30 bg-amber-950/25 text-amber-200",
  "нет интрадей-свечей": "border-slate-600/40 bg-slate-950/50 text-slate-400",
};

function formatIntervalMinutes(n: number): string {
  if (n === 24) return "день (24)";
  if (n === 60) return "60м";
  return `${n}м`;
}

export function CurrencyCorrelationIntradayDiagnostics({
  data,
  isLoading,
}: {
  data: IntradayCurrencyResponse | undefined;
  isLoading: boolean;
}) {
  const diagnostics = React.useMemo(
    () => (data ? buildIntradayLabDiagnostics(data) : null),
    [data],
  );

  if (isLoading) {
    return <LabLoadingState message="Загрузка интрадей-свечей MOEX ISS (FORTS candles)…" />;
  }

  if (!data || !diagnostics) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-white/[0.08] bg-slate-950/40 px-6 py-10 text-center">
        <p className="text-sm text-slate-400">Следующий шаг: график спреда в пунктах.</p>
        <p className="mt-2 text-xs text-slate-600">
          Данные загружены; визуализация квадрохеджа появится в следующей итерации.
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-slate-950/50 p-4 backdrop-blur-xl">
        <p className="mb-3 text-[10px] uppercase tracking-[0.14em] text-slate-600">Интрадей-данные</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-wide",
              STATUS_TONE[diagnostics.status],
            )}
          >
            {diagnostics.status}
          </span>
          {data.intervalNotice ? (
            <span className="text-xs text-amber-300/90">{data.intervalNotice}</span>
          ) : null}
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DiagRow label="Интервал запрошен" value={formatIntervalMinutes(diagnostics.requestedInterval)} />
          <DiagRow label="Интервал использован" value={formatIntervalMinutes(diagnostics.usedInterval)} />
          <DiagRow label="Общих timestamp" value={String(diagnostics.commonTimestamps)} highlight />
          <DiagRow label="Точек SI" value={`${diagnostics.pointsSi} · ${diagnostics.tickers.SI}`} />
          <DiagRow label="Точек CNY" value={`${diagnostics.pointsCny} · ${diagnostics.tickers.CNY}`} />
          <DiagRow label="Точек ED" value={`${diagnostics.pointsEd} · ${diagnostics.tickers.ED}`} />
          <DiagRow
            label="События спреда (|z|≥1.5)"
            value={String(diagnostics.spreadEventsCount)}
            className="sm:col-span-2 lg:col-span-3"
          />
        </dl>

        {data.instruments.some((i) => i.status === "error") ? (
          <ul className="mt-4 space-y-1 border-t border-white/[0.05] pt-3 text-xs text-rose-300/85">
            {data.instruments
              .filter((i) => i.status === "error")
              .map((i) => (
                <li key={i.family}>
                  {i.family}: {i.error ?? "ошибка загрузки"}
                </li>
              ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function DiagRow({
  label,
  value,
  highlight,
  className,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2", className)}>
      <dt className="text-[10px] text-slate-600">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 font-mono text-sm tabular-nums",
          highlight ? "text-emerald-300/90" : "text-slate-200",
        )}
      >
        {value}
      </dd>
    </div>
  );
}


