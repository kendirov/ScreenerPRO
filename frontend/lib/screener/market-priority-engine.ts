/**
 * Market Priority Engine — ranking для верхней страницы /screener.
 * Спецификация: docs/MARKET_PRIORITY_PAGE_MODEL.md
 *
 * Gate order: hard exclude → tradable → soft risk mark → confirmed signals →
 * inPlay candidate → score (sort only) → display cap.
 */

import {
  DEFAULT_MARKET_PRIORITY_MODE,
  type MarketPriorityMode,
  resolveMarketPriorityPreset,
} from "@/lib/screener/market-priority-presets";
import {
  activityScoreFromBaseline,
  computeStockLiveInPlayScore,
  evaluateLiveActivitySignals,
  evaluateLiveMoveSignal,
  evaluateLiveParticipationSignal,
  evaluateLiveRangeSignal,
  isStockLiveInPlayCandidate,
  passesStockLiveFocusGate,
  resolveStockLiveMaxFocus,
  type LiveInPlaySignals,
} from "@/lib/screener/market-priority-stock-live";

export type { LiveInPlaySignals } from "@/lib/screener/market-priority-stock-live";

export type { MarketPriorityMode } from "@/lib/screener/market-priority-presets";
export {
  MARKET_PRIORITY_PRESETS,
  MARKET_PRIORITY_MODE_STORAGE_KEY,
  DEFAULT_MARKET_PRIORITY_MODE,
} from "@/lib/screener/market-priority-presets";

export type PriorityReasonSeverity = "neutral" | "info" | "attention" | "hot" | "risk";

export type ReasonStrength = "weak" | "strong";

export type ReasonFamily =
  | "abnormality"
  | "range"
  | "direction"
  | "participation"
  | "liquidity"
  | "risk"
  | "fallback";

export type PriorityReason = {
  code: string;
  label: string;
  value?: string | number;
  severity: PriorityReasonSeverity;
  family?: ReasonFamily;
  strength?: ReasonStrength;
};

export type ConfirmedSignals = {
  confirmedActivityShock: boolean;
  confirmedRangeExpansion: boolean;
  confirmedDirectionalPressure: boolean;
  confirmedParticipation: boolean;
  confirmedInPlay: boolean;
};

export type PriorityBucket = "liquidity" | "in_play" | "volatility" | "excluded";

export type PriorityInstrument<T = unknown> = {
  row: T;
  secid: string;
  shortName?: string;
  liquidityScore: number;
  inPlayScore: number;
  volatilityScore: number;
  bucket: PriorityBucket;
  reasons: PriorityReason[];
  riskReasons: PriorityReason[];
  isEligible: boolean;
  isHardExcluded: boolean;
  confidence: "high" | "medium" | "low";
  confirmed: ConfirmedSignals;
  live?: LiveInPlaySignals;
};

export type MarketPriorityResult<T = unknown> = {
  liquidityLeaders: PriorityInstrument<T>[];
  /** Focus block — top N by score after mode gate. */
  inPlayLeaders: PriorityInstrument<T>[];
  /** Alias for Command Bar — same as `inPlayLeaders`. */
  focusInPlayLeaders: PriorityInstrument<T>[];
  /** All inPlayCandidate rows (table filter «В игре»). */
  inPlayCandidateLeaders: PriorityInstrument<T>[];
  volatilityLeaders: PriorityInstrument<T>[];
  excluded: PriorityInstrument<T>[];
  all: PriorityInstrument<T>[];
  stats: {
    total: number;
    eligible: number;
    hardExcluded: number;
    softRisk: number;
    confirmedActivityCount: number;
    confirmedRangeCount: number;
    confirmedDirectionCount: number;
    confirmedParticipationCount: number;
    inPlayCandidates: number;
    finalInPlayCount: number;
    mode: MarketPriorityMode;
    fallbackOnlyRejected: number;
    liquidityCutoff: number;
    volatilityCutoff: number;
    /** stock-live-v0 diagnostics */
    tradableCount?: number;
    rangeSignalCount?: number;
    moveSignalCount?: number;
    participationSignalCount?: number;
    focusFinal?: number;
  };
};

export type MarketPriorityEngineVariant = "baseline-confirmed" | "stock-live-v0";

export type MarketPriorityOptions = {
  maxLiquidity?: number;
  maxInPlay?: number;
  maxVolatility?: number;
  mode?: MarketPriorityMode;
  /** stock-live-v0 — live signals for /screener/stocks; default keeps Market Lab gate. */
  variant?: MarketPriorityEngineVariant;
};

const ACTIVITY_RATIO_STRONG = 2.5;
const ACTIVITY_RATIO_MEDIUM = 1.8;
const RANGE_STRONG_PCT = 2.5;
const RANGE_MEDIUM_PCT = 1.5;
const RANGE_RANK_MEDIUM_MIN = 75;
const RANGE_MEDIAN_RATIO_MIN = 1.5;
const DIRECTION_MIN_CHANGE_PCT = 0.8;
const DIRECTION_STRONG_CHANGE_PCT = 2.0;
const PARTICIPATION_RANK_MIN = 75;

export const MARKET_PRIORITY_THRESHOLDS = {
  hardExclude: {
    minTrades: 10,
    minValueRub: 500_000,
    maxSpreadPct: 2.5,
    thinSpikeRangePct: 4,
    thinSpikeMaxTrades: 30,
  },
  softRisk: {
    minTrades: 50,
    minValueRub: 5_000_000,
    maxSpreadPct: 0.8,
    moveMinRangePct: 2.5,
    moveMaxTrades: 100,
  },
  inPlay: {
    tradabilityMin: 50,
  },
  volatility: {
    minScore: 65,
    minPercentile: 90,
    minRangePct: 2,
    minAbsChangePct: 1.5,
  },
  defaults: {
    maxLiquidity: 10,
    maxVolatility: 8,
    freshnessDefault: 30,
    spreadQualityUnknown: 50,
  },
} as const;

