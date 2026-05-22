"use client";

import * as React from "react";
import { CurrencyCorrelationChart } from "@/components/lab/currency-correlation/currency-correlation-chart";
import { CurrencyCorrelationDataStatus } from "@/components/lab/currency-correlation/currency-correlation-data-status";
import { CurrencyCorrelationEducationalMode } from "@/components/lab/currency-correlation/currency-correlation-educational-mode";
import { CurrencyCorrelationMatrix } from "@/components/lab/currency-correlation/currency-correlation-matrix";
import { CurrencyCorrelationPointsChart } from "@/components/lab/currency-correlation/currency-correlation-points-chart";
import { CurrencyCorrelationPairStatePanel } from "@/components/lab/currency-correlation/currency-correlation-pair-state-panel";
import { CurrencyCorrelationPathMap } from "@/components/lab/currency-correlation/currency-correlation-path-map";
import { CurrencyCorrelationReturnStats } from "@/components/lab/currency-correlation/currency-correlation-return-stats";
import { CurrencyCorrelationDivergenceJournal } from "@/components/lab/currency-correlation/currency-correlation-divergence-journal";
import { CurrencyCorrelationDivergenceMap } from "@/components/lab/currency-correlation/currency-correlation-divergence-map";
import { CurrencyCorrelationSpreadTimeline } from "@/components/lab/currency-correlation/currency-correlation-spread-timeline";
import { CurrencyCorrelationSpreadsPanel } from "@/components/lab/currency-correlation/currency-correlation-spreads-panel";
import { LabErrorState, LabLoadingState } from "@/components/lab/lab-ui";
import { buildSpecsByFamily, type SpreadUnitMode } from "@/lib/domain/currency-spread-units";
import type { SpreadPairLifecycleCurrent } from "@/lib/domain/spread-lifecycle";
import type { SpreadLifecycleSensitivity } from "@/lib/domain/spread-lifecycle";
import { useTechnicalCharacteristicsQuery } from "@/lib/hooks/use-technical-characteristics-query";
import { findBestBuildablePair } from "@/lib/domain/currency-correlation-educational";
import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { CurrencyHistoryResponse } from "@/lib/domain/currency-correlation-history";
import {
  buildCurrencyChartModel,
  DAILY_CHART_MODES,
  INTRADAY_CHART_MODES,
  type CurrencyChartMode,
} from "@/lib/domain/currency-correlation-chart-model";
import type { IntradayCurrencyResponse } from "@/lib/domain/currency-correlation-intraday";
import {
  buildCurrencyPointsModel,
  buildSpreadChartModel,
  buildTrajectoryChartModel,
  type PointsPairKey,
} from "@/lib/domain/currency-correlation-points-model";
import { buildSpreadScannerModel } from "@/lib/domain/currency-correlation-spread-scanner";
import { buildDivergenceMapModel } from "@/lib/domain/currency-correlation-divergence-map";
import type { CurrencyDataMode } from "@/components/lab/currency-correlation/currency-correlation-data-mode";
import type { LabDayPeriod } from "@/components/lab/currency-correlation/currency-correlation-lab-controls";
import type { SpreadAnchorMode } from "@/lib/domain/currency-spread-anchor";
import {
  CurrencyCorrelationWeeksPanel,
  type WeekPanelMode,
} from "@/components/lab/currency-correlation/currency-correlation-weeks-panel";
import { CurrencyCorrelationWeeksCompareWorkspace } from "@/components/lab/currency-correlation/currency-correlation-weeks-compare-workspace";
import type { IntradayIntervalOption } from "@/lib/domain/currency-correlation-intraday";
import { WEEKS_DEFAULT_COUNT } from "@/lib/domain/currency-correlation-weeks";
import { useCurrencyCorrelationWeeks } from "@/lib/hooks/use-currency-correlation-weeks";
import { buildLifecycleJournal } from "@/lib/domain/spread-trajectory";
import { CurrencyCorrelationHowToRead } from "@/components/lab/currency-correlation/currency-correlation-how-to-read";
import { buildIntradayLabDiagnostics } from "@/lib/domain/currency-correlation-intraday";

