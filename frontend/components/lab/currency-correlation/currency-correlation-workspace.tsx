"use client";

import * as React from "react";
import { CurrencyCorrelationChart, MODE_LABELS } from "@/components/lab/currency-correlation/currency-correlation-chart";
import { CurrencyCorrelationPointsWorkspace } from "@/components/lab/currency-correlation/currency-correlation-points-workspace";
import { CurrencyCorrelationEducationalMode } from "@/components/lab/currency-correlation/currency-correlation-educational-mode";
import { CurrencyCorrelationMatrix } from "@/components/lab/currency-correlation/currency-correlation-matrix";
import { CurrencyCorrelationModePill } from "@/components/lab/currency-correlation/currency-correlation-state-card";
import { LabErrorState, LabLoadingState, LabSectionHeading } from "@/components/lab/lab-ui";
import { findBestBuildablePair } from "@/lib/domain/currency-correlation-educational";
import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { CurrencyHistoryResponse } from "@/lib/domain/currency-correlation-history";
import type { IntradayCurrencyResponse } from "@/lib/domain/currency-correlation-intraday";
import type { IntradayDayOption, IntradayIntervalOption } from "@/lib/domain/currency-correlation-intraday";
import {
  buildCurrencyChartModel,
  type CurrencyChartDays,
  type CurrencyChartMode,
} from "@/lib/domain/currency-correlation-chart-model";
import { cn } from "@/lib/utils/cn";

const DAY_OPTIONS: CurrencyChartDays[] = [5, 20, 60];
const MODE_OPTIONS: CurrencyChartMode[] = ["normalize", "returns", "divergence", "points"];

const HOW_TO_READ = [
  "Линии от 100 показывают относительное движение, а не цену.",
  "Корреляция считается по изменениям, а не по абсолютному уровню.",
  "Расхождение показывает, кто временно ушёл от общей валютной связки.",
] as const;

