import { IN_GAME_CONFIG, type InGameScenario, type MarketRegime } from "@/lib/screener/in-game-config";

export type { InGameScenario, MarketRegime };

export type InGameRowInput = {
  ticker: string;
  last: number | null;
  changePct: number | null;
  turnover: number | null;
  trades: number | null;
  rangePct: number | null;
  isIlliquid: boolean;
  tradesRank: number;
  turnoverRank: number;
  rangeRank: number;
  changeRank: number;
};

export type InGameMarketContext = {
  indexChangePct: number | null;
  indexRangePct: number | null;
  total: number;
  rising: number;
  falling: number;
  universeCount: number;
};

export type InGameEvaluatedRow = InGameRowInput & {
  score: number;
  scenario: InGameScenario | null;
  reason: string;
  tradesPercentile: number;
  turnoverPercentile: number;
  rangePercentile: number;
};

export type InGameRejectedRow = {
  ticker: string;
  trades: number | null;
  score: number;
  reason: string;
};

export type InGameDiagnostics = {
  marketRegime: MarketRegime;
  indexChangePct: number | null;
  indexRangePct: number | null;
  breadthActiveRatio: number;
  targetMin: number;
  targetMax: number;
  minScoreUsed: number;
  candidateCount: number;
  shortlistCount: number;
  rejectedByHardFilters: number;
  rejectedByScore: number;
  shortlistTickers: string[];
  topRejected: InGameRejectedRow[];
};

