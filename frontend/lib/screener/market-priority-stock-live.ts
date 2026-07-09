/**
 * Stock screener In Play gate v0 — live confirmed signals without historical baseline.
 * @see docs/MARKET_PRIORITY_PAGE_MODEL.md § Stock Live v0
 */

import type { MarketPriorityMode } from "@/lib/screener/market-priority-presets";
import { STOCK_SCREENER_FOCUS_PRESETS } from "@/lib/screener/market-priority-presets";

const TRADABILITY_MIN = 50;

export type LiveInPlaySignals = {
  rangeSignal: boolean;
  moveSignal: boolean;
  participationSignal: boolean;
  activitySignal: boolean;
  baselineActivitySignal: boolean;
  fallbackActivitySignal: boolean;
  /** Passed focus gate (shown in Command Bar). */
  confirmedLiveInPlay: boolean;
  /** Eligible for table quick filter «В игре». */
  inPlayCandidate: boolean;
};

export type StockLiveFieldSlice = {
  secid: string;
  changePct: number | null;
  value: number | null;
  trades: number | null;
  rangePct: number | null;
  price: number | null;
  high: number | null;
  low: number | null;
  spreadPct: number | null;
  activityRatio: number | null;
  volumeRatio: number | null;
  tradesRatio: number | null;
  valueRatio: number | null;
  volumeToAvg: number | null;
  expectedVolumeRatio: number | null;
  relativeVolume: number | null;
};

const ACTIVITY_BASELINE_MIN = 1.8;
const ACTIVITY_BASELINE_STRONG = 2.5;
const RANGE_STRONG_PCT = 2.5;
const RANGE_MEDIUM_PCT = 1.5;
const RANGE_RANK_MEDIUM = 70;
const RANGE_LIQUID_PCT = 1.2;
const MOVE_STRONG_PCT = 1.2;
const MOVE_MEDIUM_PCT = 0.8;
const MOVE_RANK_MIN = 80;
const MOVE_RANGE_MIN = 1.2;
const CHANGE_LIQUID_MIN = 0.6;
const PARTICIPATION_VALUE_HIGH = 300_000_000;
const PARTICIPATION_TRADES_HIGH = 1000;
const PARTICIPATION_VALUE_MED = 100_000_000;
const PARTICIPATION_TRADES_MED = 500;
const PARTICIPATION_VALUE_RANK = 80;
const PARTICIPATION_TRADES_RANK = 70;
const FALLBACK_RANK_MIN = 85;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function collectBaselineRatios(f: StockLiveFieldSlice): number[] {
  return [
    f.activityRatio,
    f.volumeRatio,
    f.tradesRatio,
    f.valueRatio,
    f.volumeToAvg,
    f.expectedVolumeRatio,
    f.relativeVolume,
  ].filter((r): r is number => r != null && r > 0);
}

function isNearHighOrLow(f: StockLiveFieldSlice): boolean {
  const { price, high, low } = f;
  if (price == null || high == null || low == null) return false;
  const span = high - low;
  if (span <= 0) return false;
  const distToHigh = Math.abs(high - price) / span;
  const distToLow = Math.abs(price - low) / span;
  return distToHigh <= 0.15 || distToLow <= 0.15;
}

function isHighlyLiquid(f: StockLiveFieldSlice, valueRankScore: number): boolean {
  return (f.value ?? 0) >= PARTICIPATION_VALUE_HIGH || valueRankScore >= PARTICIPATION_VALUE_RANK;
}

export function evaluateLiveRangeSignal(f: StockLiveFieldSlice, rangeRankScore: number): boolean {
  const rangePct = Math.abs(f.rangePct ?? 0);
  if (rangePct >= RANGE_STRONG_PCT) return true;
  if (rangePct >= RANGE_MEDIUM_PCT && rangeRankScore >= RANGE_RANK_MEDIUM) return true;
  if (
    isHighlyLiquid(f, rangeRankScore) &&
    rangePct >= RANGE_LIQUID_PCT &&
    Math.abs(f.changePct ?? 0) >= CHANGE_LIQUID_MIN
  ) {
    return true;
  }
  return false;
}

export function evaluateLiveMoveSignal(
  f: StockLiveFieldSlice,
  absChangeRankScore: number,
): boolean {
  const absCh = Math.abs(f.changePct ?? 0);
  if (absCh >= MOVE_STRONG_PCT) return true;
  if (absCh >= MOVE_MEDIUM_PCT && isNearHighOrLow(f)) return true;
  if (absChangeRankScore >= MOVE_RANK_MIN && Math.abs(f.rangePct ?? 0) >= MOVE_RANGE_MIN) return true;
  return false;
}

