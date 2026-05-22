import { TICK_SIZE, type SimCandle, type SimClusterCell, type SimOrderBookLevel } from "@/lib/domain/orderflow-simulator";
import { pricesEqual } from "@/lib/domain/order-book-ladder-model";

/** Учебная эвристика — не торговый сигнал */
export type AbsorptionType = "buyer" | "seller";

export type AbsorptionSignal = {
  price: number;
  type: AbsorptionType;
  /** Полная подпись для tooltip */
  label: string;
  /** Короткая метка в ячейке footprint */
  shortLabel: string;
  bucketTimestamp?: number;
};

const MIN_TOTAL_VOLUME = 700;
const FLOW_RATIO = 3;
const BID_ASK_RESTORED = 1200;

function aggregateRecentByPrice(clusters: SimClusterCell[], maxBuckets = 4): Map<number, { buy: number; sell: number; lastTs: number }> {
  const bucketTs = [...new Set(clusters.map((c) => c.timestamp))].sort((a, b) => b - a).slice(0, maxBuckets);
  const bucketSet = new Set(bucketTs);
  const map = new Map<number, { buy: number; sell: number; lastTs: number }>();

  for (const cell of clusters) {
    if (!bucketSet.has(cell.timestamp)) continue;
    const agg = map.get(cell.price) ?? { buy: 0, sell: 0, lastTs: cell.timestamp };
    agg.buy += cell.buyVolume;
    agg.sell += cell.sellVolume;
    agg.lastTs = Math.max(agg.lastTs, cell.timestamp);
    map.set(cell.price, agg);
  }

  return map;
}

function levelAt(levels: SimOrderBookLevel[], price: number): SimOrderBookLevel | undefined {
  return levels.find((l) => pricesEqual(l.price, price));
}

/**
 * Абсорбция покупателя (поглощение продаж):
 * много агрессивных продаж на уровне, цена не уходит ниже, bid восстанавливается.
 */
export function detectAbsorptionSignals(
  clusters: SimClusterCell[],
  levels: SimOrderBookLevel[],
  currentPrice: number,
  candles: SimCandle[],
): AbsorptionSignal[] {
  if (clusters.length === 0) return [];

  const byPrice = aggregateRecentByPrice(clusters);
  const lastCandle = candles[candles.length - 1];
  const hits: AbsorptionSignal[] = [];

  for (const [price, vol] of byPrice) {
    const total = vol.buy + vol.sell;
    if (total < MIN_TOTAL_VOLUME) continue;

    const level = levelAt(levels, price);
    const lowHeld = !lastCandle || lastCandle.low >= price - TICK_SIZE * 2.5;
    const highHeld = !lastCandle || lastCandle.high <= price + TICK_SIZE * 2.5;

    if (vol.sell >= vol.buy * FLOW_RATIO && vol.sell >= MIN_TOTAL_VOLUME * 0.55) {
      const bidRestored = (level?.bidSize ?? 0) >= BID_ASK_RESTORED;
      const priceAbove = currentPrice >= price - TICK_SIZE;
      if (lowHeld && bidRestored && priceAbove) {
        hits.push({
          price,
          type: "buyer",
          label: "поглощение продаж — прошёл объём, но цена не ушла ниже",
          shortLabel: "абсорбция",
          bucketTimestamp: vol.lastTs,
        });
        continue;
      }
    }

    if (vol.buy >= vol.sell * FLOW_RATIO && vol.buy >= MIN_TOTAL_VOLUME * 0.55) {
      const askRestored = (level?.askSize ?? 0) >= BID_ASK_RESTORED;
      const priceBelow = currentPrice <= price + TICK_SIZE;
      if (highHeld && askRestored && priceBelow) {
        hits.push({
          price,
          type: "seller",
          label: "поглощение покупок — прошёл объём, но цена не ушла выше",
          shortLabel: "абсорбция",
          bucketTimestamp: vol.lastTs,
        });
      }
    }
  }

  return hits.slice(0, 8);
}

export function absorptionAtPrice(
  signals: AbsorptionSignal[],
  price: number,
  bucketTimestamp?: number,
): AbsorptionSignal | undefined {
  return signals.find(
    (s) =>
      pricesEqual(s.price, price) &&
      (bucketTimestamp === undefined || s.bucketTimestamp === bucketTimestamp),
  );
}
