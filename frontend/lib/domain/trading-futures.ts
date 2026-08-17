export type FuturesActivityPoint = {
  time: string;
  value: number;
};

export type FuturesActivitySeries = {
  secid: string;
  status: "ok" | "no-data" | "error";
  usedInterval: number;
  sameTimeVolumeRatio: number | null;
  baselineSessions: number;
  timeMsk: string | null;
  currentVolume: number | null;
  currentPath: FuturesActivityPoint[];
  error?: string;
};

export type FuturesActivityResponse = {
  fetchedAt: string;
  source: "MOEX ISS";
  series: FuturesActivitySeries[];
};

export function futuresActivityTone(ratio: number | null): "strong" | "normal" | "weak" | "unavailable" {
  if (ratio == null || !Number.isFinite(ratio)) return "unavailable";
  if (ratio >= 1.5) return "strong";
  if (ratio <= 0.75) return "weak";
  return "normal";
}