export function evaluateLiveParticipationSignal(
  f: StockLiveFieldSlice,
  valueRankScore: number,
  tradesRankScore: number,
  rangeSignal: boolean,
): boolean {
  if ((f.value ?? 0) >= PARTICIPATION_VALUE_HIGH && (f.trades ?? 0) >= PARTICIPATION_TRADES_HIGH) {
    return true;
  }
  if (valueRankScore >= PARTICIPATION_VALUE_RANK && tradesRankScore >= PARTICIPATION_TRADES_RANK) {
    return true;
  }
  if (
    (f.value ?? 0) >= PARTICIPATION_VALUE_MED &&
    (f.trades ?? 0) >= PARTICIPATION_TRADES_MED &&
    rangeSignal
  ) {
    return true;
  }
  return false;
}

export function evaluateLiveActivitySignals(
  f: StockLiveFieldSlice,
  valueRankScore: number,
  tradesRankScore: number,
  rangeSignal: boolean,
  moveSignal: boolean,
): Pick<
  LiveInPlaySignals,
  "activitySignal" | "baselineActivitySignal" | "fallbackActivitySignal"
> {
  const ratios = collectBaselineRatios(f);
  if (ratios.length > 0) {
    const best = Math.max(...ratios);
    if (best >= ACTIVITY_BASELINE_MIN) {
      return {
        activitySignal: true,
        baselineActivitySignal: true,
        fallbackActivitySignal: false,
      };
    }
    return { activitySignal: false, baselineActivitySignal: false, fallbackActivitySignal: false };
  }

  const rankFallback = valueRankScore >= FALLBACK_RANK_MIN || tradesRankScore >= FALLBACK_RANK_MIN;
  if (rankFallback && (rangeSignal || moveSignal)) {
    return {
      activitySignal: true,
      baselineActivitySignal: false,
      fallbackActivitySignal: true,
    };
  }
  return { activitySignal: false, baselineActivitySignal: false, fallbackActivitySignal: false };
}

export function countLiveGateSignals(signals: LiveInPlaySignals): number {
  let n = 0;
  if (signals.rangeSignal) n++;
  if (signals.moveSignal) n++;
  if (signals.participationSignal) n++;
  if (signals.activitySignal) n++;
  return n;
}

export function isStockLiveInPlayCandidate(
  signals: LiveInPlaySignals,
  tradability: number,
  hasSoftRisk: boolean,
): boolean {
  if (tradability < TRADABILITY_MIN) return false;
  if (!signals.participationSignal) return false;
  if (!signals.rangeSignal && !signals.moveSignal) return false;
  if (countLiveGateSignals(signals) < 2) return false;
  void hasSoftRisk;
  return true;
}

export function computeStockLiveInPlayScore(input: {
  rangeSignal: boolean;
  moveSignal: boolean;
  participationSignal: boolean;
  activitySignal: boolean;
  rangeRankScore: number;
  absChangeRankScore: number;
  valueRankScore: number;
  tradesRankScore: number;
  activityScore: number;
  tradability: number;
  riskPenalty: number;
}): number {
  const rangeComponent = input.rangeSignal
    ? clampScore(Math.max(input.rangeRankScore, 55))
    : clampScore(input.rangeRankScore * 0.35);
  const moveComponent = input.moveSignal
    ? clampScore(Math.max(input.absChangeRankScore, 55))
    : clampScore(input.absChangeRankScore * 0.35);
  const participationComponent = input.participationSignal
    ? clampScore(input.valueRankScore * 0.55 + input.tradesRankScore * 0.45)
    : clampScore(input.valueRankScore * 0.2 + input.tradesRankScore * 0.15);
  const activityComponent = input.activitySignal ? clampScore(input.activityScore) : 0;

  return clampScore(
    0.3 * rangeComponent +
      0.25 * moveComponent +
      0.25 * participationComponent +
      0.15 * activityComponent +
      0.05 * input.tradability -
      input.riskPenalty,
  );
}

export function activityScoreFromBaseline(f: StockLiveFieldSlice): number {
  const ratios = collectBaselineRatios(f);
  if (ratios.length === 0) return 0;
  const best = Math.max(...ratios);
  if (best >= ACTIVITY_BASELINE_STRONG) return clampScore((best / ACTIVITY_BASELINE_STRONG) * 100);
  if (best >= ACTIVITY_BASELINE_MIN) return clampScore(55 + (best - ACTIVITY_BASELINE_MIN) * 25);
  return clampScore(best * 20);
}

export function passesStockLiveFocusGate(
  mode: MarketPriorityMode,
  riskReasons: Array<{ code: string }>,
): boolean {
  const preset = STOCK_SCREENER_FOCUS_PRESETS[mode];
  const blockingSoftRisk = riskReasons.some((r) => r.code !== "low_confidence");
  if (blockingSoftRisk && !preset.allowSoftRisk) return false;
  return true;
}

export function resolveStockLiveMaxFocus(mode: MarketPriorityMode): number {
  return STOCK_SCREENER_FOCUS_PRESETS[mode].maxFocus;
}
