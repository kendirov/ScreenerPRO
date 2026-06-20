/**
 * Расчёт реакции ЦБ только по реальным MOEX-свечам.
 * Без подстановки 0.00% при отсутствии данных.
 */

import { mskTimeToUnix } from "@/lib/domain/cbr-rate-event-window";

export type CbrReactionCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  value?: number;
};

export type CbrReactionWindowId =
  | "preDecision"
  | "first5m"
  | "first30m"
  | "postPress"
  | "fullDay";

export type CbrReactionCalcStatus = "no_data" | "incomplete" | "ok";

export const CBR_REACTION_CALC_WINDOWS: Record<
  CbrReactionWindowId,
  { fromMsk: string; toMsk: string }
> = {
  preDecision: { fromMsk: "12:30", toMsk: "13:29" },
  first5m: { fromMsk: "13:30", toMsk: "13:35" },
  first30m: { fromMsk: "13:30", toMsk: "14:00" },
  postPress: { fromMsk: "15:00", toMsk: "16:00" },
  fullDay: { fromMsk: "10:00", toMsk: "18:45" },
};

const DECISION_MSK = "13:30";
const DECISION_COVERAGE_SEC = 5 * 60;
const DECISION_LOOKBACK_SEC = 15 * 60;

export type CbrReactionMetricsResult = {
  status: CbrReactionCalcStatus;
  reason?: string;
  eventDate: string | null;
  windowReturns: Partial<Record<CbrReactionWindowId, number | null>>;
  windowVolumes: Partial<Record<CbrReactionWindowId, number | null>>;
  reaction5mPct: number | null;
  reaction30mPct: number | null;
  reactionPostPressPct: number | null;
  reactionDayPct: number | null;
  dayRangePct: number | null;
  volumeRatio: number | null;
};

function sortedCandles(candles: CbrReactionCandle[]): CbrReactionCandle[] {
  return [...candles].sort((a, b) => a.time - b.time);
}

function eventDateFromCandles(candles: CbrReactionCandle[]): string | null {
  if (!candles.length) return null;
  return new Date(candles[0]!.time * 1000).toLocaleDateString("en-CA", {
    timeZone: "Europe/Moscow",
  });
}

function windowUnix(
  date: string,
  fromMsk: string,
  toMsk: string,
): { fromUnix: number; toUnix: number } {
  return {
    fromUnix: mskTimeToUnix(date, fromMsk),
    toUnix: mskTimeToUnix(date, toMsk),
  };
}

/** Последняя close на момент time или раньше. */
export function getPriceAtOrBefore(
  candles: CbrReactionCandle[],
  timeUnix: number,
): number | null {
  const sorted = sortedCandles(candles);
  let pick: CbrReactionCandle | null = null;
  for (const c of sorted) {
    if (c.time <= timeUnix) pick = c;
    else break;
  }
  if (!pick) return null;
  const price = pick.close;
  return price != null && Number.isFinite(price) ? price : null;
}

/** open первой свечи на момент time или позже. */
export function getPriceAtOrAfter(
  candles: CbrReactionCandle[],
  timeUnix: number,
): number | null {
  const sorted = sortedCandles(candles);
  const pick = sorted.find((c) => c.time >= timeUnix);
  if (!pick) return null;
  const price = pick.open ?? pick.close;
  return price != null && Number.isFinite(price) ? price : null;
}

export function calculateReturnPct(
  fromPrice: number | null,
  toPrice: number | null,
): number | null {
  if (
    fromPrice == null ||
    toPrice == null ||
    !Number.isFinite(fromPrice) ||
    !Number.isFinite(toPrice) ||
    fromPrice === 0
  ) {
    return null;
  }
  return ((toPrice - fromPrice) / fromPrice) * 100;
}

/** Сумма volume (или value) между fromUnix и toUnix включительно. */
export function calculateVolume(
  candles: CbrReactionCandle[],
  fromUnix: number,
  toUnix: number,
): number | null {
  const window = sortedCandles(candles).filter((c) => c.time >= fromUnix && c.time <= toUnix);
  if (!window.length) return null;

  let total = 0;
  let hasVolume = false;
  for (const c of window) {
    const v = c.volume ?? c.value;
    if (v != null && Number.isFinite(v)) {
      total += v;
      hasVolume = true;
    }
  }
  return hasVolume ? total : null;
}

