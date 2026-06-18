/**
 * Intraday baseline — сравнение текущего оборота/сделок с нормой на этот момент сессии.
 * Не подменяет полный дневной average как основной показатель.
 */

export type IntradayBaselineStatus = "ok" | "no-history" | "partial" | "rough";

/** Честный тип источника baseline для UI и диагностики. */
export type IntradayBaselineKind =
  | "intraday-ok"
  | "intraday-partial"
  | "rough-day-avg"
  | "previous-day"
  | "none";

export type IntradayBaselineMetric = {
  secid: string;
  timeMsk: string;
  currentTurnover: number | null;
  avgTurnoverAtTime20d?: number | null;
  volumeRatioNow?: number | null;
  currentTrades: number | null;
  avgTradesAtTime20d?: number | null;
  tradesRatioNow?: number | null;
  status: IntradayBaselineStatus;
  kind: IntradayBaselineKind;
  baselineSessionsCount: number;
  baselineFirstDate: string | null;
  baselineLastDate: string | null;
  avgDailyTurnover20d: number | null;
  previousDayTurnover: number | null;
  baselineWarning: string | null;
};

export type IntradayCandlePoint = {
  /** YYYY-MM-DD MSK */
  dayKey: string;
  /** minutes from midnight MSK */
  minutesMsk: number;
  turnover: number;
};

export type DailyHistoryBaseline = {
  avgDailyTurnover20d: number | null;
  avgDailyTrades20d: number | null;
  previousDayTurnover: number | null;
  previousDayTrades: number | null;
  historyDays: number;
};

const MIN_OK_SESSIONS = 10;
const MIN_PARTIAL_SESSIONS = 5;

function safeRatio(current: number | null, baseline: number | null | undefined): number | null {
  if (current == null || baseline == null || baseline <= 0) return null;
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) return null;
  return current / baseline;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function kindToStatus(kind: IntradayBaselineKind): IntradayBaselineStatus {
  if (kind === "intraday-ok") return "ok";
  if (kind === "rough-day-avg") return "rough";
  if (kind === "intraday-partial" || kind === "previous-day") return "partial";
  return "no-history";
}

/** Средний накопленный оборот к текущему времени MSK по intraday-сессиям. */
export function avgCumulativeTurnoverAtTime(
  candles: IntradayCandlePoint[],
  cutoffMinutesMsk: number,
): { avg: number | null; sessions: number; firstDate: string | null; lastDate: string | null } {
  const byDay = new Map<string, number>();
  for (const candle of candles) {
    if (candle.minutesMsk > cutoffMinutesMsk) continue;
    byDay.set(candle.dayKey, (byDay.get(candle.dayKey) ?? 0) + candle.turnover);
  }
  const values = [...byDay.values()].filter((v) => v > 0);
  const sessionKeys = [...byDay.keys()].filter((k) => (byDay.get(k) ?? 0) > 0).sort();
  return {
    avg: average(values),
    sessions: values.length,
    firstDate: sessionKeys[0] ?? null,
    lastDate: sessionKeys[sessionKeys.length - 1] ?? null,
  };
}

