import { calcDailyReturns, pearsonCorrelation } from "@/lib/domain/currency-correlation-series";

export type DailyCloseSeries = {
  dates: string[];
  closes: number[];
};

export function seriesFromCloses(points: Array<{ date: string; close: number }>): DailyCloseSeries {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return {
    dates: sorted.map((p) => p.date),
    closes: sorted.map((p) => p.close),
  };
}

export function alignCloseSeries(a: DailyCloseSeries, b: DailyCloseSeries): {
  dates: string[];
  aCloses: number[];
  bCloses: number[];
} {
  const bMap = new Map(b.dates.map((d, i) => [d, b.closes[i]!]));
  const dates: string[] = [];
  const aCloses: number[] = [];
  const bCloses: number[] = [];

  for (let i = 0; i < a.dates.length; i++) {
    const date = a.dates[i]!;
    const bClose = bMap.get(date);
    const aClose = a.closes[i]!;
    if (bClose == null || !Number.isFinite(aClose) || !Number.isFinite(bClose)) continue;
    dates.push(date);
    aCloses.push(aClose);
    bCloses.push(bClose);
  }

  return { dates, aCloses, bCloses };
}

export function tailReturns(closes: number[], window: number): number[] {
  const returns = calcDailyReturns(closes);
  if (returns.length <= window) return returns.filter((v) => Number.isFinite(v));
  return returns.slice(-window).filter((v) => Number.isFinite(v));
}

export function computeBeta(stockReturns: number[], factorReturns: number[]): number | null {
  const n = Math.min(stockReturns.length, factorReturns.length);
  if (n < 5) return null;

  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const x = factorReturns[i]!;
    const y = stockReturns[i]!;
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  if (pairs.length < 5) return null;

  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const meanX = xs.reduce((s, v) => s + v, 0) / xs.length;
  const meanY = ys.reduce((s, v) => s + v, 0) / ys.length;

  let cov = 0;
  let varX = 0;
  for (let i = 0; i < pairs.length; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    cov += dx * dy;
    varX += dx * dx;
  }
  if (varX === 0) return null;
  return cov / varX;
}

export function computeBreakScore(corr20: number | null, corr60: number | null): number | null {
  if (corr20 == null || corr60 == null) return null;
  let score = Math.abs(corr20 - corr60);
  if (corr20 * corr60 < 0 && Math.abs(corr20) >= 0.25 && Math.abs(corr60) >= 0.25) {
    score += 0.15;
  }
  return score;
}

export function computeStockFactorMetrics(
  stockCloses: number[],
  factorCloses: number[],
): {
  corr20: number | null;
  corr60: number | null;
  beta: number | null;
  breakScore: number | null;
  alignedDays: number;
} {
  const stockReturns = calcDailyReturns(stockCloses);
  const factorReturns = calcDailyReturns(factorCloses);
  const n = Math.min(stockReturns.length, factorReturns.length);
  if (n < 10) {
    return { corr20: null, corr60: null, beta: null, breakScore: null, alignedDays: n + 1 };
  }

  const rStock = stockReturns.slice(-n);
  const rFactor = factorReturns.slice(-n);
  const corr20 = n >= 21 ? pearsonCorrelation(rStock.slice(-20), rFactor.slice(-20)) : null;
  const corr60 = n >= 61 ? pearsonCorrelation(rStock.slice(-60), rFactor.slice(-60)) : pearsonCorrelation(rStock, rFactor);
  const betaWindow = n >= 60 ? 60 : n;
  const beta = computeBeta(rStock.slice(-betaWindow), rFactor.slice(-betaWindow));
  const breakScore = computeBreakScore(corr20, corr60);

  return { corr20, corr60, beta, breakScore, alignedDays: n + 1 };
}

/** Equal-weight basket closes by date. */
export function buildBasketCloses(
  memberSeries: Map<string, DailyCloseSeries>,
): DailyCloseSeries | null {
  if (!memberSeries.size) return null;

  const dateSets = [...memberSeries.values()].map((s) => new Set(s.dates));
  let commonDates = [...dateSets[0]!];
  for (let i = 1; i < dateSets.length; i++) {
    const set = dateSets[i]!;
    commonDates = commonDates.filter((d) => set.has(d));
  }
  commonDates.sort();
  if (commonDates.length < 10) return null;

  const closes: number[] = [];
  const outDates: string[] = [];

  for (const date of commonDates) {
    let sum = 0;
    let count = 0;
    for (const series of memberSeries.values()) {
      const idx = series.dates.indexOf(date);
      if (idx >= 0 && Number.isFinite(series.closes[idx]!)) {
        sum += series.closes[idx]!;
        count += 1;
      }
    }
    if (count > 0) {
      outDates.push(date);
      closes.push(sum / count);
    }
  }

  if (outDates.length < 10) return null;
  return { dates: outDates, closes };
}
