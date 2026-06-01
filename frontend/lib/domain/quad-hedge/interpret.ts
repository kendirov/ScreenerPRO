import type { QuadHedgeDeviationMetric, QuadHedgeLegId } from "./types";

/** Интерпретации для UI — без buy/sell. */
export function interpretDeviation(legId: QuadHedgeLegId, deviationPp: number | null): string {
  if (deviationPp == null || !Number.isFinite(deviationPp)) {
    return "Данных недостаточно — только наблюдение";
  }
  const abs = Math.abs(deviationPp);
  if (abs < 0.05) return "SI/EU/CN синхронны — общее движение рубля";

  if (legId === "SI") {
    return deviationPp > 0
      ? "SI опережает корзину — долларовая нога сильнее"
      : "SI отстаёт от корзины — долларовая нога слабее";
  }
  if (legId === "EU") {
    return deviationPp > 0
      ? "EU опережает корзину — евро-рубль сильнее"
      : "EU отстаёт от корзины — евро-рубль слабее";
  }
  if (legId === "CN") {
    return deviationPp > 0
      ? "CN опережает корзину — юаневый контур ведёт"
      : "CN отстаёт от корзины — юаневый контур слабее";
  }
  return "Одна нога оторвалась от двух других — смотреть расхождение";
}

export function pickLeadingDeviation(
  deviations: QuadHedgeDeviationMetric[],
): { legId: QuadHedgeLegId; deviation: number } | null {
  let best: { legId: QuadHedgeLegId; deviation: number } | null = null;
  for (const d of deviations) {
    if (d.current == null || !Number.isFinite(d.current)) continue;
    if (!best || Math.abs(d.current) > Math.abs(best.deviation)) {
      best = { legId: d.legId, deviation: d.current };
    }
  }
  return best;
}

export function interpretationFromDeviations(deviations: QuadHedgeDeviationMetric[]): string {
  const leader = pickLeadingDeviation(deviations);
  if (!leader) return "Данных недостаточно — только наблюдение";
  return interpretDeviation(leader.legId, leader.deviation);
}