function isIntradayChartMode(mode: CurrencyChartMode): boolean {
  return INTRADAY_CHART_MODES.includes(mode);
}

export function CurrencyCorrelationLabBody({
  source,
  chartMode,
  selectedPair,
  onSelectedPairChange,
  sensitivity,
  unitMode,
  anchorMode,
  manualAnchorTime,
  onManualAnchorTimeChange,
  history,
  historyLoading,
  historyError,
  historyErrorMessage,
  onHistoryRetry,
  dayPeriod,
  onDayPeriodChange,
  intraday,
  intradayLoading,
  intradayError,
  intradayErrorMessage,
  intradayInterval,
}: {
  source: CurrencyDataMode;
  chartMode: CurrencyChartMode;
  selectedPair: PointsPairKey;
  onSelectedPairChange: (p: PointsPairKey) => void;
  sensitivity: SpreadLifecycleSensitivity;
  unitMode: SpreadUnitMode;
  anchorMode: SpreadAnchorMode;
  manualAnchorTime: string | null;
  onManualAnchorTimeChange: (iso: string | null) => void;
  history: CurrencyHistoryResponse | undefined;
  historyLoading: boolean;
  historyError: boolean;
  historyErrorMessage?: string;
  onHistoryRetry: () => void;
  dayPeriod: LabDayPeriod;
  onDayPeriodChange: (d: LabDayPeriod) => void;
  intraday: IntradayCurrencyResponse | undefined;
  intradayLoading: boolean;
  intradayError: boolean;
  intradayErrorMessage?: string;
  intradayInterval: IntradayIntervalOption;
}) {
  const [forcedFamilies, setForcedFamilies] = React.useState<CurrencyCorrelationFamily[] | null>(
    null,
  );
  const [weekPanelMode, setWeekPanelMode] = React.useState<WeekPanelMode>("off");
  const [selectedWeekOffset, setSelectedWeekOffset] = React.useState(0);

  React.useEffect(() => {
    if (chartMode === "weeks" && weekPanelMode !== "off") {
      setWeekPanelMode("off");
    }
  }, [chartMode, weekPanelMode]);

  const techQuery = useTechnicalCharacteristicsQuery("future", "all");

  const useIntraday = source === "intraday" || isIntradayChartMode(chartMode);
  const isLoading = useIntraday ? intradayLoading : historyLoading;
  const isError = useIntraday ? intradayError : historyError;
  const errorMessage = useIntraday ? intradayErrorMessage : historyErrorMessage;

  const effectiveHistory = React.useMemo((): CurrencyHistoryResponse | undefined => {
    if (!history || !forcedFamilies?.length) return history;
    return { ...history, chartInstruments: forcedFamilies };
  }, [history, forcedFamilies]);

  const dailyMode = DAILY_CHART_MODES.includes(chartMode) ? chartMode : "normalize";
  const dailyModel = React.useMemo(
    () =>
      !useIntraday && effectiveHistory
        ? buildCurrencyChartModel(effectiveHistory, dayPeriod, dailyMode)
        : null,
    [useIntraday, effectiveHistory, dayPeriod, dailyMode],
  );

  const tickersByFamily = React.useMemo(() => {
    if (!intraday) return {};
    return Object.fromEntries(intraday.instruments.map((i) => [i.family, i.ticker])) as Partial<
      Record<CurrencyCorrelationFamily, string>
    >;
  }, [intraday]);

  const specsByFamily = React.useMemo(
    () => buildSpecsByFamily(tickersByFamily, techQuery.data?.rows ?? []),
    [tickersByFamily, techQuery.data?.rows],
  );

  const needsWeeklyContext =
    useIntraday &&
    chartMode !== "weeks" &&
    (chartMode === "spread" || chartMode === "trajectory" || chartMode === "points");

  const weeksQuery = useCurrencyCorrelationWeeks(
    selectedPair,
    (intraday?.usedInterval ?? intradayInterval) as IntradayIntervalOption,
    WEEKS_DEFAULT_COUNT,
    anchorMode,
    needsWeeklyContext,
  );

  const pointsOptions = React.useMemo(
    () => ({
      unitMode,
      specsByFamily,
      lifecycleSensitivity: sensitivity,
      lifecycleFocusPair: selectedPair,
      anchorMode,
      manualAnchorTime,
      weeklyWeeksByPair: weeksQuery.data?.weeks
        ? { [selectedPair]: weeksQuery.data.weeks }
        : undefined,
    }),
    [
      unitMode,
      specsByFamily,
      sensitivity,
      selectedPair,
      anchorMode,
      manualAnchorTime,
      weeksQuery.data?.weeks,
    ],
  );

  const pointsModel = React.useMemo(
    () =>
      chartMode === "points"
        ? buildCurrencyPointsModel(intraday, selectedPair, 1, pointsOptions)
        : null,
    [chartMode, intraday, pointsOptions, selectedPair],
  );

  const spreadChartModel = React.useMemo(
    () =>
      chartMode === "spread"
        ? buildSpreadChartModel(intraday, selectedPair, 1, pointsOptions)
        : null,
    [chartMode, intraday, pointsOptions, selectedPair],
  );

  const trajectoryModel = React.useMemo(
    () =>
      chartMode === "trajectory"
        ? buildTrajectoryChartModel(intraday, selectedPair, 1, pointsOptions)
        : null,
    [chartMode, intraday, pointsOptions, selectedPair],
  );

  const intradayModel =
    chartMode === "points"
      ? pointsModel
      : chartMode === "trajectory"
        ? trajectoryModel
        : spreadChartModel;

  const effectiveUnitMode = intradayModel?.effectiveUnitMode ?? unitMode;
  const unitWarning = intradayModel?.unitWarning ?? null;

  const scannerModel = React.useMemo(
    () =>
      intraday
        ? buildSpreadScannerModel(intraday, sensitivity, 1, {
            unitMode: effectiveUnitMode,
            specsByFamily,
            anchorMode,
            manualAnchorTime,
          })
        : null,
    [intraday, sensitivity, effectiveUnitMode, specsByFamily, anchorMode, manualAnchorTime],
  );

  const divergenceMapModel = React.useMemo(
    () =>
      intraday
        ? buildDivergenceMapModel(intraday, sensitivity, 1, {
            unitMode,
            specsByFamily,
            anchorMode,
            manualAnchorTime,
          })
        : null,
    [intraday, sensitivity, unitMode, specsByFamily, anchorMode, manualAnchorTime],
  );

  const lifecycleCurrentByPair = React.useMemo(() => {
    const map: Partial<Record<PointsPairKey, SpreadPairLifecycleCurrent>> = {};
    const chartSource =
      chartMode === "trajectory"
        ? trajectoryModel?.lifecycleByPair
        : spreadChartModel?.lifecycleByPair;
    if (divergenceMapModel?.currentByPair) {
      for (const [key, cur] of Object.entries(divergenceMapModel.currentByPair)) {
        if (cur) map[key as PointsPairKey] = cur;
      }
    }
    if (chartSource) {
      for (const [key, model] of Object.entries(chartSource)) {
        if (model) map[key as PointsPairKey] = model.current;
      }
    }
    return map;
  }, [
    chartMode,
    divergenceMapModel?.currentByPair,
    spreadChartModel?.lifecycleByPair,
    trajectoryModel?.lifecycleByPair,
  ]);

  const bestPair = React.useMemo(
    () => (history ? findBestBuildablePair(history) : null),
    [history],
  );

  const lifecycleJournalRows = React.useMemo(() => {
    const lifecycle =
      chartMode === "trajectory"
        ? trajectoryModel?.lifecycleByPair?.[selectedPair]
        : spreadChartModel?.lifecycleByPair?.[selectedPair];
    if (!lifecycle) return [];
    return buildLifecycleJournal(
      lifecycle,
      (intraday?.usedInterval ?? intradayInterval) as number,
    );
  }, [
    chartMode,
    trajectoryModel?.lifecycleByPair,
    spreadChartModel?.lifecycleByPair,
    selectedPair,
    intraday?.usedInterval,
    intradayInterval,
  ]);

  if (isLoading) {
    return (
      <LabLoadingState
        message={
          useIntraday
            ? "Загрузка интрадей-свечей MOEX ISS…"
            : "Загрузка дневной истории MOEX ISS…"
        }
      />
    );
  }

  if (isError) {
    return (
      <LabErrorState message={errorMessage ?? "Не удалось загрузить данные."} />
    );
  }

  const showIntradayChart =
    useIntraday &&
    intradayModel?.canRenderChart &&
    (intradayModel.chartKind === "trajectory"
      ? Boolean(intradayModel.trajectory)
      : intradayModel.chartKind === "spread"
        ? intradayModel.series.length >= 1
        : intradayModel.series.length >= 2);
  const showDailyChart =
    !useIntraday && dailyModel?.canRenderChart && dailyModel.series.length >= 2;

  const chartTitle = intradayModel?.focusPairChartTitle;

  const trajectoryBundle = trajectoryModel?.trajectory ?? null;

  const showPairStatePanel =
    chartMode === "spread" ||
    chartMode === "trajectory" ||
    Boolean(divergenceMapModel?.hasData);

  const intradayDiag = intraday ? buildIntradayLabDiagnostics(intraday) : null;
  const lowStatsWarning =
    showIntradayChart &&
    (intradayDiag?.status === "мало точек" ||
      lifecycleCurrentByPair[selectedPair]?.weeklyContextSummary ===
        "мало недель для статистики");

  if (useIntraday) {
    return (
      <div className="space-y-2">
        <CurrencyCorrelationDataStatus
          intraday={intraday}
          intradayModel={intradayModel}
          divergenceMapModel={divergenceMapModel}
        />

        {unitWarning ? (
          <p className="rounded-md border border-amber-500/20 bg-amber-950/20 px-2.5 py-1.5 text-[10px] text-amber-200/90">
            {unitWarning}
          </p>
        ) : null}

        {needsWeeklyContext && weeksQuery.isError ? (
          <p className="rounded-md border border-amber-500/20 bg-amber-950/15 px-2 py-1 text-[10px] leading-snug text-amber-200/90">
            Прошлые недели не загрузились
            {weeksQuery.error instanceof Error ? `: ${weeksQuery.error.message}` : ""}. Недельный
            контекст недоступен — график текущей связки по интрадей MOEX ISS сохранён.
          </p>
        ) : null}

        {lowStatsWarning ? (
          <p className="rounded-md border border-white/[0.06] bg-slate-900/40 px-2 py-1 text-[10px] text-slate-400">
            Мало точек для статистики, но график текущей связки построен.
          </p>
        ) : null}

        <CurrencyCorrelationDivergenceMap
          model={divergenceMapModel}
          selectedPair={selectedPair}
          onSelectPair={onSelectedPairChange}
          unitMode={effectiveUnitMode}
        />

        {chartMode === "weeks" ? (
          <CurrencyCorrelationWeeksCompareWorkspace
            pair={selectedPair}
            interval={(intraday?.usedInterval ?? intradayInterval) as IntradayIntervalOption}
            anchorMode={anchorMode}
          />
        ) : null}

        {chartMode !== "weeks" && showIntradayChart ? (
          <div className="relative min-h-[min(74vh,720px)] overflow-hidden rounded-xl border border-cyan-500/10 bg-[radial-gradient(ellipse_90%_70%_at_50%_40%,rgba(8,51,68,0.18),rgba(2,6,23,0.98))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              {chartTitle ? (
                <p className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-2 text-[10px] uppercase tracking-[0.14em] text-cyan-500/55">
                  {chartTitle}
                </p>
              ) : null}
              <CurrencyCorrelationPointsChart
                model={intradayModel!}
                className="min-h-[min(74vh,720px)]"
                lifecycleFocusPair={selectedPair}
                anchorMode={anchorMode}
                onAnchorTimeSelect={onManualAnchorTimeChange}
              />
          </div>
        ) : chartMode !== "weeks" ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
            {intradayModel?.diagnosticMessage ??
              "Недостаточно общих интрадей-свечей для графика."}
          </div>
        ) : null}

        {chartMode !== "weeks" && showIntradayChart && chartMode === "trajectory" && trajectoryBundle ? (
          <div className="grid gap-2 lg:grid-cols-2">
            <CurrencyCorrelationPathMap
              steps={trajectoryBundle.pathSteps}
              summary={trajectoryBundle.pathSummary}
              unitMode={effectiveUnitMode}
              compact
            />
            <CurrencyCorrelationReturnStats
              stats={trajectoryBundle.returnStats}
              unitMode={effectiveUnitMode}
              compact
            />
          </div>
        ) : null}

        {chartMode !== "weeks" && showIntradayChart ? (
          showPairStatePanel ? (
            <CurrencyCorrelationPairStatePanel
              pairs={lifecycleCurrentByPair}
              selectedPair={selectedPair}
              onSelectedPairChange={onSelectedPairChange}
              unitMode={effectiveUnitMode}
              compact
            />
          ) : chartMode === "points" ? (
            <CurrencyCorrelationSpreadsPanel
              spreads={intradayModel!.spreads}
              compact
              unitMode={effectiveUnitMode}
            />
          ) : null
        ) : null}

        {chartMode !== "weeks" && showIntradayChart ? (
          lifecycleJournalRows.length > 0 ? (
            <CurrencyCorrelationDivergenceJournal
              rows={lifecycleJournalRows}
              unitMode={effectiveUnitMode}
              compact
            />
          ) : chartMode === "trajectory" && trajectoryBundle ? (
            <CurrencyCorrelationDivergenceJournal
              rows={trajectoryBundle.journal}
              unitMode={effectiveUnitMode}
              compact
            />
          ) : (
            <CurrencyCorrelationSpreadTimeline
              events={scannerModel?.recentEvents ?? []}
              zThreshold={scannerModel?.zThreshold ?? 1.5}
              compact
              unitMode={effectiveUnitMode}
            />
          )
        ) : null}

        <details className="rounded-lg border border-white/[0.05] bg-slate-950/30 px-2 py-1">
          <summary className="cursor-pointer select-none py-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">
            История недель (дополнительно)
          </summary>
          <div className="pb-2 pt-1">
            <CurrencyCorrelationWeeksPanel
              pair={selectedPair}
              interval={(intraday?.usedInterval ?? intradayInterval) as IntradayIntervalOption}
              anchorMode={anchorMode}
              panelMode={weekPanelMode}
              onPanelModeChange={setWeekPanelMode}
              selectedWeekOffset={selectedWeekOffset}
              onSelectedWeekOffsetChange={setSelectedWeekOffset}
            />
          </div>
        </details>

        <CurrencyCorrelationHowToRead />
      </div>
    );
  }

  return (
    <section className="space-y-2">
      {showDailyChart ? (
        <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_min(220px,24%)]">
          <div className="relative min-h-[min(68vh,640px)] overflow-hidden rounded-xl border border-white/[0.05] bg-[radial-gradient(ellipse_90%_70%_at_50%_40%,rgba(30,41,59,0.28),rgba(2,6,23,0.98))] p-1">
            <CurrencyCorrelationChart model={dailyModel!} className="min-h-[min(68vh,640px)]" />
          </div>
          <aside className="flex flex-col gap-2">
            <div className="rounded-lg border border-white/[0.06] bg-slate-900/45 px-2.5 py-2">
              <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-600">Сейчас</p>
              <p className="text-[11px] leading-relaxed text-slate-400">{dailyModel!.nowSummary}</p>
              <p className="mt-1 font-mono text-[9px] text-slate-600">данные MOEX ISS · дневные бары</p>
            </div>
            <CurrencyCorrelationMatrix model={dailyModel!} compact />
          </aside>
        </div>
      ) : history ? (
        <CurrencyCorrelationEducationalMode
          history={history}
          days={dayPeriod}
          onDaysChange={onDayPeriodChange}
          onRetry={onHistoryRetry}
          onBuildBestPair={
            bestPair
              ? () => {
                  setForcedFamilies([...bestPair.families]);
                  if (dayPeriod < 20) onDayPeriodChange(20);
                }
              : undefined
          }
          bestPairLabel={bestPair?.label ?? null}
          showDetailDiagnostics
          onToggleDiagnostics={() => {}}
        />
      ) : null}
      <CurrencyCorrelationHowToRead />
    </section>
  );
}