export function buildIntradayBaselineMetric(input: {
  secid: string;
  timeMsk: string;
  currentTurnover: number | null;
  currentTrades: number | null;
  sessionProgress: number;
  intradayAvgTurnoverAtTime: number | null;
  intradaySessions: number;
  intradayFirstDate?: string | null;
  intradayLastDate?: string | null;
  daily: DailyHistoryBaseline | null;
}): IntradayBaselineMetric {
  const progress = Math.max(0, Math.min(1, input.sessionProgress));
  let kind: IntradayBaselineKind = "none";
  let avgTurnoverAtTime: number | null = null;
  let avgTradesAtTime: number | null = null;
  let baselineWarning: string | null = null;
  let baselineSessionsCount = 0;
  let baselineFirstDate: string | null = null;
  let baselineLastDate: string | null = null;

  const avgDailyTurnover20d = input.daily?.avgDailyTurnover20d ?? null;
  const previousDayTurnover = input.daily?.previousDayTurnover ?? null;

  if (input.intradayAvgTurnoverAtTime != null && input.intradayAvgTurnoverAtTime > 0) {
    avgTurnoverAtTime = input.intradayAvgTurnoverAtTime;
    baselineSessionsCount = input.intradaySessions;
    baselineFirstDate = input.intradayFirstDate ?? null;
    baselineLastDate = input.intradayLastDate ?? null;

    if (input.intradaySessions >= MIN_OK_SESSIONS) {
      kind = "intraday-ok";
    } else if (input.intradaySessions >= MIN_PARTIAL_SESSIONS) {
      kind = "intraday-partial";
      baselineWarning = `intraday ${input.intradaySessions} сессий (< ${MIN_OK_SESSIONS})`;
    } else {
      kind = "intraday-partial";
      baselineWarning = `intraday ${input.intradaySessions} сессий — мало истории`;
    }
  } else if (input.daily) {
    const { avgDailyTrades20d, previousDayTrades, historyDays } = input.daily;

    if (avgDailyTurnover20d != null && avgDailyTurnover20d > 0 && progress > 0 && historyDays >= 5) {
      avgTurnoverAtTime = avgDailyTurnover20d * progress;
      kind = "rough-day-avg";
      baselineSessionsCount = historyDays;
      baselineWarning = "средний дневной оборот × ход сессии (не intraday 20d)";
    } else if (previousDayTurnover != null && previousDayTurnover > 0 && progress > 0) {
      avgTurnoverAtTime = previousDayTurnover * progress;
      kind = "previous-day";
      baselineSessionsCount = 1;
      baselineWarning = "только вчера × ход сессии";
    }

    // История сделок по времени не хранится — не подставляем Trades x из дневного avg / вчера.
  }

  const volumeRatioNow = safeRatio(input.currentTurnover, avgTurnoverAtTime);
  const tradesRatioNow = safeRatio(input.currentTrades, avgTradesAtTime);

  if (volumeRatioNow == null && tradesRatioNow == null) {
    kind = "none";
    baselineWarning = null;
  }

  return {
    secid: input.secid,
    timeMsk: input.timeMsk,
    currentTurnover: input.currentTurnover,
    avgTurnoverAtTime20d: avgTurnoverAtTime,
    volumeRatioNow,
    currentTrades: input.currentTrades,
    avgTradesAtTime20d: avgTradesAtTime,
    tradesRatioNow,
    status: kindToStatus(kind),
    kind,
    baselineSessionsCount,
    baselineFirstDate,
    baselineLastDate,
    avgDailyTurnover20d,
    previousDayTurnover,
    baselineWarning,
  };
}

export function formatMoscowTimeLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export function formatRatioMultiplier(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `x${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value)}`;
}

/** Честная подпись ratio — не называем rough/yesterday полноценным Vol x. */
export function formatVolumeRatioDisplay(
  ratio: number | null | undefined,
  status: IntradayBaselineStatus | null | undefined,
  kind?: IntradayBaselineKind | null,
): string {
  const resolvedKind = kind ?? statusToKind(status);
  if (ratio == null || resolvedKind === "none") return "без baseline";

  const formatted = formatRatioMultiplier(ratio);
  if (!formatted) return "без baseline";

  switch (resolvedKind) {
    case "intraday-ok":
      return formatted;
    case "intraday-partial":
      return formatted;
    case "rough-day-avg":
      return `${formatted} rough`;
    case "previous-day":
      return `${formatted} rough`;
    default:
      return "без baseline";
  }
}

function statusToKind(status: IntradayBaselineStatus | null | undefined): IntradayBaselineKind {
  if (status === "ok") return "intraday-ok";
  if (status === "rough") return "rough-day-avg";
  if (status === "partial") return "intraday-partial";
  return "none";
}