const EMPTY_CONFIRMED: ConfirmedSignals = {
  confirmedActivityShock: false,
  confirmedRangeExpansion: false,
  confirmedDirectionalPressure: false,
  confirmedParticipation: false,
  confirmedInPlay: false,
};

function emptyLiveSignals(): LiveInPlaySignals {
  return {
    rangeSignal: false,
    moveSignal: false,
    participationSignal: false,
    activitySignal: false,
    baselineActivitySignal: false,
    fallbackActivitySignal: false,
    confirmedLiveInPlay: false,
    inPlayCandidate: false,
  };
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function safeNormalizeRank(rank: number, total: number): number {
  if (!Number.isFinite(rank) || rank <= 0 || total <= 0) return 0;
  if (total <= 1) return rank === 1 ? 100 : 0;
  return clampScore(100 * (1 - (rank - 1) / Math.max(total - 1, 1)));
}

export function percentileRank(value: number, values: number[]): number {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0 || !Number.isFinite(value)) return 0;
  if (finite.length === 1) return value >= finite[0]! ? 100 : 0;

  const less = finite.filter((v) => v < value).length;
  const equal = finite.filter((v) => v === value).length;
  const avgRank = less + (equal > 0 ? (equal - 1) / 2 : 0);
  return clampScore((avgRank / Math.max(finite.length - 1, 1)) * 100);
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringValue(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function getAtPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function pickNumber(row: unknown, keys: string[]): number | null {
  for (const key of keys) {
    const parts = key.split(".");
    const val = getAtPath(row, parts);
    const n = toFiniteNumber(val);
    if (n != null) return n;
  }
  return null;
}

function pickString(row: unknown, keys: string[]): string | null {
  for (const key of keys) {
    const parts = key.split(".");
    const val = getAtPath(row, parts);
    const s = toStringValue(val);
    if (s != null) return s;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Row normalization
// ---------------------------------------------------------------------------

type NormalizedFields = {
  secid: string;
  shortName?: string;
  price: number | null;
  changePct: number | null;
  value: number | null;
  volume: number | null;
  trades: number | null;
  spreadPct: number | null;
  rangePct: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  prevClose: number | null;
  activityRatio: number | null;
  volumeRatio: number | null;
  tradesRatio: number | null;
  valueRatio: number | null;
  volumeToAvg: number | null;
  expectedVolumeRatio: number | null;
  relativeVolume: number | null;
  medianRangePct20d: number | null;
  freshnessSignal: number | null;
  velocity: number | null;
  sessionDelta: number | null;
  baselineReliable: boolean;
};

function normalizeFields<T>(row: T): NormalizedFields | null {
  const secid = pickString(row, ["secid", "ticker", "symbol"]);
  if (!secid) return null;

  const shortName =
    pickString(row, ["shortName", "name", "boardName"]) ?? undefined;

  let rangePct = pickNumber(row, [
    "rangePct",
    "metrics.dayRangePct",
    "dayRangePct",
    "intradayRangePct",
  ]);

  const high = pickNumber(row, ["high", "dayHigh"]);
  const low = pickNumber(row, ["low", "dayLow"]);
  const prevClose = pickNumber(row, ["prevClose", "previousClose", "metrics.previousClose"]);

  if (rangePct == null && high != null && low != null && prevClose != null && prevClose > 0) {
    rangePct = ((high - low) / prevClose) * 100;
  }

  const baselineKind = pickString(row, ["metrics.intradayBaselineKind", "intradayBaselineKind"]);
  const baselineReliableFlag = getAtPath(row, ["metrics", "baselineIsReliable"]);
  const baselineReliable =
    baselineKind === "intraday-ok" ||
    (baselineReliableFlag === true && baselineKind !== "rough-day-avg");

  return {
    secid: secid.toUpperCase(),
    shortName,
    price: pickNumber(row, ["last", "lastPrice", "price", "currentPrice"]),
    changePct: pickNumber(row, ["changePct", "changePercent", "percentChange", "change"]),
    value: pickNumber(row, ["value", "turnover", "tradedValue", "metrics.currentTurnoverRub"]),
    volume: pickNumber(row, ["volume"]),
    trades: pickNumber(row, ["trades", "tradesCount", "numTrades", "numtrades"]),
    spreadPct: pickNumber(row, ["spreadPct", "spreadPercent"]),
    rangePct,
    high,
    low,
    open: pickNumber(row, ["open"]),
    prevClose,
    activityRatio: pickNumber(row, ["activityRatio", "metrics.activityRatio"]),
    volumeRatio: pickNumber(row, [
      "volumeRatio",
      "metrics.volumeRatioNow",
      "metrics.volumeRatio",
      "volumeToAvg",
    ]),
    tradesRatio: pickNumber(row, ["tradesRatio", "metrics.tradesRatioNow", "metrics.tradesVsAverage"]),
    valueRatio: pickNumber(row, ["valueRatio", "metrics.turnoverVsAverage", "metrics.turnoverRatio"]),
    volumeToAvg: pickNumber(row, ["volumeToAvg", "metrics.volumeToAvg"]),
    expectedVolumeRatio: pickNumber(row, ["expectedVolumeRatio", "metrics.expectedVolumeRatio"]),
    relativeVolume: pickNumber(row, ["relativeVolume", "metrics.relativeVolume"]),
    medianRangePct20d: pickNumber(row, [
      "metrics.rangeAveragePct",
      "metrics.medianRangePct20d",
      "rangeAveragePct",
    ]),
    freshnessSignal: pickNumber(row, ["freshness", "velocity", "sessionDelta", "metrics.sessionProgress"]),
    velocity: pickNumber(row, ["velocity", "changeVelocity"]),
    sessionDelta: pickNumber(row, ["sessionDelta"]),
    baselineReliable,
  };
}

type SignalStrength = "none" | "medium" | "strong";

type ActivitySignal = {
  score: number;
  confirmed: boolean;
  strength: SignalStrength;
  isFallback: boolean;
  bestRatio: number | null;
};

type RangeSignal = {
  score: number;
  confirmed: boolean;
  strength: SignalStrength;
};

type DirectionSignal = {
  score: number;
  confirmed: boolean;
  strength: SignalStrength;
  nearExtreme: boolean;
};

type ParticipationSignal = {
  score: number;
  confirmed: boolean;
  strength: SignalStrength;
};

type InternalScores = {
  valueRankScore: number;
  tradesRankScore: number;
  volumeRankScore: number;
  rangeRankScore: number;
  absChangeRankScore: number;
  spreadQualityScore: number;
  activityShock: number;
  rangeExpansion: number;
  turnoverParticipation: number;
  directionalPressure: number;
  tradability: number;
  freshness: number;
  proximityToExtreme: number;
  penalties: number;
  liquidityRiskPenalty: number;
  activity: ActivitySignal;
  range: RangeSignal;
  direction: DirectionSignal;
  participation: ParticipationSignal;
};

type HardExcludeResult = {
  excluded: boolean;
  codes: string[];
};

function evaluateHardExclude(f: NormalizedFields): HardExcludeResult {
  const t = MARKET_PRIORITY_THRESHOLDS.hardExclude;
  const codes: string[] = [];

  if (f.price == null || f.price <= 0) codes.push("no_price");
  if ((f.trades ?? 0) < t.minTrades) codes.push("low_trades");
  if ((f.value ?? 0) < t.minValueRub) codes.push("low_value");
  if (f.spreadPct != null && f.spreadPct > t.maxSpreadPct) codes.push("wide_spread");
  if (
    (f.rangePct ?? 0) > t.thinSpikeRangePct &&
    (f.trades ?? 0) < t.thinSpikeMaxTrades
  ) {
    codes.push("thin_spike");
  }

  return { excluded: codes.length > 0, codes };
}

function spreadQualityScore(spreadPct: number | null): number {
  const unknown = MARKET_PRIORITY_THRESHOLDS.defaults.spreadQualityUnknown;
  if (spreadPct == null) return unknown;
  if (spreadPct <= 0.3) return 100;
  if (spreadPct >= 1.5) return 0;
  return clampScore(100 * (1 - (spreadPct - 0.3) / 1.2));
}

/** Real ratio/baseline fields only — not cross-sectional rank. */
function collectBaselineRatioFields(f: NormalizedFields): number[] {
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

function evaluateActivitySignal(
  f: NormalizedFields,
  crossSectionalRank: number,
): ActivitySignal {
  const ratios = collectBaselineRatioFields(f);

  if (ratios.length > 0) {
    const best = Math.max(...ratios);
    let strength: SignalStrength = "none";
    if (best >= ACTIVITY_RATIO_STRONG) strength = "strong";
    else if (best >= ACTIVITY_RATIO_MEDIUM) strength = "medium";

    const score =
      strength === "strong"
        ? clampScore((best / ACTIVITY_RATIO_STRONG) * 100)
        : strength === "medium"
          ? clampScore(55 + (best - ACTIVITY_RATIO_MEDIUM) * 25)
          : clampScore(best * 20);

    return {
      score,
      confirmed: strength !== "none",
      strength,
      isFallback: false,
      bestRatio: best,
    };
  }

  const weakScore = clampScore(crossSectionalRank * 0.45);
  return {
    score: weakScore,
    confirmed: false,
    strength: "none",
    isFallback: true,
    bestRatio: null,
  };
}

function evaluateRangeSignal(f: NormalizedFields, rangeRankScore: number): RangeSignal {
  const range = f.rangePct;
  if (range == null || !Number.isFinite(range)) {
    return { score: clampScore(rangeRankScore * 0.25), confirmed: false, strength: "none" };
  }

  const absRange = Math.abs(range);
  let strength: SignalStrength = "none";

  if (absRange >= RANGE_STRONG_PCT) {
    strength = "strong";
  } else if (absRange >= RANGE_MEDIUM_PCT && rangeRankScore >= RANGE_RANK_MEDIUM_MIN) {
    strength = "medium";
  }

  if (
    strength === "none" &&
    f.medianRangePct20d != null &&
    f.medianRangePct20d > 0 &&
    absRange / f.medianRangePct20d >= RANGE_MEDIAN_RATIO_MIN
  ) {
    strength = "medium";
  }

  const score =
    strength === "strong"
      ? clampScore(70 + Math.min(absRange - RANGE_STRONG_PCT, 3) * 10)
      : strength === "medium"
        ? clampScore(55 + (absRange - RANGE_MEDIUM_PCT) * 12)
        : clampScore(rangeRankScore * 0.35);

  return { score, confirmed: strength !== "none", strength };
}

function proximityToExtreme(f: NormalizedFields): number {
  const { price, high, low } = f;
  if (price == null || high == null || low == null) return 0;
  const span = high - low;
  if (span <= 0) return 0;

  const distToHigh = Math.abs(high - price) / span;
  const distToLow = Math.abs(price - low) / span;
  const nearThreshold = 0.0035;

  if (distToHigh <= nearThreshold || distToLow <= nearThreshold) return 100;
  if (distToHigh <= 0.15 || distToLow <= 0.15) return 75;
  return 0;
}

function isNearHighOrLow(f: NormalizedFields): boolean {
  return proximityToExtreme(f) >= 75;
}

function evaluateDirectionSignal(
  f: NormalizedFields,
  rangeConfirmed: boolean,
  absChangeRankScore: number,
): DirectionSignal {
  const absCh = Math.abs(f.changePct ?? 0);
  const nearExtreme = isNearHighOrLow(f);
  const confirmed = nearExtreme && rangeConfirmed && absCh >= DIRECTION_MIN_CHANGE_PCT;

  let strength: SignalStrength = "none";
  if (confirmed && absCh >= DIRECTION_STRONG_CHANGE_PCT && nearExtreme) {
    strength = "strong";
  } else if (confirmed) {
    strength = "medium";
  }

  let score = absChangeRankScore * 0.4;
  if (nearExtreme) score = Math.max(score, 70);
  if (confirmed) score = Math.max(score, 62);
  if (strength === "strong") score = Math.max(score, 80);

  return { score: clampScore(score), confirmed, strength, nearExtreme };
}

function evaluateParticipationSignal(
  f: NormalizedFields,
  valueRankScore: number,
  tradesRankScore: number,
  hasSoftRisk: boolean,
  activityConfirmed: boolean,
  rangeConfirmed: boolean,
  directionConfirmed: boolean,
  hasStrongCoreSignal: boolean,
): ParticipationSignal {
  const rankHigh =
    valueRankScore >= PARTICIPATION_RANK_MIN && tradesRankScore >= PARTICIPATION_RANK_MIN;
  const hasSignal = activityConfirmed || rangeConfirmed || directionConfirmed;
  const confirmed = rankHigh && !hasSoftRisk && hasSignal;

  let strength: SignalStrength = "none";
  if (confirmed && hasStrongCoreSignal) {
    strength = "strong";
  } else if (confirmed) {
    strength = "medium";
  }

  const score = confirmed
    ? clampScore(valueRankScore * 0.55 + tradesRankScore * 0.45)
    : clampScore(valueRankScore * 0.25 + tradesRankScore * 0.15);

  return { score, confirmed, strength };
}

function computeFreshness(f: NormalizedFields): number {
  const def = MARKET_PRIORITY_THRESHOLDS.defaults.freshnessDefault;
  if (f.velocity != null && Number.isFinite(f.velocity)) {
    return clampScore(clamp01(f.velocity) * 100);
  }
  if (f.sessionDelta != null && Number.isFinite(f.sessionDelta)) {
    return clampScore(clamp01(f.sessionDelta) * 100);
  }
  if (f.freshnessSignal != null && f.freshnessSignal > 0 && f.freshnessSignal <= 1) {
    return clampScore(f.freshnessSignal * 100);
  }
  return def;
}

function computePenalties(
  f: NormalizedFields,
  confidence: "high" | "medium" | "low",
): number {
  const sr = MARKET_PRIORITY_THRESHOLDS.softRisk;
  let p = 0;
  if (f.spreadPct != null && f.spreadPct > sr.maxSpreadPct) p += 15;
  if ((f.trades ?? 0) < sr.minTrades) p += 20;
  if ((f.value ?? 0) < sr.minValueRub) p += 25;
  if ((f.rangePct ?? 0) > 4 && (f.trades ?? 0) < 50) p += 30;
  if (confidence === "low") p += 10;
  return p;
}

function liquidityRiskPenalty(f: NormalizedFields, hasSoftRisk: boolean): number {
  let p = 0;
  if (hasSoftRisk) p += 15;
  if ((f.trades ?? 0) < 30) p += 25;
  if ((f.value ?? 0) < 1_000_000) p += 30;
  if (f.spreadPct != null && f.spreadPct > 1.2) p += 20;
  return p;
}

function resolveConfidence(f: NormalizedFields): "high" | "medium" | "low" {
  const hasReliableRatio =
    f.baselineReliable &&
    ((f.volumeRatio != null && f.volumeRatio > 0) ||
      (f.tradesRatio != null && f.tradesRatio > 0));

  if (hasReliableRatio) return "high";

  if (collectBaselineRatioFields(f).length > 0) return "medium";

  return "low";
}

function signalStrengthToReasonStrength(s: SignalStrength): ReasonStrength | undefined {
  if (s === "strong") return "strong";
  return undefined;
}

function buildConfirmedSignals(
  activity: ActivitySignal,
  range: RangeSignal,
  direction: DirectionSignal,
  participation: ParticipationSignal,
): ConfirmedSignals {
  return {
    confirmedActivityShock: activity.confirmed,
    confirmedRangeExpansion: range.confirmed,
    confirmedDirectionalPressure: direction.confirmed,
    confirmedParticipation: participation.confirmed,
    confirmedInPlay: false,
  };
}

function countConfirmedSignals(c: ConfirmedSignals): number {
  let n = 0;
  if (c.confirmedActivityShock) n++;
  if (c.confirmedRangeExpansion) n++;
  if (c.confirmedDirectionalPressure) n++;
  if (c.confirmedParticipation) n++;
  return n;
}

function buildReasons(
  f: NormalizedFields,
  scores: InternalScores,
  confidence: "high" | "medium" | "low",
): PriorityReason[] {
  const reasons: PriorityReason[] = [];

  if (scores.valueRankScore >= 65) {
    reasons.push({
      code: "money_in_stock",
      label: "Деньги в бумаге",
      value: f.value != null ? Math.round(f.value / 1_000_000) : undefined,
      severity: "info",
      family: "liquidity",
      strength: "weak",
    });
  }
  if (scores.tradesRankScore >= 65) {
    reasons.push({
      code: "many_trades",
      label: "Много сделок",
      value: f.trades ?? undefined,
      severity: "info",
      family: "liquidity",
      strength: "weak",
    });
  }

  const act = scores.activity;
  if (act.confirmed) {
    const rs = signalStrengthToReasonStrength(act.strength);
    if (rs) {
      reasons.push({
        code: "activity_shock_confirmed",
        label: "Активность выше нормы",
        value: act.bestRatio != null ? `${act.bestRatio.toFixed(1)}x` : undefined,
        severity: "hot",
        family: "abnormality",
        strength: rs,
      });
    }
  } else if (act.isFallback && act.score >= 30) {
    reasons.push({
      code: "activity_fallback",
      label: "Оценка активности",
      severity: "attention",
      family: "fallback",
      strength: "weak",
    });
  }

  const rng = scores.range;
  if (rng.confirmed) {
    const rs = signalStrengthToReasonStrength(rng.strength);
    if (rs) {
      reasons.push({
        code: "range_expansion_confirmed",
        label: "Диапазон расширен",
        value: f.rangePct != null ? `${f.rangePct.toFixed(1)}%` : undefined,
        severity: "attention",
        family: "range",
        strength: rs,
      });
    }
  }

  const dir = scores.direction;
  if (dir.confirmed && f.price != null && f.high != null && f.low != null) {
    const rs = signalStrengthToReasonStrength(dir.strength);
    if (rs) {
      const distHigh = Math.abs(f.high - f.price);
      const distLow = Math.abs(f.price - f.low);
      reasons.push({
        code: "directional_pressure_confirmed",
        label: distHigh <= distLow ? "У high дня" : "У low дня",
        value:
          f.changePct != null
            ? `${f.changePct > 0 ? "+" : ""}${f.changePct.toFixed(1)}%`
            : undefined,
        severity: "hot",
        family: "direction",
        strength: rs,
      });
    }
  }

  const part = scores.participation;
  if (part.confirmed) {
    const rs = signalStrengthToReasonStrength(part.strength);
    if (rs) {
      reasons.push({
        code: "turnover_participation_confirmed",
        label: "Участие подтверждено",
        value: f.value != null ? Math.round(f.value / 1_000_000) : undefined,
        severity: "info",
        family: "participation",
        strength: rs,
      });
    }
  }

  if (f.spreadPct != null) {
    if (f.spreadPct <= 0.8) {
      reasons.push({
        code: "spread_ok",
        label: "Спред ок",
        value: `${f.spreadPct.toFixed(2)}%`,
        severity: "neutral",
        family: "liquidity",
        strength: "weak",
      });
    } else if (f.spreadPct > MARKET_PRIORITY_THRESHOLDS.softRisk.maxSpreadPct) {
      reasons.push({
        code: "wide_spread",
        label: "Широкий спред",
        value: `${f.spreadPct.toFixed(2)}%`,
        severity: "risk",
        family: "risk",
        strength: "weak",
      });
    }
  }

  if (confidence === "low") {
    reasons.push({
      code: "low_confidence",
      label: "Низкая уверенность",
      severity: "attention",
      family: "fallback",
      strength: "weak",
    });
  }

  return reasons;
}

function evaluateSoftRisk(
  f: NormalizedFields,
  confidence: "high" | "medium" | "low",
): PriorityReason[] {
  const sr = MARKET_PRIORITY_THRESHOLDS.softRisk;
  const risks: PriorityReason[] = [];

  if ((f.trades ?? 0) < sr.minTrades) {
    risks.push({
      code: "low_trades",
      label: "Мало сделок",
      value: f.trades ?? 0,
      severity: "risk",
      family: "risk",
      strength: "weak",
    });
  }
  if ((f.value ?? 0) < sr.minValueRub) {
    risks.push({
      code: "low_value",
      label: "Тонкий оборот",
      value: Math.round((f.value ?? 0) / 1_000_000),
      severity: "risk",
      family: "risk",
      strength: "weak",
    });
  }
  if (f.spreadPct != null && f.spreadPct > sr.maxSpreadPct) {
    risks.push({
      code: "wide_spread",
      label: "Широкий спред",
      value: `${f.spreadPct.toFixed(2)}%`,
      severity: "risk",
      family: "risk",
      strength: "weak",
    });
  }
  if (
    (f.rangePct ?? 0) >= sr.moveMinRangePct &&
    (f.trades ?? 0) < sr.moveMaxTrades
  ) {
    risks.push({
      code: "thin_move",
      label: "Тонкий прострел",
      value: `${(f.rangePct ?? 0).toFixed(1)}%`,
      severity: "risk",
      family: "risk",
      strength: "weak",
    });
  }
  if (confidence === "low") {
    risks.push({
      code: "low_confidence",
      label: "Низкая уверенность",
      severity: "attention",
      family: "fallback",
      strength: "weak",
    });
  }

  return risks;
}

function buildDescRankMap(ids: string[], values: number[]): Map<string, number> {
  const pairs = ids
    .map((id, i) => ({ id, value: values[i] ?? 0 }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => b.value - a.value);

  const ranks = new Map<string, number>();
  pairs.forEach((p, i) => ranks.set(p.id, i + 1));
  for (const id of ids) {
    if (!ranks.has(id)) ranks.set(id, ids.length);
  }
  return ranks;
}

function crossSectionalActivityRank(
  valueScores: number[],
  tradesScores: number[],
  volumeScores: number[],
  idx: number,
): number {
  return clampScore((valueScores[idx]! + tradesScores[idx]! + volumeScores[idx]!) / 3);
}

function assignPrimaryBucket(
  isHardExcluded: boolean,
  inPlay: boolean,
  volatility: boolean,
  liquidity: boolean,
): PriorityBucket {
  if (isHardExcluded) return "excluded";
  if (inPlay) return "in_play";
  if (volatility) return "volatility";
  if (liquidity) return "liquidity";
  return "liquidity";
}

function passesInPlayCandidateGate(
  confirmed: ConfirmedSignals,
  hasSoftRisk: boolean,
  tradability: number,
  preset: ReturnType<typeof resolveMarketPriorityPreset>,
  activityFallbackOnly: boolean,
): boolean {
  if (tradability < MARKET_PRIORITY_THRESHOLDS.inPlay.tradabilityMin) return false;
  if (hasSoftRisk && !preset.allowSoftRisk) return false;

  if (activityFallbackOnly && !confirmed.confirmedActivityShock) {
    return false;
  }

  const confirmedCount = countConfirmedSignals(confirmed);
  if (confirmedCount < preset.minConfirmedSignals) return false;

  const hasCore =
    confirmed.confirmedActivityShock || confirmed.confirmedRangeExpansion;

  if (preset.requireActivityOrRange && !hasCore) return false;

  if (
    preset.allowDirectionParticipationPair &&
    !preset.requireActivityOrRange &&
    !hasCore
  ) {
    const dirPart =
      confirmed.confirmedDirectionalPressure && confirmed.confirmedParticipation;
    if (!dirPart) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function computeMarketPriority<T>(
  rows: T[],
  options?: MarketPriorityOptions,
): MarketPriorityResult<T> {
  const mode = options?.mode ?? DEFAULT_MARKET_PRIORITY_MODE;
  const variant = options?.variant ?? "baseline-confirmed";
  const isStockLive = variant === "stock-live-v0";
  const inPlayPreset = resolveMarketPriorityPreset(mode);
  const maxLiquidity = options?.maxLiquidity ?? MARKET_PRIORITY_THRESHOLDS.defaults.maxLiquidity;
  const hardCapInPlay = isStockLive
    ? resolveStockLiveMaxFocus(mode)
    : inPlayPreset.maxInPlay;
  const maxInPlay = Math.min(options?.maxInPlay ?? hardCapInPlay, hardCapInPlay);
  const maxVolatility = options?.maxVolatility ?? MARKET_PRIORITY_THRESHOLDS.defaults.maxVolatility;

  type Working = {
    row: T;
    fields: NormalizedFields;
    hard: HardExcludeResult;
    confidence: "high" | "medium" | "low";
    scores: InternalScores;
    confirmed: ConfirmedSignals;
    live: LiveInPlaySignals;
    riskReasons: PriorityReason[];
    liquidityScore: number;
    inPlayScore: number;
    volatilityScore: number;
    reasons: PriorityReason[];
  };

  const normalized: Working[] = [];
  const noSecidExcluded: PriorityInstrument<T>[] = [];

  for (const row of rows) {
    const fields = normalizeFields(row);
    if (!fields) {
      noSecidExcluded.push({
        row,
        secid: "?",
        liquidityScore: 0,
        inPlayScore: 0,
        volatilityScore: 0,
        bucket: "excluded",
        reasons: [{ code: "no_secid", label: "Нет тикера", severity: "risk" }],
        riskReasons: [],
        isEligible: false,
        isHardExcluded: true,
        confidence: "low",
        confirmed: { ...EMPTY_CONFIRMED },
        live: emptyLiveSignals(),
      });
      continue;
    }

    normalized.push({
      row,
      fields,
      hard: { excluded: false, codes: [] },
      confidence: "low",
      scores: {} as InternalScores,
      confirmed: { ...EMPTY_CONFIRMED },
      live: emptyLiveSignals(),
      riskReasons: [],
      liquidityScore: 0,
      inPlayScore: 0,
      volatilityScore: 0,
      reasons: [],
    });
  }

  const ids = normalized.map((w) => w.fields.secid);

  const values = normalized.map((w) => w.fields.value ?? 0);
  const tradesArr = normalized.map((w) => w.fields.trades ?? 0);
  const volumes = normalized.map((w) => w.fields.volume ?? 0);
  const ranges = normalized.map((w) => Math.abs(w.fields.rangePct ?? 0));
  const absChanges = normalized.map((w) => Math.abs(w.fields.changePct ?? 0));

  const valueRankMap = buildDescRankMap(ids, values);
  const tradesRankMap = buildDescRankMap(ids, tradesArr);
  const volumeRankMap = buildDescRankMap(ids, volumes);
  const rangeRankMap = buildDescRankMap(ids, ranges);
  const absChangeRankMap = buildDescRankMap(ids, absChanges);

  const valueRankScores = ids.map((id) => safeNormalizeRank(valueRankMap.get(id) ?? ids.length, ids.length));
  const tradesRankScores = ids.map((id) => safeNormalizeRank(tradesRankMap.get(id) ?? ids.length, ids.length));
  const volumeRankScores = ids.map((id) => safeNormalizeRank(volumeRankMap.get(id) ?? ids.length, ids.length));
  const rangeRankScores = ids.map((id) => safeNormalizeRank(rangeRankMap.get(id) ?? ids.length, ids.length));
  const absChangeRankScores = ids.map((id) =>
    safeNormalizeRank(absChangeRankMap.get(id) ?? ids.length, ids.length),
  );

  let fallbackOnlyRejected = 0;

  for (let i = 0; i < normalized.length; i++) {
    const w = normalized[i]!;
    const f = w.fields;
    w.hard = evaluateHardExclude(f);
    w.confidence = resolveConfidence(f);

    const spreadQ = spreadQualityScore(f.spreadPct);
    const crossRank = crossSectionalActivityRank(
      valueRankScores,
      tradesRankScores,
      volumeRankScores,
      i,
    );

    const activity = evaluateActivitySignal(f, crossRank);
    const range = evaluateRangeSignal(f, rangeRankScores[i]!);

    w.riskReasons = evaluateSoftRisk(f, w.confidence);
    const hasSoftRisk = w.riskReasons.length > 0;

    const direction = evaluateDirectionSignal(f, range.confirmed, absChangeRankScores[i]!);

    const hasStrongCore =
      activity.strength === "strong" ||
      range.strength === "strong" ||
      direction.strength === "strong";

    const participation = evaluateParticipationSignal(
      f,
      valueRankScores[i]!,
      tradesRankScores[i]!,
      hasSoftRisk,
      activity.confirmed,
      range.confirmed,
      direction.confirmed,
      hasStrongCore,
    );

    const tradability = clampScore(
      spreadQ * 0.25 + tradesRankScores[i]! * 0.4 + valueRankScores[i]! * 0.35,
    );
    const freshness = computeFreshness(f);
    const proximity = proximityToExtreme(f);
    const penalties = computePenalties(f, w.confidence);

    const scores: InternalScores = {
      valueRankScore: valueRankScores[i]!,
      tradesRankScore: tradesRankScores[i]!,
      volumeRankScore: volumeRankScores[i]!,
      rangeRankScore: rangeRankScores[i]!,
      absChangeRankScore: absChangeRankScores[i]!,
      spreadQualityScore: spreadQ,
      activityShock: activity.score,
      rangeExpansion: range.score,
      turnoverParticipation: participation.score,
      directionalPressure: direction.score,
      tradability,
      freshness,
      proximityToExtreme: proximity,
      penalties,
      liquidityRiskPenalty: 0,
      activity,
      range,
      direction,
      participation,
    };

    w.scores = scores;
    w.confirmed = buildConfirmedSignals(activity, range, direction, participation);

    w.liquidityScore = clampScore(
      0.55 * valueRankScores[i]! +
        0.25 * tradesRankScores[i]! +
        0.15 * volumeRankScores[i]! +
        0.05 * spreadQ,
    );

    w.inPlayScore = clampScore(
      0.35 * activity.score +
        0.25 * range.score +
        0.15 * participation.score +
        0.1 * direction.score +
        0.1 * tradability +
        0.05 * freshness -
        penalties,
    );

    scores.liquidityRiskPenalty = liquidityRiskPenalty(f, hasSoftRisk);

    w.volatilityScore = clampScore(
      0.45 * rangeRankScores[i]! +
        0.2 * absChangeRankScores[i]! +
        0.15 * activity.score +
        0.1 * proximity +
        0.1 * freshness -
        scores.liquidityRiskPenalty,
    );

    w.reasons = buildReasons(f, scores, w.confidence);

    if (isStockLive) {
      const rangeSignal = evaluateLiveRangeSignal(f, rangeRankScores[i]!);
      const moveSignal = evaluateLiveMoveSignal(f, absChangeRankScores[i]!);
      const participationSignal = evaluateLiveParticipationSignal(
        f,
        valueRankScores[i]!,
        tradesRankScores[i]!,
        rangeSignal,
      );
      const activityParts = evaluateLiveActivitySignals(
        f,
        valueRankScores[i]!,
        tradesRankScores[i]!,
        rangeSignal,
        moveSignal,
      );
      w.live = {
        rangeSignal,
        moveSignal,
        participationSignal,
        ...activityParts,
        confirmedLiveInPlay: false,
        inPlayCandidate: false,
      };
      w.inPlayScore = computeStockLiveInPlayScore({
        rangeSignal,
        moveSignal,
        participationSignal,
        activitySignal: activityParts.activitySignal,
        rangeRankScore: rangeRankScores[i]!,
        absChangeRankScore: absChangeRankScores[i]!,
        valueRankScore: valueRankScores[i]!,
        tradesRankScore: tradesRankScores[i]!,
        activityScore: activityParts.baselineActivitySignal
          ? activityScoreFromBaseline(f)
          : activityParts.fallbackActivitySignal
            ? clampScore((valueRankScores[i]! + tradesRankScores[i]!) / 2)
            : 0,
        tradability,
        riskPenalty: w.riskReasons.length > 0 ? 15 : 0,
      });
    }
  }

  const eligibleWork = normalized.filter((w) => !w.hard.excluded);
  const hardExcludedWork = normalized.filter((w) => w.hard.excluded);

  const volatilityScoresEligible = eligibleWork.map((w) => w.volatilityScore);
  const liquidityScoresEligible = eligibleWork.map((w) => w.liquidityScore);

  const liquidityCutoff =
    liquidityScoresEligible.length > 0
      ? [...liquidityScoresEligible].sort((a, b) => b - a)[
          Math.min(maxLiquidity - 1, liquidityScoresEligible.length - 1)
        ] ?? 0
      : 0;
  const volatilityCutoff = MARKET_PRIORITY_THRESHOLDS.volatility.minScore;

  let confirmedActivityCount = 0;
  let confirmedRangeCount = 0;
  let confirmedDirectionCount = 0;
  let confirmedParticipationCount = 0;
  let softRiskCount = 0;
  let rangeSignalCount = 0;
  let moveSignalCount = 0;
  let participationSignalCount = 0;
  let tradableCount = 0;

  const inPlayCandidatePool: Working[] = [];

  for (const w of eligibleWork) {
    if (w.confirmed.confirmedActivityShock) confirmedActivityCount++;
    if (w.confirmed.confirmedRangeExpansion) confirmedRangeCount++;
    if (w.confirmed.confirmedDirectionalPressure) confirmedDirectionCount++;
    if (w.confirmed.confirmedParticipation) confirmedParticipationCount++;
    if (w.riskReasons.length > 0) softRiskCount++;
    if (w.scores.tradability >= MARKET_PRIORITY_THRESHOLDS.inPlay.tradabilityMin) tradableCount++;

    if (isStockLive) {
      if (w.live.rangeSignal) rangeSignalCount++;
      if (w.live.moveSignal) moveSignalCount++;
      if (w.live.participationSignal) participationSignalCount++;

      const candidate = isStockLiveInPlayCandidate(
        w.live,
        w.scores.tradability,
        w.riskReasons.length > 0,
      );
      w.live.inPlayCandidate = candidate;
      if (candidate) {
        inPlayCandidatePool.push(w);
      }
      continue;
    }

    const activityFallbackOnly =
      w.scores.activity.isFallback && !w.confirmed.confirmedActivityShock;

    if (
      passesInPlayCandidateGate(
        w.confirmed,
        w.riskReasons.length > 0,
        w.scores.tradability,
        inPlayPreset,
        activityFallbackOnly,
      )
    ) {
      w.confirmed.confirmedInPlay = true;
      inPlayCandidatePool.push(w);
    } else if (activityFallbackOnly && countConfirmedSignals(w.confirmed) >= 1) {
      fallbackOnlyRejected++;
    }
  }

  inPlayCandidatePool.sort((a, b) => b.inPlayScore - a.inPlayScore);

  let inPlayCandidatesWork: Working[];
  if (isStockLive) {
    const focusPool = inPlayCandidatePool.filter((w) =>
      passesStockLiveFocusGate(mode, w.riskReasons),
    );
    inPlayCandidatesWork = focusPool.slice(0, maxInPlay);
    for (const w of inPlayCandidatesWork) {
      w.live.confirmedLiveInPlay = true;
      w.confirmed.confirmedInPlay = true;
    }
  } else {
    inPlayCandidatesWork = inPlayCandidatePool.slice(0, maxInPlay);
    for (const w of inPlayCandidatesWork) {
      w.confirmed.confirmedInPlay = true;
    }
  }

  const inPlayCandidateLeadersWork = isStockLive ? [...inPlayCandidatePool] : inPlayCandidatePool;
  const finalInPlayCount = inPlayCandidatesWork.length;
  const inPlaySet = new Set(inPlayCandidatesWork.map((w) => w.fields.secid));

  const liquidityLeadersWork = [...eligibleWork]
    .sort((a, b) => b.liquidityScore - a.liquidityScore)
    .slice(0, maxLiquidity);

  const liquiditySet = new Set(liquidityLeadersWork.map((w) => w.fields.secid));

  const volatilityCandidates = eligibleWork.filter((w) => {
    if (inPlaySet.has(w.fields.secid)) return false;
    const range = Math.abs(w.fields.rangePct ?? 0);
    const absCh = Math.abs(w.fields.changePct ?? 0);
    const hasMove =
      range >= MARKET_PRIORITY_THRESHOLDS.volatility.minRangePct ||
      absCh >= MARKET_PRIORITY_THRESHOLDS.volatility.minAbsChangePct;
    if (!hasMove) return false;
    const volPct = percentileRank(w.volatilityScore, volatilityScoresEligible);
    const passesScore =
      w.volatilityScore >= volatilityCutoff ||
      volPct >= MARKET_PRIORITY_THRESHOLDS.volatility.minPercentile;
    if (!passesScore) return false;
    if (w.riskReasons.length === 0 && w.volatilityScore < volatilityCutoff) return false;
    return true;
  });

  volatilityCandidates.sort((a, b) => b.volatilityScore - a.volatilityScore);
  const volatilityLeadersWork = volatilityCandidates.slice(0, maxVolatility);
  const volatilitySet = new Set(volatilityLeadersWork.map((w) => w.fields.secid));

  function toInstrument(
    w: Working,
    bucket: PriorityBucket,
    inPlay: boolean,
    volatility: boolean,
    liquidity: boolean,
  ): PriorityInstrument<T> {
    return {
      row: w.row,
      secid: w.fields.secid,
      shortName: w.fields.shortName,
      liquidityScore: w.liquidityScore,
      inPlayScore: w.inPlayScore,
      volatilityScore: w.volatilityScore,
      bucket: assignPrimaryBucket(w.hard.excluded, inPlay, volatility, liquidity),
      reasons: w.reasons,
      riskReasons: w.riskReasons,
      isEligible: !w.hard.excluded,
      isHardExcluded: w.hard.excluded,
      confidence: w.confidence,
      confirmed: { ...w.confirmed, confirmedInPlay: inPlay || w.live.inPlayCandidate },
      live: isStockLive ? { ...w.live, confirmedLiveInPlay: inPlay } : undefined,
    };
  }

  const inPlayLeaders = inPlayCandidatesWork.map((w) =>
    toInstrument(w, "in_play", true, false, liquiditySet.has(w.fields.secid)),
  );

  const inPlayCandidateLeaders = inPlayCandidateLeadersWork.map((w) =>
    toInstrument(
      w,
      inPlaySet.has(w.fields.secid) ? "in_play" : "liquidity",
      inPlaySet.has(w.fields.secid),
      volatilitySet.has(w.fields.secid),
      liquiditySet.has(w.fields.secid),
    ),
  );

  const liquidityLeaders = liquidityLeadersWork.map((w) =>
    toInstrument(
      w,
      "liquidity",
      inPlaySet.has(w.fields.secid),
      volatilitySet.has(w.fields.secid),
      true,
    ),
  );

  const volatilityLeaders = volatilityLeadersWork.map((w) =>
    toInstrument(w, "volatility", false, true, liquiditySet.has(w.fields.secid)),
  );

  const excluded = [
    ...hardExcludedWork.map((w) => {
      const inst = toInstrument(w, "excluded", false, false, false);
      inst.reasons = w.hard.codes.map((code) => ({
        code,
        label:
          code === "no_price"
            ? "Нет цены"
            : code === "low_trades"
              ? "Мало сделок"
              : code === "low_value"
                ? "Низкий оборот"
                : code === "wide_spread"
                  ? "Широкий спред"
                  : code === "thin_spike"
                    ? "Тонкий прострел"
                    : code,
        severity: "risk" as const,
        family: "risk" as const,
        strength: "weak" as const,
      }));
      return inst;
    }),
    ...noSecidExcluded,
  ];

  const all: PriorityInstrument<T>[] = normalized.map((w) =>
    toInstrument(
      w,
      assignPrimaryBucket(
        w.hard.excluded,
        inPlaySet.has(w.fields.secid) || (isStockLive && w.live.inPlayCandidate),
        volatilitySet.has(w.fields.secid),
        liquiditySet.has(w.fields.secid),
      ),
      inPlaySet.has(w.fields.secid),
      volatilitySet.has(w.fields.secid),
      liquiditySet.has(w.fields.secid),
    ),
  );

  return {
    liquidityLeaders,
    inPlayLeaders,
    focusInPlayLeaders: inPlayLeaders,
    inPlayCandidateLeaders,
    volatilityLeaders,
    excluded,
    all,
    stats: {
      total: rows.length,
      eligible: eligibleWork.length,
      hardExcluded: hardExcludedWork.length + noSecidExcluded.length,
      softRisk: softRiskCount,
      confirmedActivityCount,
      confirmedRangeCount,
      confirmedDirectionCount,
      confirmedParticipationCount,
      inPlayCandidates: inPlayCandidatePool.length,
      finalInPlayCount,
      mode,
      fallbackOnlyRejected,
      liquidityCutoff: clampScore(liquidityCutoff),
      volatilityCutoff,
      ...(isStockLive
        ? {
            tradableCount,
            rangeSignalCount,
            moveSignalCount,
            participationSignalCount,
            focusFinal: finalInPlayCount,
          }
        : {}),
    },
  };
}