export type InGameSelectionResult = {
  candidates: InGameEvaluatedRow[];
  shortlist: InGameEvaluatedRow[];
  diagnostics: InGameDiagnostics;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rankToPercentile(rank: number, total: number): number {
  if (total <= 1) return 50;
  return 100 * (1 - (rank - 1) / Math.max(total - 1, 1));
}

export function resolveRowPercentiles(row: InGameRowInput, total: number) {
  return {
    tradesPercentile: rankToPercentile(row.tradesRank, total),
    turnoverPercentile: rankToPercentile(row.turnoverRank, total),
    rangePercentile: rankToPercentile(row.rangeRank, total),
    absChangePercentile: rankToPercentile(row.changeRank, total),
  };
}

export function resolveMarketRegime(ctx: InGameMarketContext): MarketRegime {
  const cfg = IN_GAME_CONFIG.marketRegime;
  const indexRange = ctx.indexRangePct ?? 0;
  const breadthActiveRatio =
    ctx.universeCount > 0 ? (ctx.rising + ctx.falling) / ctx.universeCount : 0;

  if (indexRange >= cfg.extremeIndexRangePct) return "extreme";
  if (indexRange >= cfg.activeIndexRangePct || breadthActiveRatio >= cfg.broadBreadthRatio) {
    return "active";
  }
  return "normal";
}

export function resolveRegimeTargets(regime: MarketRegime): { targetMin: number; targetMax: number; minScore: number } {
  const { target, shortlistFilters } = IN_GAME_CONFIG;
  if (regime === "extreme") {
    return {
      targetMin: target.extremeDayMin,
      targetMax: target.extremeDayMax,
      minScore: shortlistFilters.minScoreExtreme,
    };
  }
  if (regime === "active") {
    return {
      targetMin: target.activeDayMin,
      targetMax: target.activeDayMax,
      minScore: shortlistFilters.minScoreActive,
    };
  }
  return {
    targetMin: target.normalDayMin,
    targetMax: target.normalDayMax,
    minScore: shortlistFilters.minScoreNormal,
  };
}

export function computeInGameScore(row: InGameRowInput, ctx: InGameMarketContext): number {
  const pct = resolveRowPercentiles(row, ctx.total);
  const w = IN_GAME_CONFIG.weights;
  const rel = IN_GAME_CONFIG.relativeToIndex;

  const stockRangePct = Math.abs(row.rangePct ?? 0);
  const stockChangePct = Math.abs(row.changePct ?? 0);
  const indexRange = Math.max(ctx.indexRangePct ?? 0, rel.rangeFloorPct);
  const indexMove = Math.max(Math.abs(ctx.indexChangePct ?? 0), rel.moveFloorPct);

  const relativeRange = stockRangePct / indexRange;
  const relativeMove = stockChangePct / indexMove;
  const relativeRangeScore = clamp(relativeRange / rel.relativeScoreDivisor, 0, 1) * 100;
  const relativeMoveScore = clamp(relativeMove / rel.relativeScoreDivisor, 0, 1) * 100;

  return clamp(
    w.trades * pct.tradesPercentile +
      w.turnover * pct.turnoverPercentile +
      w.range * pct.rangePercentile +
      w.relativeRange * relativeRangeScore +
      w.relativeMove * relativeMoveScore,
    0,
    100,
  );
}

function passesHardFilters(row: InGameRowInput, pct: ReturnType<typeof resolveRowPercentiles>): boolean {
  const hf = IN_GAME_CONFIG.hardFilters;
  const trades = row.trades ?? 0;
  const turnover = row.turnover ?? 0;
  const rangePct = Math.abs(row.rangePct ?? 0);

  if (row.last == null && row.changePct == null && rangePct <= 0) return false;
  if (trades < hf.minTrades) return false;
  if (turnover < hf.minTurnoverRub) return false;
  if (rangePct < hf.minRangePct) return false;
  if (row.isIlliquid && pct.tradesPercentile < hf.illiquidTradesPercentileFloor) return false;

  return true;
}

function matchCandidateScenario(
  row: InGameRowInput,
  pct: ReturnType<typeof resolveRowPercentiles>,
  ctx: InGameMarketContext,
): { scenario: InGameScenario; reason: string } | null {
  const rangePct = Math.abs(row.rangePct ?? 0);
  const indexRange = Math.max(ctx.indexRangePct ?? 0, IN_GAME_CONFIG.relativeToIndex.rangeFloorPct);
  const sc = IN_GAME_CONFIG.candidateScenarios;
  const bc = IN_GAME_CONFIG.blueChipBoost;

  if (pct.tradesPercentile >= sc.a.minTradesPercentile && pct.turnoverPercentile >= sc.a.minTurnoverPercentile) {
    return { scenario: "A", reason: "много сделок" };
  }
  if (pct.tradesPercentile >= sc.b.minTradesPercentile && rangePct >= indexRange * sc.b.indexRangeMultiplier) {
    return { scenario: "B", reason: "сделки + диапазон" };
  }
  if (rangePct >= indexRange * sc.c.indexRangeMultiplier && pct.tradesPercentile >= sc.c.minTradesPercentile) {
    return { scenario: "C", reason: "история дня" };
  }
  if (
    pct.turnoverPercentile >= sc.d.minTurnoverPercentile &&
    pct.tradesPercentile >= sc.d.minTradesPercentile &&
    rangePct >= sc.d.minRangePct
  ) {
    return { scenario: "D", reason: "оборот + диапазон" };
  }
  if (
    bc.enabled &&
    (bc.tickers as readonly string[]).includes(row.ticker) &&
    pct.tradesPercentile >= bc.minTradesPercentile &&
    rangePct >= bc.minRangePct
  ) {
    return { scenario: "E", reason: "много сделок" };
  }

  return null;
}

export function buildInGameSelection(
  rows: InGameRowInput[],
  ctx: InGameMarketContext,
): InGameSelectionResult {
  const regime = resolveMarketRegime(ctx);
  const { targetMin, targetMax, minScore } = resolveRegimeTargets(regime);
  const breadthActiveRatio =
    ctx.universeCount > 0 ? (ctx.rising + ctx.falling) / ctx.universeCount : 0;

  let rejectedByHardFilters = 0;
  const evaluated: InGameEvaluatedRow[] = [];

  for (const row of rows) {
    const pct = resolveRowPercentiles(row, ctx.total);
    if (!passesHardFilters(row, pct)) {
      rejectedByHardFilters += 1;
      continue;
    }
    const match = matchCandidateScenario(row, pct, ctx);
    if (!match) continue;

    evaluated.push({
      ...row,
      score: computeInGameScore(row, ctx),
      scenario: match.scenario,
      reason: match.reason,
      tradesPercentile: pct.tradesPercentile,
      turnoverPercentile: pct.turnoverPercentile,
      rangePercentile: pct.rangePercentile,
    });
  }

  evaluated.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return (b.trades ?? 0) - (a.trades ?? 0);
  });

  const candidates = evaluated;
  const scoreQualified = candidates.filter((row) => row.score >= minScore);
  let shortlist = scoreQualified.slice(0, targetMax);

  if (shortlist.length < targetMin) {
    const relaxedFloor = minScore - IN_GAME_CONFIG.target.scoreRelaxForFill;
    const fillPool = candidates.filter((row) => row.score >= relaxedFloor);
    shortlist = fillPool.slice(0, Math.min(targetMin, targetMax));
  }

  shortlist = shortlist.slice(0, targetMax);

  const shortlistSet = new Set(shortlist.map((r) => r.ticker));
  const rejectedByScore = candidates.filter((r) => !shortlistSet.has(r.ticker)).length;

  const topRejected: InGameRejectedRow[] = candidates
    .filter((r) => !shortlistSet.has(r.ticker))
    .sort((a, b) => (b.trades ?? 0) - (a.trades ?? 0))
    .slice(0, 20)
    .map((r) => ({
      ticker: r.ticker,
      trades: r.trades,
      score: Math.round(r.score),
      reason: r.score < minScore ? `score ${Math.round(r.score)} < ${minScore}` : "ниже top shortlist",
    }));

  return {
    candidates,
    shortlist,
    diagnostics: {
      marketRegime: regime,
      indexChangePct: ctx.indexChangePct,
      indexRangePct: ctx.indexRangePct,
      breadthActiveRatio,
      targetMin,
      targetMax,
      minScoreUsed: minScore,
      candidateCount: candidates.length,
      shortlistCount: shortlist.length,
      rejectedByHardFilters,
      rejectedByScore,
      shortlistTickers: shortlist.map((r) => r.ticker),
      topRejected,
    },
  };
}

export function compareInGameRows(a: InGameEvaluatedRow, b: InGameEvaluatedRow): number {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;
  const tradesDiff = (b.trades ?? 0) - (a.trades ?? 0);
  if (tradesDiff !== 0) return tradesDiff;
  const turnoverDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
  if (turnoverDiff !== 0) return turnoverDiff;
  return (b.rangePct ?? 0) - (a.rangePct ?? 0);
}
