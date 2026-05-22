import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { CurrencyHistoryPoint } from "@/lib/domain/currency-correlation-history";

export type PriceSeries = {
  key: string;
  points: CurrencyHistoryPoint[];
};

export type AlignedSeries = {
  dates: string[];
  closes: Record<string, number[]>;
};

export type DivergenceEvent = {
  date: string;
  key: string;
  family: CurrencyCorrelationFamily;
  direction: "выше корзины" | "ниже корзины";
  strength: number;
  divergenceZ: number;
};

export function alignPairByDate(a: PriceSeries, b: PriceSeries): AlignedSeries {
  return alignSeriesByDate([a, b]);
}

export function alignSeriesByDate(seriesList: PriceSeries[]): AlignedSeries {
  if (!seriesList.length) return { dates: [], closes: {} };

  const byKey = new Map<string, Map<string, number>>();
  for (const series of seriesList) {
    const map = new Map<string, number>();
    for (const p of series.points) {
      if (Number.isFinite(p.close)) map.set(p.date, p.close);
    }
    byKey.set(series.key, map);
  }

  const keys = seriesList.map((s) => s.key);
  let commonDates = [...byKey.get(keys[0]!)!.keys()].sort();
  for (let i = 1; i < keys.length; i++) {
    const set = new Set(byKey.get(keys[i]!)!.keys());
    commonDates = commonDates.filter((d) => set.has(d));
  }

  const closes: Record<string, number[]> = {};
  for (const key of keys) {
    const map = byKey.get(key)!;
    closes[key] = commonDates.map((d) => map.get(d)!);
  }

  return { dates: commonDates, closes };
}

export function normalizeToBase100(closes: number[]): number[] {
  if (!closes.length) return [];
  const first = closes.find((v) => Number.isFinite(v) && v > 0);
  if (first == null) return closes.map(() => NaN);
  return closes.map((c) => (c / first) * 100);
}

export function calcDailyReturns(closes: number[]): number[] {
  if (closes.length < 2) return [];
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    const cur = closes[i]!;
    if (!Number.isFinite(prev) || prev === 0 || !Number.isFinite(cur)) {
      out.push(NaN);
      continue;
    }
    out.push(cur / prev - 1);
  }
  return out;
}

export function pearsonCorrelation(a: number[], b: number[]): number | null {
  const pairs: [number, number][] = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  if (pairs.length < 3) return null;

  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const meanX = xs.reduce((s, v) => s + v, 0) / xs.length;
  const meanY = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < pairs.length; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
}

export function rollingCorrelation(
  a: number[],
  b: number[],
  window = 10,
): { dates: string[]; values: (number | null)[] } {
  if (window < 2 || a.length < window || b.length < window) {
    return { dates: [], values: [] };
  }

  const values: (number | null)[] = [];
  const dates: string[] = [];
  for (let i = window - 1; i < Math.min(a.length, b.length); i++) {
    const sliceA = a.slice(i - window + 1, i + 1);
    const sliceB = b.slice(i - window + 1, i + 1);
    values.push(pearsonCorrelation(sliceA, sliceB));
    dates.push(String(i));
  }
  return { dates, values };
}

