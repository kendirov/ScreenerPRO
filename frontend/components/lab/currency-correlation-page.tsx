"use client";

import Link from "next/link";
import * as React from "react";
import type { CurrencyDataMode } from "@/components/lab/currency-correlation/currency-correlation-data-mode";
import { CurrencyCorrelationLabBody } from "@/components/lab/currency-correlation/currency-correlation-lab-body";
import {
  CurrencyCorrelationLabControls,
  type LabDayPeriod,
} from "@/components/lab/currency-correlation/currency-correlation-lab-controls";
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
  buildIntradayLabDiagnostics,
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
import { useCurrencyCorrelationHistory } from "@/lib/hooks/use-currency-correlation-history";
import { useCurrencyCorrelationIntraday } from "@/lib/hooks/use-currency-correlation-intraday";
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

  const intradayDaysBumpRef = React.useRef(false);
  React.useEffect(() => {
    if (source !== "intraday" || intradayDays !== 1 || intradayDaysBumpRef.current) return;
    if (!intradayQuery.data || intradayQuery.isLoading) return;
    const summary = buildIntradayLabDiagnostics(intradayQuery.data);
    const totalPoints = summary.pointsSi + summary.pointsCny + summary.pointsEd;
    if (summary.status === "нет интрадей-свечей" || totalPoints < 10) {
      intradayDaysBumpRef.current = true;
      setIntradayDays(2);
    }
  }, [source, intradayDays, intradayQuery.data, intradayQuery.isLoading]);

  React.useEffect(() => {
    if (source !== "intraday") intradayDaysBumpRef.current = false;
  }, [source, intradayInterval]);

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
    `контракты ${snapshot.foundCount}/3`,
  );

  const intradayStatusPill = React.useMemo(() => {
    if (!intradayQuery.data) return null;
    const d = buildIntradayLabDiagnostics(intradayQuery.data);
    if (d.status !== "готово") return null;
    return `интрадей ${d.usedInterval}м`;
  }, [intradayQuery.data]);

  const allPills = intradayStatusPill
    ? [...pills, { label: intradayStatusPill, tone: "time" as const }]
    : pills;

  return (
    <LabPageShell
      title="Валютная связка"
      description="Пункты, спреды, недельный якорь и расхождения валютных фьючерсов MOEX."
      pills={allPills}
    >
      {query.isLoading ? (
        <LabLoadingState message="Загрузка данных фьючерсов…" />
      ) : query.isError ? (
        <LabErrorState message="Не удалось загрузить данные фьючерсов. Повторите позже." />
      ) : (
        <div className="space-y-2">
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
      )}
    </LabPageShell>
  );
}
