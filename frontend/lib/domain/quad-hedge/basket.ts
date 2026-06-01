import type {
  QuadHedgeLegId,
  QuadHedgeMetricStatus,
  QuadHedgeNormalizedChange,
} from "./types";

/** Основные торгуемые фьючерсы MOEX. */
export const QUAD_HEDGE_PRIMARY_LEGS = ["SI", "EU", "CN"] as const satisfies readonly QuadHedgeLegId[];

export type QuadHedgePrimaryLegId = (typeof QUAD_HEDGE_PRIMARY_LEGS)[number];

export type QuadHedgeBasketMetric = {
  status: QuadHedgeMetricStatus;
  current: number | null;
  series: number[];
};

export type QuadHedgeDeviationMetric = {
  legId: QuadHedgePrimaryLegId;
  status: QuadHedgeMetricStatus;
  current: number | null;
  series: number[];
};

function rowMean(values: (number | undefined)[]): number | null {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!finite.length) return null;
  return finite.reduce((s, v) => s + v, 0) / finite.length;
}

/** Среднее нормализованных % по доступным ногам SI / EU / CN на каждом баре. */
export function calcBasketMeanSeries(
  normalized: QuadHedgeNormalizedChange[],
): QuadHedgeBasketMetric {
  const byLeg = new Map(normalized.map((n) => [n.legId, n]));
  const primary = QUAD_HEDGE_PRIMARY_LEGS.map((id) => byLeg.get(id)).filter(Boolean);

  if (!primary.length) {
    return { status: "no-data", current: null, series: [] };
  }

  const len = Math.max(...primary.map((n) => n!.seriesPct.length));
  if (len < 2) {
    return { status: "insufficient-data", current: null, series: [] };
  }

  const series: number[] = [];
  for (let i = 0; i < len; i++) {
    const mean = rowMean(
      QUAD_HEDGE_PRIMARY_LEGS.map((id) => {
        const norm = byLeg.get(id);
        const v = norm?.seriesPct[i];
        return v != null && Number.isFinite(v) ? v : undefined;
      }),
    );
    series.push(mean ?? NaN);
  }

  const finite = series.filter(Number.isFinite);
  const status: QuadHedgeMetricStatus = finite.length >= 2 ? "ok" : "insufficient-data";
  const last = series[series.length - 1];

  return {
    status,
    current: last != null && Number.isFinite(last) ? last : null,
    series,
  };
}

/** Отклонение ноги от basket_mean на каждом баре. */
export function calcDeviationSeries(
  legId: QuadHedgePrimaryLegId,
  normalized: QuadHedgeNormalizedChange[],
  basket: QuadHedgeBasketMetric,
): QuadHedgeDeviationMetric {
  const norm = normalized.find((n) => n.legId === legId);
  if (!norm || norm.status === "no-data" || basket.status === "no-data") {
    return { legId, status: "no-data", current: null, series: [] };
  }

  const len = Math.min(norm.seriesPct.length, basket.series.length);
  const series: number[] = [];
  for (let i = 0; i < len; i++) {
    const leg = norm.seriesPct[i]!;
    const mean = basket.series[i]!;
    if (!Number.isFinite(leg) || !Number.isFinite(mean)) {
      series.push(NaN);
      continue;
    }
    series.push(leg - mean);
  }

  const finite = series.filter(Number.isFinite);
  const status: QuadHedgeMetricStatus = finite.length >= 2 ? "ok" : "insufficient-data";
  const last = series[series.length - 1];

  return {
    legId,
    status,
    current: last != null && Number.isFinite(last) ? last : null,
    series,
  };
}

/** Все отклонения primary-ног от корзины. */
export function calcAllDeviations(
  normalized: QuadHedgeNormalizedChange[],
  basket: QuadHedgeBasketMetric,
): QuadHedgeDeviationMetric[] {
  return QUAD_HEDGE_PRIMARY_LEGS.map((legId) => calcDeviationSeries(legId, normalized, basket));
}
