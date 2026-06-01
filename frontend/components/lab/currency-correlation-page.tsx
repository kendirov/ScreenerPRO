"use client";

import Link from "next/link";
import * as React from "react";
import type { CurrencyDataMode } from "@/components/lab/currency-correlation/currency-correlation-data-mode";
import { CurrencyCorrelationLabBody } from "@/components/lab/currency-correlation/currency-correlation-lab-body";
import {
  CurrencyCorrelationLabControls,
  type LabDayPeriod,
} from "@/components/lab/currency-correlation/currency-correlation-lab-controls";
import { QuadHedgeCommandBar } from "@/components/lab/currency-correlation/quad-hedge-command-bar";
import {
  QuadHedgeActiveContracts,
} from "@/components/lab/currency-correlation/quad-hedge-active-contracts";
import {
  QuadHedgeDataDiagnostics,
  isSpreadLabHistoryLimited,
  quadHedgePipelineMessage,
  SPREAD_LAB_HISTORY_LIMITED_MESSAGE,
} from "@/components/lab/currency-correlation/quad-hedge-data-diagnostics";
import {
  QuadHedgeSpreadLabControls,
} from "@/components/lab/currency-correlation/quad-hedge-controls";
import {
  formatSpreadLabEmptyState,
  QuadHedgeSpreadLabHeader,
} from "@/components/lab/currency-correlation/quad-hedge-spread-lab-header";
import { SpreadLabChart } from "@/components/lab/currency-correlation/spread-lab-chart";
import { QuadHedgeMainChart } from "@/components/lab/currency-correlation/quad-hedge-main-chart";
import { QuadHedgeSpreadStrip } from "@/components/lab/currency-correlation/quad-hedge-spread-strip";
import { QuadHedgeTables, useQuadHedgeTablesModel } from "@/components/lab/currency-correlation/quad-hedge-tables";
import { LabPageShell } from "@/components/lab/lab-page-shell";
import { buildLabSourcePills, LabErrorState, LabLoadingState } from "@/components/lab/lab-ui";
import {
  buildCurrencyCorrelationSnapshot,
  type CurrencyCorrelationCard,
  type CurrencyCorrelationFamily,
} from "@/lib/domain/currency-correlation";
import type { CurrencyContractSelection } from "@/lib/domain/currency-correlation-history";
import {
  DAILY_CHART_MODES,
  INTRADAY_CHART_MODES,
  type CurrencyChartMode,
} from "@/lib/domain/currency-correlation-chart-model";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import {
  DEFAULT_INTRADAY_DAYS,
  DEFAULT_INTRADAY_INTERVAL,
  type IntradayDayOption,
  type IntradayIntervalOption,
} from "@/lib/domain/currency-correlation-intraday";
import type { SpreadLifecycleSensitivity } from "@/lib/domain/spread-lifecycle";
import {
  DEFAULT_SPREAD_ANCHOR_MODE,
  type SpreadAnchorMode,
} from "@/lib/domain/currency-spread-anchor";
import type { SpreadUnitMode } from "@/lib/domain/currency-spread-units";
import { buildQuadHedgeMainChartModel } from "@/lib/domain/quad-hedge";
import { buildSpreadLabChartModel } from "@/lib/domain/quad-hedge/spread-lab-chart-model";
import {
  SPREAD_LAB_DEFAULT_HISTORY_DEPTH,
  SPREAD_LAB_DEFAULT_PAIR,
  SPREAD_LAB_DEFAULT_UNIT,
  spreadLabFetchParams,
  type SpreadLabHistoryDepth,
} from "@/lib/domain/quad-hedge/spread-lab-config";
import type { QuadHedgeSpreadUnitMode, QuadHedgeViewMode } from "@/lib/domain/quad-hedge/types";
import { useCurrencyCorrelationHistory } from "@/lib/hooks/use-currency-correlation-history";
import { useCurrencyCorrelationIntraday } from "@/lib/hooks/use-currency-correlation-intraday";
import { useQuadHedgeAnalytics } from "@/lib/hooks/use-quad-hedge-analytics";
import { useQuadHedgeIntraday } from "@/lib/hooks/use-quad-hedge-intraday";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

const FAMILY_ACCENT: Record<CurrencyCorrelationFamily, string> = {
  SI: "border-cyan-500/20 bg-cyan-950/20",
  CNY: "border-amber-500/20 bg-amber-950/15",
  ED: "border-violet-500/20 bg-violet-950/15",
};