export function calcDivergence(
  dates: string[],
  normalizedByKey: Record<string, number[]>,
): {
  dates: string[];
  basket: number[];
  byKey: Record<string, number[]>;
  divergenceZ: Record<string, number[]>;
} {
  const keys = Object.keys(normalizedByKey);
  if (!dates.length || !keys.length) {
    return { dates: [], basket: [], byKey: {}, divergenceZ: {} };
  }

  const basket: number[] = dates.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (const key of keys) {
      const v = normalizedByKey[key]![i];
      if (Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
    return count > 0 ? sum / count : NaN;
  });

  const byKey: Record<string, number[]> = {};
  const divergenceZ: Record<string, number[]> = {};

  for (const key of keys) {
    const series = normalizedByKey[key]!;
    const divergence = series.map((v, i) => (Number.isFinite(v) && Number.isFinite(basket[i]) ? v - basket[i]! : NaN));
    byKey[key] = divergence;

    const finite = divergence.filter(Number.isFinite) as number[];
    const mean = finite.length ? finite.reduce((s, v) => s + v, 0) / finite.length : 0;
    const variance = finite.length
      ? finite.reduce((s, v) => s + (v - mean) ** 2, 0) / finite.length
      : 0;
    const std = Math.sqrt(variance);
    divergenceZ[key] = divergence.map((d) =>
      Number.isFinite(d) && std > 0 ? (d - mean) / std : Number.isFinite(d) ? 0 : NaN,
    );
  }

  return { dates, basket, byKey, divergenceZ };
}

export function findDivergenceEvents(
  dates: string[],
  divergenceZ: Record<string, number[]>,
  familyByKey: Record<string, CurrencyCorrelationFamily>,
  threshold = 1.5,
): DivergenceEvent[] {
  const events: DivergenceEvent[] = [];

  for (const [key, zSeries] of Object.entries(divergenceZ)) {
    for (let i = 0; i < zSeries.length; i++) {
      const z = zSeries[i]!;
      if (!Number.isFinite(z) || Math.abs(z) < threshold) continue;
      events.push({
        date: dates[i] ?? "",
        key,
        family: familyByKey[key] ?? "SI",
        direction: z > 0 ? "выше корзины" : "ниже корзины",
        strength: Math.abs(z),
        divergenceZ: z,
      });
    }
  }

  return events.sort((a, b) => b.strength - a.strength);
}

export type CurrencyCorrelationDiagnostics = {
  commonDates: number;
  pointsByFamily: Record<CurrencyCorrelationFamily, number>;
  correlations: {
    "SI/CNY": number | null;
    "SI/ED": number | null;
    "CNY/ED": number | null;
  };
  emptyFamilies: CurrencyCorrelationFamily[];
  errorTickers: string[];
  hasHistory: boolean;
};

export function buildCorrelationDiagnostics(
  aligned: AlignedSeries,
  _familyByKey: Record<string, CurrencyCorrelationFamily>,
  instrumentsStatus: Array<{
    family: CurrencyCorrelationFamily;
    ticker: string;
    status: string;
    pointCount?: number;
  }>,
): CurrencyCorrelationDiagnostics {
  const pointsByFamily: Record<CurrencyCorrelationFamily, number> = { SI: 0, CNY: 0, ED: 0 };
  const emptyFamilies: CurrencyCorrelationFamily[] = [];
  const errorTickers: string[] = [];

  for (const inst of instrumentsStatus) {
    if (inst.status === "error") errorTickers.push(inst.ticker);
    if (inst.status === "empty") emptyFamilies.push(inst.family);
  }

  for (const inst of instrumentsStatus) {
    if (inst.status === "ok") {
      pointsByFamily[inst.family] = inst.pointCount ?? aligned.closes[inst.family]?.length ?? 0;
    }
  }

  const returnsByKey: Record<string, number[]> = {};
  for (const [key, closes] of Object.entries(aligned.closes)) {
    returnsByKey[key] = calcDailyReturns(closes);
  }

  const corr = (a: string, b: string) => {
    const ra = returnsByKey[a];
    const rb = returnsByKey[b];
    if (!ra?.length || !rb?.length) return null;
    const n = Math.min(ra.length, rb.length);
    return pearsonCorrelation(ra.slice(-n), rb.slice(-n));
  };

  return {
    commonDates: aligned.dates.length,
    pointsByFamily,
    correlations: {
      "SI/CNY": corr("SI", "CNY"),
      "SI/ED": corr("SI", "ED"),
      "CNY/ED": corr("CNY", "ED"),
    },
    emptyFamilies,
    errorTickers,
    hasHistory: aligned.dates.length >= 3,
  };
}