export function CurrencyCorrelationWorkspace({
  history,
  isLoading,
  isError,
  errorMessage,
  days,
  onDaysChange,
  onRetry,
  mode,
  onModeChange,
  intraday,
  intradayLoading,
  intradayError,
  intradayErrorMessage,
  intradayInterval,
  onIntradayIntervalChange,
  intradayDays,
  onIntradayDaysChange,
}: {
  history: CurrencyHistoryResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  days: CurrencyChartDays;
  onDaysChange: (days: CurrencyChartDays) => void;
  onRetry: () => void;
  mode: CurrencyChartMode;
  onModeChange: (mode: CurrencyChartMode) => void;
  intraday: IntradayCurrencyResponse | undefined;
  intradayLoading: boolean;
  intradayError: boolean;
  intradayErrorMessage?: string;
  intradayInterval: IntradayIntervalOption;
  onIntradayIntervalChange: (v: IntradayIntervalOption) => void;
  intradayDays: IntradayDayOption;
  onIntradayDaysChange: (v: IntradayDayOption) => void;
}) {
  const [forcedFamilies, setForcedFamilies] = React.useState<CurrencyCorrelationFamily[] | null>(null);
  const [showDetailDiagnostics, setShowDetailDiagnostics] = React.useState(true);
  const diagnosticsRef = React.useRef<HTMLDivElement>(null);

  const effectiveHistory = React.useMemo((): CurrencyHistoryResponse | undefined => {
    if (!history || !forcedFamilies?.length) return history;
    return { ...history, chartInstruments: forcedFamilies };
  }, [history, forcedFamilies]);

  const dailyMode = mode === "points" ? "normalize" : mode;
  const model = React.useMemo(
    () =>
      mode === "points" ? null : buildCurrencyChartModel(effectiveHistory, days, dailyMode),
    [effectiveHistory, days, dailyMode, mode],
  );

  const bestPair = React.useMemo(
    () => (history ? findBestBuildablePair(history) : null),
    [history],
  );

  React.useEffect(() => {
    if (!history) setForcedFamilies(null);
  }, [history?.updatedAt]);

  if (isLoading) {
    return <LabLoadingState message="Загрузка истории MOEX ISS (свечи FORTS)…" />;
  }

  if (isError) {
    return <LabErrorState message={errorMessage ?? "Не удалось загрузить историю."} />;
  }

  if (mode === "points") {
    return (
      <section className="space-y-4">
        <LabSectionHeading>График и связь валют</LabSectionHeading>
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/[0.06] bg-slate-950/55 p-3">
          <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">
            Режим
          </span>
          {MODE_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] transition",
                mode === m
                  ? "border-cyan-500/35 bg-cyan-950/40 text-cyan-100"
                  : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <CurrencyCorrelationPointsWorkspace
          intraday={intraday}
          isLoading={intradayLoading}
          isError={intradayError}
          errorMessage={intradayErrorMessage}
          interval={intradayInterval}
          onIntervalChange={onIntradayIntervalChange}
          days={intradayDays}
          onDaysChange={onIntradayDaysChange}
        />
      </section>
    );
  }

  if (!history || !model) {
    return <LabErrorState message="История не загружена." />;
  }

  const showChart = model.canRenderChart && model.series.length >= 2;
  const canForcePair = !showChart && bestPair != null;

  const handleToggleDiagnostics = () => {
    setShowDetailDiagnostics((v) => !v);
    requestAnimationFrame(() => {
      diagnosticsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const handleBuildBestPair = () => {
    if (!bestPair) return;
    setForcedFamilies([...bestPair.families]);
    if (days < 20) onDaysChange(20);
  };

  return (
    <section className="space-y-4">
      <LabSectionHeading>График и связь валют</LabSectionHeading>

      <CurrencyCorrelationModePill model={model} />

      {showChart ? (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-slate-950/55 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">Период</span>
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDaysChange(d)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] transition",
                    days === d
                      ? "border-violet-500/40 bg-violet-950/50 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                      : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
                  )}
                >
                  {d}д
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="mr-1 self-center text-[10px] uppercase tracking-[0.12em] text-slate-600">Режим</span>
              {MODE_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModeChange(m)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] transition",
                    mode === m
                      ? "border-cyan-500/35 bg-cyan-950/40 text-cyan-100"
                      : "border-white/[0.06] bg-black/20 text-slate-500 hover:border-white/10 hover:text-slate-300",
                  )}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.05] bg-[radial-gradient(ellipse_90%_70%_at_50%_40%,rgba(30,41,59,0.35),rgba(2,6,23,0.98))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_64px_rgba(0,0,0,0.45)]">
              <CurrencyCorrelationChart model={model} />
            </div>

            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-slate-900/50 px-3 py-3 backdrop-blur-xl">
                <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">Сейчас</p>
                <p className="text-xs leading-relaxed text-slate-300">{model.nowSummary}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-slate-900/50 px-3 py-3 backdrop-blur-xl">
                <CurrencyCorrelationMatrix model={model} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.05] bg-slate-900/35 px-4 py-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">Как читать</p>
            <ul className="grid gap-2 sm:grid-cols-3">
              {HOW_TO_READ.map((text, i) => (
                <li key={text} className="flex gap-2 text-xs leading-relaxed text-slate-500">
                  <span className="font-mono text-violet-400/70">{i + 1}.</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <CurrencyCorrelationEducationalMode
            history={history}
            days={days}
            onDaysChange={onDaysChange}
            onRetry={onRetry}
            onBuildBestPair={canForcePair ? handleBuildBestPair : undefined}
            bestPairLabel={bestPair?.label ?? null}
            showDetailDiagnostics={showDetailDiagnostics}
            onToggleDiagnostics={handleToggleDiagnostics}
            diagnosticsRef={diagnosticsRef}
          />
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-slate-900/50 px-3 py-3 backdrop-blur-xl">
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-600">Сейчас</p>
              <p className="text-xs leading-relaxed text-slate-300">{model.nowSummary}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-slate-900/50 px-3 py-3 backdrop-blur-xl">
              <CurrencyCorrelationMatrix model={model} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