function windowReturn(
  candles: CbrReactionCandle[],
  fromUnix: number,
  toUnix: number,
): number | null {
  const fromPrice = getPriceAtOrBefore(candles, fromUnix);
  const toPrice = getPriceAtOrBefore(candles, toUnix);
  return calculateReturnPct(fromPrice, toPrice);
}

function calculateDayRange(candles: CbrReactionCandle[]): number | null {
  const sorted = sortedCandles(candles);
  if (sorted.length < 2) return null;

  const open = sorted[0]!.open;
  if (!open || !Number.isFinite(open)) return null;

  let high = -Infinity;
  let low = Infinity;
  for (const c of sorted) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;

  return ((high - low) / open) * 100;
}

function windowDurationMinutes(fromMsk: string, toMsk: string): number {
  const [fh, fm] = fromMsk.split(":").map(Number);
  const [th, tm] = toMsk.split(":").map(Number);
  return th! * 60 + tm! - (fh! * 60 + fm!) + 1;
}

function estimateVolumeRatio(
  candles: CbrReactionCandle[],
  date: string,
  fullDayVol: number | null,
): number | null {
  const pre = CBR_REACTION_CALC_WINDOWS.preDecision;
  const full = CBR_REACTION_CALC_WINDOWS.fullDay;
  const { fromUnix: preFrom, toUnix: preTo } = windowUnix(date, pre.fromMsk, pre.toMsk);
  const preVol = calculateVolume(candles, preFrom, preTo);
  if (preVol == null || fullDayVol == null) return null;

  const preMin = windowDurationMinutes(pre.fromMsk, pre.toMsk);
  const fullMin = windowDurationMinutes(full.fromMsk, full.toMsk);
  if (preMin <= 0 || preVol <= 0) return null;

  const baseline = preVol * (fullMin / preMin);
  if (!Number.isFinite(baseline) || baseline <= 0) return null;
  return fullDayVol / baseline;
}

export function hasDecisionTimeCoverage(candles: CbrReactionCandle[], date: string): boolean {
  const sorted = sortedCandles(candles);
  if (sorted.length < 2) return false;

  const decisionUnix = mskTimeToUnix(date, DECISION_MSK);
  const coverageEnd = decisionUnix + DECISION_COVERAGE_SEC;

  const inFirst5m = sorted.some((c) => c.time >= decisionUnix && c.time <= coverageEnd);
  if (inFirst5m) return true;

  const before = sorted.filter((c) => c.time <= decisionUnix);
  if (!before.length) return false;

  const lastBefore = before[before.length - 1]!;
  return decisionUnix - lastBefore.time <= DECISION_LOOKBACK_SEC;
}

function fullDayReturn(candles: CbrReactionCandle[], date: string): number | null {
  const sorted = sortedCandles(candles);
  if (!sorted.length) return null;

  const sessionStart = mskTimeToUnix(date, CBR_REACTION_CALC_WINDOWS.fullDay.fromMsk);
  const sessionEnd = mskTimeToUnix(date, CBR_REACTION_CALC_WINDOWS.fullDay.toMsk);
  const inSession = sorted.filter((c) => c.time >= sessionStart && c.time <= sessionEnd);
  if (!inSession.length) return null;

  const fromPrice =
    getPriceAtOrBefore(sorted, sessionStart) ?? inSession[0]!.open ?? inSession[0]!.close;
  const lastTime = Math.min(sessionEnd, sorted[sorted.length - 1]!.time);
  const toPrice = getPriceAtOrBefore(sorted, lastTime);

  return calculateReturnPct(fromPrice, toPrice);
}

function emptyMetrics(
  status: CbrReactionCalcStatus,
  reason?: string,
  eventDate: string | null = null,
): CbrReactionMetricsResult {
  return {
    status,
    reason,
    eventDate,
    windowReturns: {},
    windowVolumes: {},
    reaction5mPct: null,
    reaction30mPct: null,
    reactionPostPressPct: null,
    reactionDayPct: null,
    dayRangePct: null,
    volumeRatio: null,
  };
}

