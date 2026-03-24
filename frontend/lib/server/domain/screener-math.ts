export type InPlayTag = "MONEY" | "IN_PLAY" | "NOISE";

export interface MoexRawStockRow {
  turnover: number | null;
  tradesCount: number | null;
  dayRangePct: number | null;
}

export interface MoexInPlayDerived {
  turnoverPercentile: number;
  tradesPercentile: number;
  rangePercentile: number;
  inPlayScore: number;
  inPlayTags: InPlayTag[];
  reasonLabel: string | null;
}

type ScoreComponent = "turnover" | "trades" | "range";

const SCORE_WEIGHTS: Record<ScoreComponent, number> = {
  turnover: 0.5,
  trades: 0.3,
  range: 0.2,
};

const CANDIDATE_TURNOVER_RATIO = 0.1;
const CANDIDATE_TURNOVER_FLOOR = 120_000_000;
const CANDIDATE_TRADES_RATIO = 0.2;
const CANDIDATE_TRADES_FLOOR = 4_000;
const RANGE_PERCENTILE_CAP = 85;
const IN_PLAY_MIN_SCORE = 78;
const IN_PLAY_LEADER_GAP = 10;
const IN_PLAY_MAX_COUNT = 5;
const NOISE_RANGE_PERCENTILE = 90;
const NOISE_LIQUIDITY_PERCENTILE_FLOOR = 60;

const REASON_RU_LABELS: Record<ScoreComponent, string> = {
  turnover: "Объем",
  trades: "Сделки",
  range: "Диапазон",
};

function toFiniteOrZero(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentileByDescendingRank(values: number[]): number[] {
  const total = values.length;
  if (total === 0) return [];
  if (total === 1) return [100];

  const sortedDesc = [...values].sort((a, b) => b - a);
  return values.map((value) => {
    const firstIndex = sortedDesc.findIndex((item) => item === value);
    const lastIndex = sortedDesc.lastIndexOf(value);
    const averageRank = ((firstIndex + 1) + (lastIndex + 1)) / 2;
    const normalized = ((total - averageRank) / (total - 1)) * 100;
    return round2(clampPercent(normalized));
  });
}

function reasonLabelForInPlay(item: Pick<MoexInPlayDerived, "turnoverPercentile" | "tradesPercentile" | "rangePercentile">): string {
  const contributions: Array<{ key: ScoreComponent; value: number }> = [
    { key: "turnover", value: item.turnoverPercentile * SCORE_WEIGHTS.turnover },
    { key: "trades", value: item.tradesPercentile * SCORE_WEIGHTS.trades },
    { key: "range", value: item.rangePercentile * SCORE_WEIGHTS.range },
  ].sort((a, b) => b.value - a.value);

  const first = REASON_RU_LABELS[contributions[0]?.key ?? "turnover"];
  const second = REASON_RU_LABELS[contributions[1]?.key ?? "range"];
  return `${first} + ${second}`;
}

export function enrichMoexStocksWithInPlayMetrics<T extends MoexRawStockRow>(rows: readonly T[]): Array<T & MoexInPlayDerived> {
  const turnovers = rows.map((row) => toFiniteOrZero(row.turnover));
  const trades = rows.map((row) => toFiniteOrZero(row.tradesCount));
  const ranges = rows.map((row) => toFiniteOrZero(row.dayRangePct));
  const leaderTurnover = turnovers.length > 0 ? Math.max(...turnovers) : 0;
  const leaderTrades = trades.length > 0 ? Math.max(...trades) : 0;
  const candidateTurnoverThreshold = Math.max(leaderTurnover * CANDIDATE_TURNOVER_RATIO, CANDIDATE_TURNOVER_FLOOR);
  const candidateTradesThreshold = Math.max(leaderTrades * CANDIDATE_TRADES_RATIO, CANDIDATE_TRADES_FLOOR);

  const turnoverPercentiles = percentileByDescendingRank(turnovers);
  const tradesPercentiles = percentileByDescendingRank(trades);
  const rangePercentiles = percentileByDescendingRank(ranges);
  const derived = rows.map((row, index) => {
    const turnoverPercentile = turnoverPercentiles[index] ?? 0;
    const tradesPercentile = tradesPercentiles[index] ?? 0;
    const rangePercentile = rangePercentiles[index] ?? 0;
    const rangeEff = Math.min(rangePercentile, RANGE_PERCENTILE_CAP);
    const turnoverNow = turnovers[index] ?? 0;
    const tradesNow = trades[index] ?? 0;
    const passesCandidateGate = turnoverNow >= candidateTurnoverThreshold && tradesNow >= candidateTradesThreshold;
    const isNoise =
      rangePercentile >= NOISE_RANGE_PERCENTILE
      && (turnoverPercentile < NOISE_LIQUIDITY_PERCENTILE_FLOOR || tradesPercentile < NOISE_LIQUIDITY_PERCENTILE_FLOOR);

    const inPlayScore = round2(
      clampPercent(
        turnoverPercentile * SCORE_WEIGHTS.turnover
          + tradesPercentile * SCORE_WEIGHTS.trades
          + rangeEff * SCORE_WEIGHTS.range,
      ),
    );
    const eligibleForInPlay = passesCandidateGate && !isNoise;

    const inPlayTags: InPlayTag[] = [];
    if (turnoverPercentile >= 95) inPlayTags.push("MONEY");
    if (isNoise) inPlayTags.push("NOISE");

    return {
      ...row,
      __index: index,
      __eligibleForInPlay: eligibleForInPlay,
      turnoverPercentile,
      tradesPercentile,
      rangePercentile,
      inPlayScore,
      inPlayTags,
      reasonLabel: null,
    };
  });

  const eligibleSorted = derived
    .filter((row) => row.__eligibleForInPlay)
    .sort((a, b) => b.inPlayScore - a.inPlayScore);
  const leaderScore = eligibleSorted[0]?.inPlayScore ?? null;
  const dynamicThreshold = leaderScore === null ? IN_PLAY_MIN_SCORE : Math.max(IN_PLAY_MIN_SCORE, leaderScore - IN_PLAY_LEADER_GAP);
  const selectedIndices = new Set(
    eligibleSorted
      .filter((row) => row.inPlayScore >= dynamicThreshold)
      .slice(0, IN_PLAY_MAX_COUNT)
      .map((row) => row.__index),
  );

  // TODO: add session-level sticky state for IN_PLAY enter>=78 / exit<74 hysteresis.
  return derived.map((row) => {
    const inPlayTags = [...row.inPlayTags];
    if (selectedIndices.has(row.__index) && !inPlayTags.includes("NOISE")) {
      inPlayTags.push("IN_PLAY");
    }
    const reasonLabel = inPlayTags.includes("IN_PLAY")
      ? reasonLabelForInPlay({
        turnoverPercentile: row.turnoverPercentile,
        tradesPercentile: row.tradesPercentile,
        rangePercentile: Math.min(row.rangePercentile, RANGE_PERCENTILE_CAP),
      })
      : null;

    const { __index, __eligibleForInPlay, ...rest } = row;
    return {
      ...rest,
      inPlayTags,
      reasonLabel,
    };
  });
}