function ContractCard({
  card,
  selection,
}: {
  card: CurrencyCorrelationCard;
  selection?: CurrencyContractSelection;
}) {
  const found = card.status === "найден";
  const change = card.changePct ?? 0;
  const activeTicker = selection?.activeNowTicker ?? card.ticker;

  return (
    <article
      className={cn(
        "flex items-center gap-2 rounded border px-1.5 py-1 backdrop-blur-sm",
        FAMILY_ACCENT[card.family],
        !found && "opacity-75",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[8px] uppercase tracking-wide text-slate-600">{card.baseName}</span>
          <span className="truncate font-mono text-[10px] text-slate-200">{activeTicker}</span>
          {found ? (
            <span
              className={cn(
                "font-mono text-[9px] tabular-nums",
                change > 0 ? "text-emerald-300/90" : change < 0 ? "text-rose-300/90" : "text-slate-500",
              )}
            >
              {tradingFormat.formatSignedPercent(card.changePct)}
            </span>
          ) : null}
        </div>
      </div>
      {found ? (
        <Link
          href={`/futures/${activeTicker}`}
          className="shrink-0 text-[9px] text-violet-300/60 hover:text-violet-200"
          title={card.label}
        >
          →
        </Link>
      ) : (
        <span className="text-[8px] text-slate-600">нет</span>
      )}
    </article>
  );
}

export function CurrencyCorrelationPage() {
  const [source, setSource] = React.useState<CurrencyDataMode>("intraday");
  const [chartMode, setChartMode] = React.useState<CurrencyChartMode>("points");
  const [dayPeriod, setDayPeriod] = React.useState<LabDayPeriod>(20);
  const [intradayInterval, setIntradayInterval] =
    React.useState<IntradayIntervalOption>(DEFAULT_INTRADAY_INTERVAL);
  const [intradayDays, setIntradayDays] = React.useState<IntradayDayOption>(DEFAULT_INTRADAY_DAYS);
  const [selectedPair, setSelectedPair] = React.useState<PointsPairKey>("SI/CNY");
  const [sensitivity, setSensitivity] = React.useState<SpreadLifecycleSensitivity>("standard");
  const [unitMode, setUnitMode] = React.useState<SpreadUnitMode>("raw-points");
  const [anchorMode, setAnchorMode] =
    React.useState<SpreadAnchorMode>(DEFAULT_SPREAD_ANCHOR_MODE);
  const [manualAnchorTime, setManualAnchorTime] = React.useState<string | null>(null);

  const [qhViewMode, setQhViewMode] = React.useState<QuadHedgeViewMode>(SPREAD_LAB_DEFAULT_PAIR);
  const [qhSpreadUnitMode, setQhSpreadUnitMode] =
    React.useState<QuadHedgeSpreadUnitMode>(SPREAD_LAB_DEFAULT_UNIT);
  const [qhHistoryDepth, setQhHistoryDepth] =
    React.useState<SpreadLabHistoryDepth>(SPREAD_LAB_DEFAULT_HISTORY_DEPTH);

  const spreadLabFetch = React.useMemo(
    () => spreadLabFetchParams(qhHistoryDepth),
    [qhHistoryDepth],
  );

  const needsIntraday = source === "intraday" || INTRADAY_CHART_MODES.includes(chartMode);

  const query = useScreenerQuery("future");
  const rows = query.data?.rows ?? [];
  const snapshot = React.useMemo(() => buildCurrencyCorrelationSnapshot(rows), [rows]);

  const historyQuery = useCurrencyCorrelationHistory(undefined, true);
  const intradayQuery = useCurrencyCorrelationIntraday(
    intradayInterval,
    intradayDays,
    needsIntraday,
  );

  const quadHedgeIntradayQuery = useQuadHedgeIntraday(
    spreadLabFetch.moexInterval,
    qhHistoryDepth,
    spreadLabFetch.windowScope,
    true,
  );

  const screenerSource = query.data?.status?.source;
  const quadHedgeAnalytics = useQuadHedgeAnalytics(
    quadHedgeIntradayQuery.data,
    rows,
    screenerSource === "demo" ? "demo" : screenerSource === "moex" ? "MOEX ISS" : undefined,
    Boolean(quadHedgeIntradayQuery.data),
    qhViewMode,
    spreadLabFetch.windowScope,
    qhHistoryDepth,
    spreadLabFetch.displayInterval,
  );

  const spreadLabChartModel = React.useMemo(
    () => buildSpreadLabChartModel(quadHedgeAnalytics, qhViewMode),
    [quadHedgeAnalytics, qhViewMode],
  );

  const quadHedgeChartModel = React.useMemo(
    () => buildQuadHedgeMainChartModel(quadHedgeAnalytics, qhViewMode, qhSpreadUnitMode),
    [quadHedgeAnalytics, qhViewMode, qhSpreadUnitMode],
  );

  const quadHedgeTables = useQuadHedgeTablesModel(
    undefined,
    rows,
    quadHedgeAnalytics,
    screenerSource === "demo" ? "demo" : screenerSource === "moex" ? "MOEX ISS" : undefined,
    true,
  );

  const selectionByFamily = React.useMemo(() => {
    const map = new Map<CurrencyCorrelationFamily, CurrencyContractSelection>();
    for (const row of historyQuery.data?.contractSelections ?? []) {
      map.set(row.family, row);
    }
    return map;
  }, [historyQuery.data?.contractSelections]);

  const handleSourceChange = React.useCallback((next: CurrencyDataMode) => {
    setSource(next);
    setChartMode((mode) => {
      if (next === "intraday" && !INTRADAY_CHART_MODES.includes(mode)) return "points";
      if (next === "day" && !DAILY_CHART_MODES.includes(mode)) return "normalize";
      return mode;
    });
  }, []);

  const handleChartModeChange = React.useCallback((mode: CurrencyChartMode) => {
    setChartMode(mode);
    if (INTRADAY_CHART_MODES.includes(mode)) setSource("intraday");
    else setSource("day");
  }, []);

  const pills = buildLabSourcePills(
    query.data?.status,
    `SI/EU/CN · ${quadHedgeAnalytics?.dataQuality.primaryLegsOk ?? 0}/3`,
  );

  const spreadLabEmptyHint = React.useMemo(
    () =>
      spreadLabChartModel?.canRender
        ? null
        : formatSpreadLabEmptyState(
            quadHedgeAnalytics,
            quadHedgeIntradayQuery.data,
            qhViewMode,
            qhHistoryDepth,
          ),
    [spreadLabChartModel?.canRender, quadHedgeAnalytics, quadHedgeIntradayQuery.data, qhViewMode, qhHistoryDepth],
  );

  const pipelineMessage = quadHedgePipelineMessage(
    quadHedgeAnalytics?.debug ?? quadHedgeIntradayQuery.data?.debug,
  );

  const historyLimited = isSpreadLabHistoryLimited(
    quadHedgeAnalytics?.debug ?? quadHedgeIntradayQuery.data?.debug,
    quadHedgeAnalytics?.focusPairDiagnostics?.alignedPoints,
    qhHistoryDepth,
  );

  const qhIntervalPill = quadHedgeIntradayQuery.data
    ? `${spreadLabFetch.displayInterval}м · ${qhHistoryDepth}`
    : null;

  const allPills = qhIntervalPill
    ? [...pills, { label: qhIntervalPill, tone: "time" as const }]
    : pills;

  return (
    <LabPageShell
      title="Spread Lab"
      description="Парный spread SI / EU / CN в пунктах · MOEX фьючерсы · 5м"
      pills={allPills}
    >
      {query.isLoading ? (
        <LabLoadingState message="Загрузка данных фьючерсов…" />
      ) : query.isError ? (
        <LabErrorState message="Не удалось загрузить данные фьючерсов. Повторите позже." />
      ) : (
        <div className="space-y-2">
          <QuadHedgeSpreadLabControls
            viewMode={qhViewMode}
            onViewModeChange={setQhViewMode}
            spreadUnitMode={qhSpreadUnitMode}
            onSpreadUnitModeChange={setQhSpreadUnitMode}
            historyDepth={qhHistoryDepth}
            onHistoryDepthChange={setQhHistoryDepth}
          />

          <QuadHedgeSpreadLabHeader
            viewMode={qhViewMode}
            analytics={quadHedgeAnalytics}
            intraday={quadHedgeIntradayQuery.data}
            historyDepth={qhHistoryDepth}
            displayIntervalMinutes={spreadLabFetch.displayInterval}
            isLoading={quadHedgeIntradayQuery.isLoading}
          />

          {historyLimited ? (
            <p className="rounded border border-amber-500/15 bg-amber-950/20 px-3 py-2 text-[10px] text-amber-200/85">
              {SPREAD_LAB_HISTORY_LIMITED_MESSAGE}
            </p>
          ) : null}

          <QuadHedgeSpreadStrip
            analytics={quadHedgeAnalytics}
            viewMode={qhViewMode}
            spreadUnitMode={qhSpreadUnitMode}
            isLoading={quadHedgeIntradayQuery.isLoading}
          />

          {qhSpreadUnitMode === "points" ? (
            <SpreadLabChart
              model={spreadLabChartModel}
              isLoading={quadHedgeIntradayQuery.isLoading}
              emptyHint={spreadLabEmptyHint ?? spreadLabChartModel?.emptyMessage}
            />
          ) : (
            <QuadHedgeMainChart
              model={quadHedgeChartModel}
              isLoading={quadHedgeIntradayQuery.isLoading}
              emptyHint={spreadLabEmptyHint ?? quadHedgeChartModel?.emptyMessage}
            />
          )}

          <details className="rounded-lg border border-white/[0.06] bg-slate-950/40">
            <summary className="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:text-slate-400">
              Диагностика и legacy
            </summary>
            <div className="space-y-2 border-t border-white/[0.05] p-2">
              <QuadHedgeActiveContracts
                contracts={quadHedgeIntradayQuery.data?.contracts}
                days={spreadLabFetch.calendarDays}
                interval={quadHedgeIntradayQuery.data?.usedInterval ?? spreadLabFetch.moexInterval}
                isLoading={quadHedgeIntradayQuery.isLoading}
              />

              <QuadHedgeDataDiagnostics
                debug={quadHedgeAnalytics?.debug ?? quadHedgeIntradayQuery.data?.debug}
                isLoading={quadHedgeIntradayQuery.isLoading}
              />

              <QuadHedgeCommandBar
                analytics={quadHedgeAnalytics}
                isLoading={quadHedgeIntradayQuery.isLoading}
                intradayEnabled
                updatedAt={quadHedgeIntradayQuery.data?.updatedAt}
                contractMessage={pipelineMessage}
              />

              <QuadHedgeTables model={quadHedgeTables} intradayEnabled />

              <div className="grid grid-cols-3 gap-1">
                {snapshot.instruments.map((card) => (
                  <ContractCard
                    key={card.family}
                    card={card}
                    selection={selectionByFamily.get(card.family)}
                  />
                ))}
              </div>

              <CurrencyCorrelationLabControls
                source={source}
                onSourceChange={handleSourceChange}
                intradayDays={intradayDays}
                onIntradayDaysChange={setIntradayDays}
                dayPeriod={dayPeriod}
                onDayPeriodChange={setDayPeriod}
                chartMode={chartMode}
                onChartModeChange={handleChartModeChange}
                interval={intradayInterval}
                onIntervalChange={setIntradayInterval}
                selectedPair={selectedPair}
                onSelectedPairChange={setSelectedPair}
                sensitivity={sensitivity}
                onSensitivityChange={setSensitivity}
                unitMode={unitMode}
                onUnitModeChange={setUnitMode}
                anchorMode={anchorMode}
                onAnchorModeChange={setAnchorMode}
              />

              <CurrencyCorrelationLabBody
                source={source}
                chartMode={chartMode}
                selectedPair={selectedPair}
                onSelectedPairChange={setSelectedPair}
                sensitivity={sensitivity}
                unitMode={unitMode}
                anchorMode={anchorMode}
                manualAnchorTime={manualAnchorTime}
                onManualAnchorTimeChange={setManualAnchorTime}
                history={historyQuery.data}
                historyLoading={historyQuery.isLoading}
                historyError={historyQuery.isError}
                historyErrorMessage={
                  historyQuery.error instanceof Error ? historyQuery.error.message : undefined
                }
                onHistoryRetry={() => void historyQuery.refetch()}
                dayPeriod={dayPeriod}
                onDayPeriodChange={setDayPeriod}
                intraday={intradayQuery.data}
                intradayLoading={intradayQuery.isLoading}
                intradayError={intradayQuery.isError}
                intradayErrorMessage={
                  intradayQuery.error instanceof Error ? intradayQuery.error.message : undefined
                }
                intradayInterval={intradayInterval}
              />
            </div>
          </details>
        </div>
      )}
    </LabPageShell>
  );
}
