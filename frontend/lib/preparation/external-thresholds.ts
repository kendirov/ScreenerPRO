import type { ExternalThresholdGroup } from "@/lib/preparation/preparation-types";

export type ExternalThresholds = {
  change1d: number;
  change5d: number;
  range5d: number;
};

export const EXTERNAL_THRESHOLDS: Record<ExternalThresholdGroup, ExternalThresholds> = {
  indices: { change1d: 1.0, change5d: 2.5, range5d: 3.0 },
  fx: { change1d: 0.5, change5d: 1.5, range5d: 2.0 },
  energy: { change1d: 2.0, change5d: 5.0, range5d: 6.0 },
  metals: { change1d: 1.5, change5d: 4.0, range5d: 5.0 },
  soft: { change1d: 2.0, change5d: 5.0, range5d: 7.0 },
};

/** Critical assets shown when no movers pass the filter. */
export const CRITICAL_FALLBACK_IDS = [
  "sp500",
  "nasdaq100",
  "dxy",
  "brent",
  "gold",
  "natgas",
  "copper",
] as const;

export const EXTERNAL_GROUP_TITLES: Record<
  import("@/lib/preparation/preparation-types").ExternalAssetGroupId,
  string
> = {
  indices: "Индексы",
  fx: "Доллар / FX",
  energy: "Энергия",
  metals: "Металлы",
  soft: "Агро",
};

export function isStrongMove(input: {
  change1dPct: number | null;
  change5dPct: number | null;
  range5dPct: number | null;
  thresholds: ExternalThresholds;
  critical?: boolean;
}): boolean {
  const { change1dPct, change5dPct, range5dPct, thresholds, critical } = input;
  const near = (value: number | null, limit: number) =>
    value != null && Math.abs(value) >= limit * (critical ? 0.75 : 1);

  return (
    near(change1dPct, thresholds.change1d) ||
    near(change5dPct, thresholds.change5d) ||
    (range5dPct != null && range5dPct >= thresholds.range5d)
  );
}
