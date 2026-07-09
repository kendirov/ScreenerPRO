import type { IChartApi, Time } from "lightweight-charts";

import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";
import type { SessionBox } from "@/lib/strategies/session-box-engine";

export type ChartVisibleRangePreset = "session" | "two_sessions" | "all" | "focus";

export type VisibleRange = {
  from: Time;
  to: Time;
  barsCount: number;
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function stableDiffCount(candles: StrategyCandle[]): number | null {
  if (candles.length < 2) return null;
  const counts = new Map<number, number>();
  for (let i = 1; i < candles.length; i += 1) {
    const diff = candles[i]!.time - candles[i - 1]!.time;
    if (!Number.isFinite(diff) || diff <= 0) continue;
    counts.set(diff, (counts.get(diff) ?? 0) + 1);
  }
  let best: { diff: number; count: number } | null = null;
  for (const [diff, count] of counts) {
    if (best == null || count > best.count || (count === best.count && diff < best.diff)) {
      best = { diff, count };
    }
  }
  return best?.diff ?? null;
}

function groupCandlesIntoSessions(candles: StrategyCandle[]): Array<{ startIndex: number; endIndex: number }> {
  if (candles.length === 0) return [];
  const intervalSeconds = stableDiffCount(candles);
  if (intervalSeconds == null) {
    return [{ startIndex: 0, endIndex: candles.length - 1 }];
  }

  // A "session break" is expected to be much larger than a candle interval.
  // For MOEX intraday, overnight gaps are ~15h+, while lunch breaks are usually far smaller.
  const minGapSeconds = 4 * 3600; // 4h "safety" to avoid lunch breaks splitting sessions
  const factor = intervalSeconds <= 300 ? 60 : intervalSeconds <= 600 ? 40 : 20;
  const gapThresholdSeconds = Math.max(intervalSeconds * factor, minGapSeconds);

  const groups: Array<{ startIndex: number; endIndex: number }> = [];
  let startIndex = 0;
  for (let i = 1; i < candles.length; i += 1) {
    const prev = candles[i - 1]!;
    const cur = candles[i]!;
    const diff = cur.time - prev.time;
    if (Number.isFinite(diff) && diff > gapThresholdSeconds) {
      groups.push({ startIndex, endIndex: i - 1 });
      startIndex = i;
    }
  }
  groups.push({ startIndex, endIndex: candles.length - 1 });
  return groups.filter((g) => g.endIndex >= g.startIndex);
}

function fallbackBarsForNSessions(candles: StrategyCandle[], n: number): number {
  // Tuned to match expectations:
  // - for 5m data, 2 sessions fallback -> last ~300 bars
  // - for other timeframes, scale down proportionally
  if (n <= 0) return 0;
  const intervalSeconds = stableDiffCount(candles);
  const isFiveMinute = intervalSeconds != null && Math.abs(intervalSeconds - 300) <= 1;
  const isTenMinute = intervalSeconds != null && Math.abs(intervalSeconds - 600) <= 1;
  const isThirtyMinute = intervalSeconds != null && Math.abs(intervalSeconds - 1800) <= 5;

  if (isFiveMinute) return n === 2 ? 300 : 150;
  if (isTenMinute) return n === 2 ? 150 : 75;
  if (isThirtyMinute) return n === 2 ? 50 : 25;

  // Generic fallback: be conservative.
  return n === 2 ? Math.min(300, candles.length) : Math.min(150, candles.length);
}

export function getLastNBarsVisibleRange(
  candles: StrategyCandle[],
  n: number,
): VisibleRange | null {
  if (candles.length === 0) return null;
  if (!Number.isFinite(n) || n <= 0) return null;
  const safeN = clampInt(n, 1, candles.length);
  const fromIndex = candles.length - safeN;
  const toIndex = candles.length - 1;
  const from = candles[fromIndex]!.time as Time;
  const to = candles[toIndex]!.time as Time;
  if (!Number.isFinite(from as number) || !Number.isFinite(to as number)) return null;
  return from <= to
    ? { from, to, barsCount: safeN }
    : { from: to, to: from, barsCount: safeN };
}

export function getLastSessionVisibleRange(
  candles: StrategyCandle[],
  sessionBoxes?: SessionBox[],
): VisibleRange | null {
  if (candles.length === 0) return null;
  const safeSessionBoxes = sessionBoxes && sessionBoxes.length > 0 ? sessionBoxes : null;

  if (safeSessionBoxes) {
    // Pick the latest box by candleEndIndex.
    const last = safeSessionBoxes.reduce((best, cur) =>
      cur.candleEndIndex >= best.candleEndIndex ? cur : best,
    );
    const fromIndex = clampInt(last.candleStartIndex, 0, candles.length - 1);
    const toIndex = clampInt(last.candleEndIndex, 0, candles.length - 1);
    const from = candles[fromIndex]!.time as Time;
    const to = candles[toIndex]!.time as Time;
    const barsCount = Math.abs(toIndex - fromIndex) + 1;
    if (!Number.isFinite(from as number) || !Number.isFinite(to as number)) return null;
    return from <= to ? { from, to, barsCount } : { from: to, to: from, barsCount };
  }

  // Infer session boundaries by large time gaps between candles.
  const sessions = groupCandlesIntoSessions(candles);
  if (sessions.length === 0) return null;
  const last = sessions[sessions.length - 1]!;
  const from = candles[last.startIndex]!.time as Time;
  const to = candles[last.endIndex]!.time as Time;
  const barsCount = last.endIndex - last.startIndex + 1;
  if (!Number.isFinite(from as number) || !Number.isFinite(to as number)) return null;
  return from <= to ? { from, to, barsCount } : { from: to, to: from, barsCount };
}

export function getLastNSessionsVisibleRange(
  candles: StrategyCandle[],
  sessionBoxes: SessionBox[] | undefined,
  n: number,
): VisibleRange | null {
  if (candles.length === 0) return null;
  if (!Number.isFinite(n) || n <= 0) return null;

  const safeSessionBoxes = sessionBoxes && sessionBoxes.length > 0 ? sessionBoxes : null;
  if (safeSessionBoxes && safeSessionBoxes.length >= n) {
    const sorted = [...safeSessionBoxes].sort((a, b) => a.candleEndIndex - b.candleEndIndex);
    const selected = sorted.slice(-n);
    const fromIndex = clampInt(selected[0]!.candleStartIndex, 0, candles.length - 1);
    const toIndex = clampInt(selected[selected.length - 1]!.candleEndIndex, 0, candles.length - 1);
    const from = candles[fromIndex]!.time as Time;
    const to = candles[toIndex]!.time as Time;
    const barsCount = Math.abs(toIndex - fromIndex) + 1;
    if (!Number.isFinite(from as number) || !Number.isFinite(to as number)) return null;
    return from <= to ? { from, to, barsCount } : { from: to, to: from, barsCount };
  }

  // Infer by gaps if session boxes are missing/insufficient.
  const sessions = groupCandlesIntoSessions(candles);
  if (sessions.length >= n) {
    const fromIndex = sessions[sessions.length - n]!.startIndex;
    const toIndex = sessions[sessions.length - 1]!.endIndex;
    const from = candles[fromIndex]!.time as Time;
    const to = candles[toIndex]!.time as Time;
    const barsCount = toIndex - fromIndex + 1;
    if (!Number.isFinite(from as number) || !Number.isFinite(to as number)) return null;
    return from <= to ? { from, to, barsCount } : { from: to, to: from, barsCount };
  }

  // Fallback: show the last N bars tuned for common intraday intervals.
  return getLastNBarsVisibleRange(candles, fallbackBarsForNSessions(candles, n));
}

export type ApplyVisibleRangePresetResult = {
  appliedPreset: ChartVisibleRangePreset;
  visibleRange: VisibleRange | null;
  usedFitContent: boolean;
  rightOffset: number | null;
};

function detectIntervalSecondsFor5m(candles: StrategyCandle[]): boolean {
  const intervalSeconds = stableDiffCount(candles);
  return intervalSeconds != null && Math.abs(intervalSeconds - 300) <= 1;
}

function rightOffsetForTwoSessions5m(visibleBarsCount: number): number {
  const targetMin = 220;
  const targetMax = 350;
  const clampedBars = clampInt(visibleBarsCount, targetMin, targetMax);
  // If we show fewer bars than the target window - give more right space.
  const t = (targetMax - clampedBars) / (targetMax - targetMin); // 0..1
  return clampInt(Math.round(8 + t * 4), 8, 12);
}

export function applyVisibleRangePreset(
  chart: IChartApi,
  candles: StrategyCandle[],
  preset: ChartVisibleRangePreset,
): ApplyVisibleRangePresetResult {
  const timeScale = chart.timeScale();
  if (candles.length === 0) {
    return {
      appliedPreset: preset,
      visibleRange: null,
      usedFitContent: false,
      rightOffset: null,
    };
  }

  const is5m = detectIntervalSecondsFor5m(candles);
  const minUsefulBars =
    preset === "two_sessions"
      ? is5m
        ? 220
        : 100
      : preset === "session"
        ? is5m
          ? 80
          : 40
        : 0;

  if (preset !== "all" && preset !== "focus" && candles.length < minUsefulBars) {
    timeScale.fitContent();
    return {
      appliedPreset: preset,
      visibleRange: null,
      usedFitContent: true,
      rightOffset: null,
    };
  }

  let range: VisibleRange | null = null;
  let rightOffset: number | null = null;
  let usedFitContent = false;

  if (preset === "all") {
    range = getLastNBarsVisibleRange(candles, candles.length);
  } else if (preset === "session") {
    range = getLastSessionVisibleRange(candles);
  } else if (preset === "two_sessions") {
    range = getLastNSessionsVisibleRange(candles, undefined, 2);

    if (is5m && range) {
      const targetMin = 220;
      const targetMax = 350;
      if (range.barsCount < targetMin) {
        range = getLastNBarsVisibleRange(candles, Math.min(300, candles.length));
      } else if (range.barsCount > targetMax) {
        range = getLastNBarsVisibleRange(candles, Math.min(targetMax, candles.length));
      }
      rightOffset = rightOffsetForTwoSessions5m(range?.barsCount ?? targetMin);
    }
  } else if (preset === "focus") {
    range = getLastNBarsVisibleRange(candles, is5m ? 48 : 24);
  }

  if (!range) {
    timeScale.fitContent();
    usedFitContent = true;
    return {
      appliedPreset: preset,
      visibleRange: null,
      usedFitContent,
      rightOffset: null,
    };
  }

  if (rightOffset != null) {
    timeScale.applyOptions({ rightOffset });
  }

  timeScale.setVisibleRange({ from: range.from, to: range.to });

  return {
    appliedPreset: preset,
    visibleRange: range,
    usedFitContent,
    rightOffset,
  };
}

