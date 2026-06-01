import type { ScreenerBenchmark } from "@screenerpro/shared";

export type MarketIndexDirection = "up" | "down" | "neutral";
export type MarketIndexTag = "wide" | "pressure" | "strength";

export type MarketIndexInterpretation = {
  direction: MarketIndexDirection;
  tags: MarketIndexTag[];
  directionLabel: string;
  tagLabels: string[];
};

const DIRECTION_THRESHOLD_PCT = 0.3;
const WIDE_DAY_RANGE_PCT = 1.5;
const EXTREME_POSITION = 0.22;

const DIRECTION_LABELS: Record<MarketIndexDirection, string> = {
  up: "Рост",
  down: "Снижение",
  neutral: "Нейтрально",
};

const TAG_LABELS: Record<MarketIndexTag, string> = {
  wide: "Широкий день",
  pressure: "Давление",
  strength: "Сила",
};

function positionInRange(last: number | null, low: number | null, high: number | null): number | null {
  if (last === null || low === null || high === null) return null;
  const span = high - low;
  if (span <= 0) return null;
  return (last - low) / span;
}

export function interpretMarketIndex(benchmark: ScreenerBenchmark | null | undefined): MarketIndexInterpretation {
  const changePct = benchmark?.percentChange ?? 0;
  let direction: MarketIndexDirection = "neutral";
  if ((benchmark?.percentChange ?? null) !== null) {
    if (changePct > DIRECTION_THRESHOLD_PCT) direction = "up";
    else if (changePct < -DIRECTION_THRESHOLD_PCT) direction = "down";
  }

  const tags: MarketIndexTag[] = [];
  const rangePct = benchmark?.dayRangePct ?? null;
  if (rangePct !== null && rangePct >= WIDE_DAY_RANGE_PCT) {
    tags.push("wide");
  }

  const pos = positionInRange(benchmark?.lastValue ?? null, benchmark?.low ?? null, benchmark?.high ?? null);
  if (pos !== null) {
    if (pos <= EXTREME_POSITION) tags.push("pressure");
    if (pos >= 1 - EXTREME_POSITION) tags.push("strength");
  }

  return {
    direction,
    tags,
    directionLabel: DIRECTION_LABELS[direction],
    tagLabels: tags.map((tag) => TAG_LABELS[tag]),
  };
}

export type MarketIndexDataStatus = "LIVE" | "HIST" | "NO DATA";

export function resolveMarketIndexDataStatus(input: {
  isLoading?: boolean;
  isLive: boolean;
  benchmark: ScreenerBenchmark | null | undefined;
}): MarketIndexDataStatus {
  if (input.isLoading) return input.isLive ? "LIVE" : "HIST";
  if (!input.benchmark || input.benchmark.lastValue === null) return "NO DATA";
  return input.isLive ? "LIVE" : "HIST";
}
