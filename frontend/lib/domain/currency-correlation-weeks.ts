import { getPairConfig, type PointsPairKey } from "@/lib/domain/currency-pair-config";
import {
  calculatePairDivergence,
  DEFAULT_PAIR_Z_WINDOW,
} from "@/lib/domain/currency-pair-divergence";
import type { IntradayCandlePoint } from "@/lib/domain/currency-correlation-intraday";
import {
  divergenceOptionsFromResolution,
  resolveSpreadAnchor,
  type SpreadAnchorMode,
} from "@/lib/domain/currency-spread-anchor";
import {
  isTimestampInWeek,
  minuteOfWeekFromTimestamp,
  type TradingWeekDescriptor,
} from "@/lib/domain/trading-week";
import { alignIntradayForPair } from "@/lib/domain/currency-time-series-align";

export type WeeklySpreadPoint = {
  timestamp: string;
  minuteOfWeek: number;
  spreadPoints: number;
  zScore: number | null;
  leftMove: number;
  rightMove: number;
};

export type WeeklySpreadDiagnostics = {
  rawLeftPoints: number;
  rawRightPoints: number;
  alignedPoints: number;
  forwardFilledPoints: number;
  staleDroppedPoints: number;
  contractNote?: string;
};

export type WeeklySpreadSeries = {
  weekStart: string;
  weekLabel: string;
  pair: string;
  usedTickers: string[];
  anchorTime: string | null;
  points: WeeklySpreadPoint[];
  status: "ok" | "partial" | "empty";
  diagnostics: WeeklySpreadDiagnostics;
};

export type CurrencyCorrelationWeeksResponse = {
  pair: PointsPairKey;
  interval: number;
  usedInterval: number;
  anchor: SpreadAnchorMode;
  weeks: WeeklySpreadSeries[];
  rolloverTodo: string;
};

export const WEEKS_DEFAULT_COUNT = 4;
export const WEEKS_MAX_COUNT = 8;

export const ROLLOVER_TODO_NOTE =
  "Следующий этап: непрерывная серия front contract по семействам SI/CNY/ED.";

export function parseWeeksPairParam(raw: string): PointsPairKey | null {
  const normalized = raw.trim().replace(/-/g, "/").toUpperCase();
  if (normalized === "SI/CNY" || normalized === "SICNY") return "SI/CNY";
  if (normalized === "SI/ED" || normalized === "SIED") return "SI/ED";
  if (normalized === "CNY/ED" || normalized === "CNYED") return "CNY/ED";
  return null;
}

export function buildWeeklySpreadSeries(
  week: TradingWeekDescriptor,
  pairKey: PointsPairKey,
  leftTicker: string,
  rightTicker: string,
  leftPoints: IntradayCandlePoint[],
  rightPoints: IntradayCandlePoint[],
  intervalMinutes: number,
  anchorMode: SpreadAnchorMode,
  offsetFromCurrent: number,
): WeeklySpreadSeries {
  const config = getPairConfig(pairKey);
  const pairLabel = pairKey.replace("/", " − ");

  const filterWeek = (pts: IntradayCandlePoint[]) =>
    pts.filter((p) => isTimestampInWeek(p.timestamp, week));

  const leftWeek = filterWeek(leftPoints);
  const rightWeek = filterWeek(rightPoints);

  const diagnostics: WeeklySpreadDiagnostics = {
    rawLeftPoints: leftWeek.length,
    rawRightPoints: rightWeek.length,
    alignedPoints: 0,
    forwardFilledPoints: 0,
    staleDroppedPoints: 0,
  };

  const emptyBase: WeeklySpreadSeries = {
    weekStart: week.weekStart,
    weekLabel: week.weekLabel,
    pair: pairLabel,
    usedTickers: [leftTicker, rightTicker],
    anchorTime: null,
    points: [],
    status: "empty",
    diagnostics,
  };

  if (!leftWeek.length && !rightWeek.length) {
    if (offsetFromCurrent > 0) {
      diagnostics.contractNote =
        "Для этой недели у текущего контракта нет истории на MOEX ISS.";
    }
    return emptyBase;
  }

  if (!leftWeek.length || !rightWeek.length) {
    diagnostics.contractNote =
      offsetFromCurrent > 0
        ? "Для прошлой недели у текущего контракта нет полной истории по обеим ногам."
        : "Недостаточно свечей по одной из ног за неделю.";
    return {
      ...emptyBase,
      status: "partial",
    };
  }

  const seriesInput: Record<string, IntradayCandlePoint[]> = {
    [config.leftInstrument]: leftWeek,
    [config.rightInstrument]: rightWeek,
  };

  const alignment = alignIntradayForPair(pairKey, seriesInput, intervalMinutes);
  if (!alignment || alignment.rows.length < 2) {
    diagnostics.staleDroppedPoints = alignment?.stats.staleDroppedCount ?? 0;
    diagnostics.contractNote =
      offsetFromCurrent > 0
        ? "Для прошлой недели у текущего контракта мало общих свечей."
        : "Мало общих свечей за неделю.";
    return { ...emptyBase, status: "partial", diagnostics };
  }

  diagnostics.alignedPoints = alignment.stats.alignedCount;
  diagnostics.forwardFilledPoints = alignment.stats.forwardFilledCount;
  diagnostics.staleDroppedPoints = alignment.stats.staleDroppedCount;

  const anchorResolution = resolveSpreadAnchor(
    alignment.rows,
    alignment.points,
    anchorMode,
    { intervalMinutes },
  );
  const divergence = calculatePairDivergence(
    alignment.rows,
    pairKey,
    1,
    DEFAULT_PAIR_Z_WINDOW,
    divergenceOptionsFromResolution(anchorResolution),
  );

  if (!divergence) {
    return { ...emptyBase, status: "partial", diagnostics };
  }

  const points: WeeklySpreadPoint[] = [];
  for (let i = 0; i < alignment.rows.length; i++) {
    const row = alignment.rows[i]!;
    const sp = divergence.spread[i]!;
    if (!Number.isFinite(sp)) continue;
    points.push({
      timestamp: row.timestamp,
      minuteOfWeek: minuteOfWeekFromTimestamp(row.timestamp, week.weekStart),
      spreadPoints: sp,
      zScore: divergence.zScores[i] ?? null,
      leftMove: divergence.legA[i]!,
      rightMove: divergence.legB[i]!,
    });
  }

  const status: WeeklySpreadSeries["status"] =
    points.length >= 5 ? "ok" : points.length > 0 ? "partial" : "empty";

  return {
    weekStart: week.weekStart,
    weekLabel: week.weekLabel,
    pair: pairLabel,
    usedTickers: [leftTicker, rightTicker],
    anchorTime: anchorResolution.timestamp || null,
    points,
    status,
    diagnostics,
  };
}
