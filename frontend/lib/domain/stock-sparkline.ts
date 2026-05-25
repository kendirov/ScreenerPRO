import type { ScreenerRow } from "@screenerpro/shared";

export type StockSparklineCandle = {
  time: string;
  close: number;
};

export type StockSparklineSource = "intraday" | "daily";

export type StockSparklineSeries = {
  secid: string;
  status: "ok" | "no-data" | "error";
  source: StockSparklineSource;
  interval: 10 | 60 | 24;
  candles: StockSparklineCandle[];
  candleCount: number;
  error?: string;
};

export type StockSparklineBatchResponse = {
  fetchedAt: string;
  series: StockSparklineSeries[];
};

export type InPlayRangeChip = "high" | "low" | "range" | "импульс";

const IMPULSE_CHANGE_THRESHOLD = 1.2;
const HIGH_POSITION = 0.72;
const LOW_POSITION = 0.28;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computePositionInRange(
  lastPrice: number | null,
  dayLow: number | null,
  dayHigh: number | null,
): number | null {
  if (lastPrice == null || dayLow == null || dayHigh == null) return null;
  const span = dayHigh - dayLow;
  if (!Number.isFinite(span) || span <= 0) return null;
  return clamp((lastPrice - dayLow) / span, 0, 1);
}

export function labelRangePosition(position: number | null): string | null {
  if (position == null) return null;
  if (position >= HIGH_POSITION) return "около верха дня";
  if (position <= LOW_POSITION) return "около низа дня";
  return "середина диапазона";
}

export function resolveInPlayRangeChip(row: ScreenerRow, position: number | null): InPlayRangeChip {
  if (Math.abs(row.percentChange ?? 0) >= IMPULSE_CHANGE_THRESHOLD) return "импульс";
  if (position != null && position >= HIGH_POSITION) return "high";
  if (position != null && position <= LOW_POSITION) return "low";
  return "range";
}

export const IN_PLAY_RANGE_CHIP_LABEL: Record<InPlayRangeChip, string> = {
  high: "верх",
  low: "низ",
  range: "диап.",
  импульс: "импульс",
};

export const IN_PLAY_RANGE_CHIP_CLASS: Record<InPlayRangeChip, string> = {
  high: "border-emerald-700/35 bg-emerald-950/30 text-emerald-200/90",
  low: "border-rose-800/35 bg-rose-950/30 text-rose-200/90",
  range: "border-slate-700/40 bg-slate-900/45 text-slate-300/85",
  импульс: "border-amber-700/35 bg-amber-950/30 text-amber-200/90",
};

export function formatSparklineSourceLabel(series: StockSparklineSeries | null | undefined): string | null {
  if (!series || series.status !== "ok") return null;
  if (series.source === "intraday") {
    return `интрадей ${series.interval}м · ${series.candleCount} св.`;
  }
  return `${series.candleCount} дн.`;
}

export function extractSparklineCloses(series: StockSparklineSeries | null | undefined): number[] {
  if (!series || series.status !== "ok") return [];
  return series.candles.map((c) => c.close).filter((v) => Number.isFinite(v));
}

export function hasEnoughSparklinePoints(series: StockSparklineSeries | null | undefined): boolean {
  return extractSparklineCloses(series).length >= 3;
}
