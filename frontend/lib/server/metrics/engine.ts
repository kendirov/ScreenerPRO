export interface MetricInputs {
  lastPrice: number | null;
  previousClose: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  turnover: number | null;
  volumeBaseline: number | null;
  turnoverBaseline: number | null;
  volatility20dBaseline: number | null;
  dailyReturns20d: number[];
}

export interface DerivedMetricSet {
  turnoverRatio: number | null;
  volumeRatio: number | null;
  dayRangePct: number | null;
  gapPct: number | null;
  relativeVolatility20d: number | null;
  inPlayScore: number | null;
  isInPlay: boolean;
}

function safeDivide(value: number | null, divisor: number | null): number | null {
  if (value === null || divisor === null || divisor === 0) return null;
  return value / divisor;
}

function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, current) => acc + (current - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeDerivedMetrics(input: MetricInputs): DerivedMetricSet {
  const turnoverRatio = safeDivide(input.turnover, input.turnoverBaseline);
  const volumeRatio = safeDivide(input.volume, input.volumeBaseline);
  const dayRangePct =
    input.high !== null && input.low !== null && input.previousClose && input.previousClose !== 0
      ? ((input.high - input.low) / input.previousClose) * 100
      : null;
  const gapPct =
    input.open !== null && input.previousClose && input.previousClose !== 0
      ? ((input.open - input.previousClose) / input.previousClose) * 100
      : null;
  const realizedVol20 = stdev(input.dailyReturns20d);
  const relativeVolatility20d = safeDivide(realizedVol20, input.volatility20dBaseline);

  const move = input.lastPrice !== null && input.previousClose && input.previousClose !== 0 ? Math.abs((input.lastPrice - input.previousClose) / input.previousClose) * 100 : 0;
  const range = Math.abs(dayRangePct ?? 0);
  const volAnomaly = Math.max(0, (volumeRatio ?? 1) - 1) * 100;
  const turnoverAnomaly = Math.max(0, (turnoverRatio ?? 1) - 1) * 100;
  const inPlayScore = Number((0.35 * move + 0.25 * range + 0.2 * volAnomaly + 0.2 * turnoverAnomaly).toFixed(2));

  return {
    turnoverRatio,
    volumeRatio,
    dayRangePct,
    gapPct,
    relativeVolatility20d,
    inPlayScore: Number.isFinite(inPlayScore) ? inPlayScore : null,
    isInPlay: inPlayScore >= 2.5,
  };
}
