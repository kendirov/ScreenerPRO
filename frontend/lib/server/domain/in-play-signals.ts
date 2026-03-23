function safeDivide(value: number | null, denominator: number | null): number | null {
  if (value === null || denominator === null || denominator <= 0) return null;
  return value / denominator;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface InPlaySignalInput {
  turnover: number | null;
  tradesCount: number | null;
  percentChange: number | null;
  dayRangePct: number | null;
  turnoverBaseline: number | null;
  rangeBaselinePct: number | null;
  tradesBaseline: number | null;
}

export interface InPlaySignalOutput {
  turnoverVsAverage: number | null;
  rangeVsAverage: number | null;
  tradesVsAverage: number | null;
  inPlayScore: number | null;
  isInPlay: boolean;
}

export function computeInPlaySignals(input: InPlaySignalInput): InPlaySignalOutput {
  const turnoverVsAverage = safeDivide(input.turnover, input.turnoverBaseline);
  const rangeVsAverage = safeDivide(input.dayRangePct, input.rangeBaselinePct);
  const tradesVsAverage = safeDivide(input.tradesCount, input.tradesBaseline);

  const turnoverImpulse = clamp((turnoverVsAverage ?? 1) - 1, 0, 3) * 32;
  const rangeImpulse = clamp((rangeVsAverage ?? 1) - 1, 0, 3) * 28;
  const tradesImpulse = clamp((tradesVsAverage ?? 1) - 1, 0, 3) * 20;
  const moveImpulse = Math.min(Math.abs(input.percentChange ?? 0), 6) * 3;
  const absoluteRangeImpulse = Math.min(Math.abs(input.dayRangePct ?? 0), 6) * 2.5;

  const rawScore = turnoverImpulse + rangeImpulse + tradesImpulse + moveImpulse + absoluteRangeImpulse;
  const inPlayScore = Number.isFinite(rawScore) ? Number(rawScore.toFixed(2)) : null;

  const isInPlayByRatios = (turnoverVsAverage ?? 0) >= 1.8 && (rangeVsAverage ?? 0) >= 1.35;
  const isInPlayByScore = (inPlayScore ?? 0) >= 45;

  return {
    turnoverVsAverage,
    rangeVsAverage,
    tradesVsAverage,
    inPlayScore,
    isInPlay: isInPlayByRatios || isInPlayByScore,
  };
}