/**
 * Метрики реакции по MOEX-свечам.
 * @param eventDate YYYY-MM-DD — день заседания; если не передан, берётся из первой свечи (MSK).
 */
export function calculateReactionMetrics(
  candles: CbrReactionCandle[],
  eventDate?: string,
): CbrReactionMetricsResult {
  const sorted = sortedCandles(candles);
  const date = eventDate?.slice(0, 10) ?? eventDateFromCandles(sorted);

  if (sorted.length < 2 || !date) {
    return emptyMetrics(
      "no_data",
      sorted.length === 0
        ? "MOEX ISS: нет свечей"
        : sorted.length < 2
          ? "Недостаточно свечей для расчёта (нужно ≥ 2)"
          : "Не удалось определить дату заседания",
      date,
    );
  }

  const windowReturns: Partial<Record<CbrReactionWindowId, number | null>> = {};
  const windowVolumes: Partial<Record<CbrReactionWindowId, number | null>> = {};

  for (const [id, def] of Object.entries(CBR_REACTION_CALC_WINDOWS) as Array<
    [CbrReactionWindowId, { fromMsk: string; toMsk: string }]
  >) {
    const { fromUnix, toUnix } = windowUnix(date, def.fromMsk, def.toMsk);
    if (id === "fullDay") {
      windowReturns.fullDay = fullDayReturn(sorted, date);
      windowVolumes.fullDay = calculateVolume(sorted, fromUnix, toUnix);
    } else {
      windowReturns[id] = windowReturn(sorted, fromUnix, toUnix);
      windowVolumes[id] = calculateVolume(sorted, fromUnix, toUnix);
    }
  }

  const decisionOk = hasDecisionTimeCoverage(sorted, date);
  const dayRangePct = calculateDayRange(sorted);
  const fullDayVol = windowVolumes.fullDay ?? null;
  const volumeRatio = estimateVolumeRatio(sorted, date, fullDayVol);

  if (!decisionOk) {
    return {
      status: "incomplete",
      reason: "Нет надёжной привязки к 13:30 MSK — импульсные окна не считаем",
      eventDate: date,
      windowReturns,
      windowVolumes,
      reaction5mPct: null,
      reaction30mPct: null,
      reactionPostPressPct: windowReturns.postPress ?? null,
      reactionDayPct: windowReturns.fullDay ?? null,
      dayRangePct,
      volumeRatio,
    };
  }

  return {
    status: "ok",
    eventDate: date,
    windowReturns,
    windowVolumes,
    reaction5mPct: windowReturns.first5m ?? null,
    reaction30mPct: windowReturns.first30m ?? null,
    reactionPostPressPct: windowReturns.postPress ?? null,
    reactionDayPct: windowReturns.fullDay ?? null,
    dayRangePct,
    volumeRatio,
  };
}

/** Маппинг calc-окон → legacy id для паттернов. */
export function mapCalcWindowReturnsToLegacy(
  windowReturns: Partial<Record<CbrReactionWindowId, number | null>>,
): {
  preDecision: number | null;
  firstImpulse: number | null;
  firstDigest: number | null;
  postPress: number | null;
  fullDay: number | null;
} {
  return {
    preDecision: windowReturns.preDecision ?? null,
    firstImpulse: windowReturns.first5m ?? null,
    firstDigest: windowReturns.first30m ?? null,
    postPress: windowReturns.postPress ?? null,
    fullDay: windowReturns.fullDay ?? null,
  };
}

export function mapCalcWindowVolumesToLegacy(
  windowVolumes: Partial<Record<CbrReactionWindowId, number | null>>,
): {
  preDecision: number | null;
  firstImpulse: number | null;
  firstDigest: number | null;
  postPress: number | null;
  fullDay: number | null;
} {
  return {
    preDecision: windowVolumes.preDecision ?? null,
    firstImpulse: windowVolumes.first5m ?? null,
    firstDigest: windowVolumes.first30m ?? null,
    postPress: windowVolumes.postPress ?? null,
    fullDay: windowVolumes.fullDay ?? null,
  };
}
