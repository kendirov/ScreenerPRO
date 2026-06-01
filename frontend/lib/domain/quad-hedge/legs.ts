import type { ScreenerRow } from "@screenerpro/shared";
import type { IntradayCurrencyInstrument } from "@/lib/domain/currency-correlation-intraday";
import {
  pickActiveContractForFamily,
  type CurrencyCorrelationFamily,
} from "@/lib/domain/currency-correlation";
import {
  normalizeQuadHedgeLegId,
  type QuadHedgeDataSource,
  type QuadHedgeLegId,
  type QuadHedgeLegSeries,
  type QuadHedgePricePoint,
} from "./types";

/** Сопоставление тикера MOEX с ногой квадрохеджа. */
export function resolveQuadHedgeLeg(ticker: string, shortName = ""): QuadHedgeLegId | null {
  const t = ticker.trim().toUpperCase();
  const name = shortName.trim();

  if (/^SI[A-Z0-9]/.test(t) || t === "SI") return "SI";
  if (/^CR[A-Z0-9]/.test(t) || /^CNY[A-Z0-9]/.test(t)) return "CN";
  if (/^ED[A-Z0-9]/.test(t) || t === "ED") return "ED";
  if (/^EU[A-Z0-9]/.test(t) || t === "EU") {
    if (/EUR\s*\/\s*USD|евро.*доллар/i.test(name) && !/рубл/i.test(name)) return null;
    return "EU";
  }

  if (/USD\s*\/\s*RUB|доллар.*рубл/i.test(name) && !/юан/i.test(name)) return "SI";
  if (/юань.*рубл|CNY\/RUB/i.test(name)) return "CN";
  if (/EUR\s*\/\s*USD|евро.*доллар/i.test(name) && !/рубл/i.test(name)) return "ED";
  if (/EUR\s*\/\s*RUB|евро.*рубл/i.test(name)) return "EU";

  return null;
}

/** Лучший контракт Eu (EUR/RUB) по обороту. */
export function pickActiveEuContract(rows: ScreenerRow[]): {
  ticker: string;
  label: string;
} | null {
  const candidates = rows.filter(
    (r) => r.assetClass === "future" && resolveQuadHedgeLeg(r.ticker, r.shortName ?? "") === "EU",
  );
  if (!candidates.length) return null;
  const best = [...candidates].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))[0]!;
  return { ticker: best.ticker, label: best.shortName ?? best.ticker };
}

const INTRADAY_FAMILY_TO_LEG: Record<CurrencyCorrelationFamily, QuadHedgeLegId> = {
  SI: "SI",
  CNY: "CN",
  ED: "ED",
};

function toPricePoints(
  points: Array<{ timestamp: string; close: number }>,
): QuadHedgePricePoint[] {
  return points
    .filter((p) => Number.isFinite(p.close))
    .map((p) => ({ timestamp: p.timestamp, close: p.close }));
}

/** Интрадей валютной связки → SI / CN / ED (optional). */
export function quadHedgeLegsFromIntradayInstruments(
  instruments: IntradayCurrencyInstrument[],
  source: QuadHedgeDataSource = "MOEX ISS",
): QuadHedgeLegSeries[] {
  return instruments
    .filter((i) => i.status === "ok" && i.points.length > 0)
    .map((i) => ({
      legId: INTRADAY_FAMILY_TO_LEG[i.family],
      ticker: i.ticker,
      label: i.label,
      source,
      points: toPricePoints(i.points),
    }));
}

/** Intraday-ряд одной ноги (EU и др.). */
export function quadHedgeLegFromIntradayPoints(
  legId: QuadHedgeLegId,
  ticker: string,
  label: string,
  points: Array<{ timestamp: string; close: number }>,
  source: QuadHedgeDataSource = "MOEX ISS",
): QuadHedgeLegSeries {
  return {
    legId: normalizeQuadHedgeLegId(legId),
    ticker,
    label,
    source,
    points: toPricePoints(points),
  };
}

export function mergeQuadHedgeLegSeries(existing: QuadHedgeLegSeries[]): QuadHedgeLegSeries[] {
  const byLeg = new Map<QuadHedgeLegId, QuadHedgeLegSeries>();

  for (const leg of existing) {
    const id = normalizeQuadHedgeLegId(leg.legId);
    const normalized = { ...leg, legId: id };
    const prev = byLeg.get(id);
    if (!prev) {
      byLeg.set(id, normalized);
      continue;
    }
    if (legSeriesRank(normalized) > legSeriesRank(prev)) byLeg.set(id, normalized);
  }

  return [...byLeg.values()];
}

function legSeriesRank(leg: QuadHedgeLegSeries): number {
  let score = leg.points.length;
  if (leg.source === "MOEX ISS") score += 10_000;
  if (leg.source === "external") score += 5_000;
  if (leg.source === "demo") score -= 50_000;
  if (leg.source === "stub") score -= 100_000;
  return score;
}

/** SI / CN / EU из скринера — только snapshot fallback (не для сигналов). */
export function quadHedgePrimaryLegsFromScreener(
  rows: ScreenerRow[],
  screenerSource: "MOEX ISS" | "demo" = "MOEX ISS",
): QuadHedgeLegSeries[] {
  const dataSource: QuadHedgeDataSource = screenerSource === "demo" ? "demo" : "MOEX ISS";
  const legs: QuadHedgeLegSeries[] = [];
  const now = new Date().toISOString();

  const si = pickActiveContractForFamily(rows, "SI");
  if (si?.status === "найден" && si.lastPrice != null) {
    legs.push({
      legId: "SI",
      ticker: si.ticker,
      label: si.label,
      source: dataSource,
      points: [{ timestamp: now, close: si.lastPrice }],
    });
  }

  const cn = pickActiveContractForFamily(rows, "CNY");
  if (cn?.status === "найден" && cn.lastPrice != null) {
    legs.push({
      legId: "CN",
      ticker: cn.ticker,
      label: cn.label,
      source: dataSource,
      points: [{ timestamp: now, close: cn.lastPrice }],
    });
  }

  const eu = pickActiveEuContract(rows);
  if (eu) {
    const row = rows.find((r) => r.ticker === eu.ticker);
    if (row?.lastPrice != null) {
      legs.push({
        legId: "EU",
        ticker: eu.ticker,
        label: eu.label,
        source: dataSource,
        points: [{ timestamp: now, close: row.lastPrice }],
      });
    }
  }

  return legs;
}

export { normalizeQuadHedgeLegId as resolveQuadHedgeLegNormalized };