/** Короткий muted-статус для колонки Vol x. */
export function formatBaselineMutedLabel(kind: IntradayBaselineKind | null | undefined): string {
  switch (kind) {
    case "intraday-ok":
      return "20d ok";
    case "intraday-partial":
      return "частично";
    case "rough-day-avg":
      return "rough";
    case "previous-day":
      return "rough";
    default:
      return "без baseline";
  }
}

export type RatioTone = "muted" | "neutral" | "cyan" | "amber" | "hot";

export function resolveRatioTone(ratio: number | null | undefined, kind?: IntradayBaselineKind | null): RatioTone {
  if (ratio == null || !Number.isFinite(ratio)) return "muted";
  if (kind === "intraday-partial") {
    if (ratio < 0.85) return "muted";
    if (ratio < 1.85) return "amber";
    return "hot";
  }
  if (kind && kind !== "intraday-ok") return "muted";
  if (ratio < 0.85) return "muted";
  if (ratio < 1.25) return "neutral";
  if (ratio < 1.85) return "cyan";
  if (ratio < 2.85) return "amber";
  return "hot";
}

export type RatioCellParts = {
  primary: string;
  suffix: string | null;
  tone: RatioTone;
};

/** Одна строка в таблице: `x2.1 · 20d` / `x3.4 · rough` / `без baseline`. */
export function formatRatioCellParts(
  ratio: number | null | undefined,
  kind: IntradayBaselineKind | null | undefined,
): RatioCellParts {
  const resolvedKind = kind ?? "none";
  if (ratio == null || resolvedKind === "none") {
    return { primary: "без baseline", suffix: null, tone: "muted" };
  }

  const mult = formatRatioMultiplier(ratio);
  if (!mult) {
    return { primary: "без baseline", suffix: null, tone: "muted" };
  }

  switch (resolvedKind) {
    case "intraday-ok":
      return { primary: mult, suffix: "20d", tone: resolveRatioTone(ratio, resolvedKind) };
    case "intraday-partial":
      return { primary: mult, suffix: "частично", tone: resolveRatioTone(ratio, resolvedKind) };
    case "rough-day-avg":
      return { primary: mult, suffix: "rough", tone: "muted" };
    case "previous-day":
      return { primary: mult, suffix: "vs вчера", tone: "muted" };
    default:
      return { primary: "без baseline", suffix: null, tone: "muted" };
  }
}

/** Trades x — только при реальном intraday baseline по сделкам (пока не внедрён). */
export function hasHonestIntradayTradesBaseline(_kind: IntradayBaselineKind | null | undefined): boolean {
  return false;
}

export function formatRatioCellLine(
  ratio: number | null | undefined,
  kind: IntradayBaselineKind | null | undefined,
): string {
  const parts = formatRatioCellParts(ratio, kind);
  return parts.suffix != null ? `${parts.primary} · ${parts.suffix}` : parts.primary;
}

export const RATIO_TONE_CLASS: Record<RatioTone, string> = {
  muted: "text-slate-500",
  neutral: "text-slate-300",
  cyan: "text-cyan-300/90",
  amber: "text-amber-300/90",
  hot: "text-violet-300/95",
};

export function baselineStatusHint(
  status: IntradayBaselineStatus | null | undefined,
  kind?: IntradayBaselineKind | null,
  warning?: string | null,
): string | null {
  const resolvedKind = kind ?? statusToKind(status);
  if (warning) return warning;
  if (resolvedKind === "rough-day-avg") return "rough · дневной avg × ход сессии";
  if (resolvedKind === "previous-day") return "vs yesterday · один день";
  if (resolvedKind === "intraday-partial") return "partial · мало intraday-сессий";
  if (resolvedKind === "none") return "нет baseline";
  return null;
}

/** Полноценный intraday baseline (накопленный оборот к времени, ≥10 сессий). */
export function isHonestIntradayVolumeBaseline(kind: IntradayBaselineKind | null | undefined): boolean {
  return kind === "intraday-ok";
}
