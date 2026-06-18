import type { ScreenerRow } from "@screenerpro/shared";
import type { IntradayBaselineKind, IntradayBaselineMetric, IntradayBaselineStatus } from "@/lib/domain/intraday-baseline";

export type BaselineAuditRow = {
  ticker: string;
  currentTurnover: number | null;
  currentTrades: number | null;
  baselineSessionsCount: number;
  baselineDates: string | null;
  avgTurnover20d: number | null;
  avgTurnoverAtSameTime20d: number | null;
  avgTradesAtSameTime20d: number | null;
  volumeRatioNow: number | null;
  tradesRatioNow: number | null;
  /** Полный дневной оборот / avg daily 20d (НЕ Vol x). */
  turnoverVsAverage: number | null;
  activityRatio: number | null;
  baselineStatus: IntradayBaselineStatus;
  baselineKind: IntradayBaselineKind;
  baselineWarning: string | null;
  sessionProgress: number | null;
};

function formatBaselineDates(first: string | null, last: string | null): string | null {
  if (!first && !last) return null;
  if (first && last && first !== last) return `${first}…${last}`;
  return first ?? last ?? null;
}

export function buildBaselineAuditRow(
  row: ScreenerRow,
  intraday: IntradayBaselineMetric | null | undefined,
): BaselineAuditRow {
  const first = intraday?.baselineFirstDate ?? null;
  const last = intraday?.baselineLastDate ?? null;

  return {
    ticker: row.ticker,
    currentTurnover: row.turnover,
    currentTrades: row.tradesCount ?? null,
    baselineSessionsCount: intraday?.baselineSessionsCount ?? 0,
    baselineDates: formatBaselineDates(first, last),
    avgTurnover20d: intraday?.avgDailyTurnover20d ?? null,
    avgTurnoverAtSameTime20d: intraday?.avgTurnoverAtTime20d ?? null,
    avgTradesAtSameTime20d: intraday?.avgTradesAtTime20d ?? null,
    volumeRatioNow: row.metrics.volumeRatioNow ?? intraday?.volumeRatioNow ?? null,
    tradesRatioNow: row.metrics.tradesRatioNow ?? intraday?.tradesRatioNow ?? null,
    turnoverVsAverage: row.metrics.turnoverVsAverage ?? null,
    activityRatio: row.metrics.activityRatio ?? null,
    baselineStatus: intraday?.status ?? row.metrics.intradayBaselineStatus ?? "no-history",
    baselineKind: intraday?.kind ?? "none",
    baselineWarning: intraday?.baselineWarning ?? null,
    sessionProgress: row.metrics.sessionProgress ?? null,
  };
}
