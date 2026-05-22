import { absorptionAtPrice, type AbsorptionSignal } from "@/lib/domain/orderflow-absorption";
import { pricesEqual } from "@/lib/domain/order-book-ladder-model";
import type { SimClusterCell } from "@/lib/domain/orderflow-simulator";

export type FootprintDisplayMode = "volume" | "delta" | "split" | "imbalance";

export const FOOTPRINT_MODE_LABELS: Record<FootprintDisplayMode, string> = {
  volume: "Объём",
  delta: "Дельта",
  split: "Покупки/Продажи",
  imbalance: "Имбаланс",
};

export type FootprintGrid = {
  timestamps: number[];
  prices: number[];
  cellMap: Map<string, SimClusterCell>;
  maxVolume: number;
  maxAbsDelta: number;
};

export type FootprintChartMarker = {
  price: number;
  label: string;
  kind: "high-volume" | "absorption-buy" | "absorption-sell";
};

export const DEFAULT_IMBALANCE_RATIO = 3;

export function buildFootprintGrid(
  clusters: SimClusterCell[],
  maxColumns = 10,
  maxRows = 16,
): FootprintGrid {
  const timestamps = [...new Set(clusters.map((c) => c.timestamp))].sort((a, b) => a - b).slice(-maxColumns);
  const prices = [...new Set(clusters.map((c) => c.price))].sort((a, b) => b - a).slice(0, maxRows);

  const cellMap = new Map<string, SimClusterCell>();
  for (const cell of clusters) {
    cellMap.set(`${cell.timestamp}-${cell.price}`, cell);
  }

  const maxVolume = Math.max(...clusters.map((c) => c.totalVolume), 1);
  const maxAbsDelta = Math.max(...clusters.map((c) => Math.abs(c.delta)), 1);

  return { timestamps, prices, cellMap, maxVolume, maxAbsDelta };
}

export function cellKey(timestamp: number, price: number): string {
  return `${timestamp}-${price}`;
}

export function volumeIntensity(volume: number, maxVolume: number): number {
  return Math.min(1, volume / maxVolume);
}

export function deltaIntensity(delta: number, maxAbsDelta: number): number {
  return Math.min(1, Math.abs(delta) / maxAbsDelta);
}

export function isImbalanced(cell: SimClusterCell, ratio = DEFAULT_IMBALANCE_RATIO): boolean {
  const { buyVolume, sellVolume } = cell;
  if (buyVolume <= 0 && sellVolume <= 0) return false;
  if (sellVolume === 0) return buyVolume > 0;
  if (buyVolume === 0) return sellVolume > 0;
  return buyVolume / sellVolume >= ratio || sellVolume / buyVolume >= ratio;
}

export function imbalanceSide(cell: SimClusterCell, ratio = DEFAULT_IMBALANCE_RATIO): "buy" | "sell" | null {
  if (!isImbalanced(cell, ratio)) return null;
  return cell.buyVolume >= cell.sellVolume * ratio ? "buy" : "sell";
}

export function buildFootprintChartMarkers(
  clusters: SimClusterCell[],
  absorptions: AbsorptionSignal[],
  volumeThresholdRatio = 0.55,
): FootprintChartMarker[] {
  const markers: FootprintChartMarker[] = [];
  const grid = buildFootprintGrid(clusters);
  const latestTs = grid.timestamps[grid.timestamps.length - 1];

  if (latestTs !== undefined) {
    for (const price of grid.prices) {
      const cell = grid.cellMap.get(cellKey(latestTs, price));
      if (!cell) continue;
      const intensity = volumeIntensity(cell.totalVolume, grid.maxVolume);
      if (intensity >= volumeThresholdRatio) {
        markers.push({
          price,
          label: `объём ${cell.totalVolume}`,
          kind: "high-volume",
        });
      }
    }
  }

  for (const abs of absorptions) {
    markers.push({
      price: abs.price,
      label: abs.shortLabel,
      kind: abs.type === "buyer" ? "absorption-buy" : "absorption-sell",
    });
  }

  const byPrice = new Map<number, FootprintChartMarker>();
  for (const m of markers) {
    const existing = byPrice.get(m.price);
    if (!existing || m.kind.startsWith("absorption")) {
      byPrice.set(m.price, m);
    }
  }

  return [...byPrice.values()].slice(0, 10);
}

export { absorptionAtPrice };
