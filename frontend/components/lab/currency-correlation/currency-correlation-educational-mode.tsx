"use client";

import * as React from "react";
import {
  buildFamilyBundleStatuses,
  buildPairBundleStatuses,
  CALCULATION_STEPS,
  type BundleReasonCode,
  WHY_CHART_EMPTY,
} from "@/lib/domain/currency-correlation-educational";
import type { CurrencyHistoryResponse } from "@/lib/domain/currency-correlation-history";
import type { CurrencyChartDays } from "@/lib/domain/currency-correlation-chart-model";
import { cn } from "@/lib/utils/cn";

const REASON_TONE: Record<BundleReasonCode, string> = {
  "история есть": "text-emerald-300/90 border-emerald-500/25 bg-emerald-950/20",
  "мало точек": "text-amber-300/90 border-amber-500/25 bg-amber-950/20",
  "нет свечей": "text-slate-500 border-slate-700/40 bg-slate-950/40",
  "разные даты": "text-amber-300/85 border-amber-500/20 bg-amber-950/15",
  "не найден активный контракт": "text-slate-500 border-slate-700/40 bg-slate-950/40",
  "ошибка загрузки": "text-rose-300/85 border-rose-500/25 bg-rose-950/20",
};

function BundleDiagnosticsPanel({
  history,
  className,
}: {
  history: CurrencyHistoryResponse;
  className?: string;
}) {
  const families = buildFamilyBundleStatuses(history);
  const pairs = buildPairBundleStatuses(history);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-slate-950/50 p-4 backdrop-blur-xl",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <p className="mb-3 text-[10px] uppercase tracking-[0.14em] text-slate-600">Диагностика связки</p>

      <div className="mb-4 space-y-2">
        <p className="text-[10px] text-slate-600">Инструменты</p>
        {families.map((row) => (
          <div
            key={row.family}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2 text-xs"
          >
            <div>
              <span className="font-mono text-violet-400/70">{row.family}</span>
              <span className="ml-2 text-slate-400">{row.label}</span>
              <p className="mt-0.5 font-mono text-slate-200">{row.found ? row.ticker : "не найден"}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-md border px-2 py-0.5 text-[9px]",
                row.found ? REASON_TONE[row.reason] : REASON_TONE["не найден активный контракт"],
              )}
            >
              {row.found ? "найден" : "не найден"} · {row.reason}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-white/[0.05] pt-3">
        <p className="text-[10px] text-slate-600">Общие даты</p>
        {pairs.map((pair) => (
          <div
            key={pair.pairKey}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-black/15 px-3 py-2 text-xs"
          >
            <span className="font-mono text-slate-400">{pair.label}</span>
            <span
              className={cn(
                "tabular-nums",
                pair.commonDates >= 2 ? "text-emerald-300/90" : "text-slate-500",
              )}
            >
              {pair.commonDates} {pair.commonDates === 1 ? "дата" : pair.commonDates < 5 ? "даты" : "дат"}
              {pair.commonDates < 2 ? " · мало для графика" : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CurrencyCorrelationEducationalMode({
  history,
  days,
  onDaysChange,
  onRetry,
  onBuildBestPair,
  bestPairLabel,
  showDetailDiagnostics,
  onToggleDiagnostics,
  diagnosticsRef,
}: {
  history: CurrencyHistoryResponse;
  days: CurrencyChartDays;
  onDaysChange: (days: CurrencyChartDays) => void;
  onRetry: () => void;
  onBuildBestPair?: () => void;
  bestPairLabel?: string | null;
  showDetailDiagnostics: boolean;
  onToggleDiagnostics: () => void;
  diagnosticsRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-500/20 bg-violet-950/25 px-3 py-2 text-center">
        <p className="text-[11px] font-medium text-violet-200/90">Учебный режим</p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Рыночный график не построен — ниже только диагностика и схема расчёта
        </p>
      </div>

      <div ref={diagnosticsRef}>
        <BundleDiagnosticsPanel
          history={history}
          className={showDetailDiagnostics ? "ring-1 ring-violet-500/30" : undefined}
        />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 px-4 py-3 backdrop-blur-sm">
        <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">
          Почему график может быть пустым
        </p>
        <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-slate-500">
          {WHY_CHART_EMPTY.map((text, i) => (
            <li key={text}>
              {text}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-dashed border-cyan-500/20 bg-cyan-950/10 px-4 py-3">
        <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-cyan-400/70">
          Как будет считаться, когда данные есть
        </p>
        <p className="mb-3 text-[10px] text-slate-600">Схема расчёта, не рыночные данные.</p>
        <ol className="space-y-2">
          {CALCULATION_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-xs text-slate-400">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-cyan-500/25 bg-cyan-950/30 font-mono text-[10px] text-cyan-300/80">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={onRetry}>Повторить загрузку</ActionButton>
        <ActionButton active={days === 20} onClick={() => onDaysChange(20)}>
          20д
        </ActionButton>
        <ActionButton active={days === 60} onClick={() => onDaysChange(60)}>
          60д
        </ActionButton>
        <ActionButton active={showDetailDiagnostics} onClick={onToggleDiagnostics}>
          Показать диагностику
        </ActionButton>
        {onBuildBestPair && bestPairLabel ? (
          <ActionButton variant="accent" onClick={onBuildBestPair}>
            Построить по доступной паре ({bestPairLabel})
          </ActionButton>
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  active,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  variant?: "default" | "accent";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] transition",
        variant === "accent"
          ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-100 hover:border-emerald-400/50"
          : active
            ? "border-violet-500/40 bg-violet-950/50 text-violet-100"
            : "border-white/[0.08] bg-black/25 text-slate-500 hover:border-white/15 hover:text-slate-300",
      )}
    >
      {children}
    </button>
  );
}
