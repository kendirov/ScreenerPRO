import type { MarketPriorityResult } from "@/lib/screener/market-priority-engine";

export type StockQuickFilter = "all" | "in_play" | "liquidity" | "volatility" | "risk";

export type PriorityFilterSets = {
  /** Command Bar Focus block (`inPlayLeaders`). */
  inPlayFocus: Set<string>;
  /** Table quick filter «В игре» — all `inPlayCandidate`. */
  inPlayCandidates: Set<string>;
  liquidity: Set<string>;
  volatility: Set<string>;
  risk: Set<string>;
};

export const STOCK_QUICK_FILTER_LABELS: Record<StockQuickFilter, string> = {
  all: "Все акции",
  in_play: "В игре",
  liquidity: "Где деньги",
  volatility: "Прострелы",
  risk: "Риск",
};

export const STOCK_QUICK_FILTER_EMPTY: Record<
  Exclude<StockQuickFilter, "all">,
  { title: string; text: string }
> = {
  in_play: {
    title: "Нет in-play",
    text: "Ни одна бумага не прошла live gate (участие + диапазон/движение). Попробуйте Balanced или Wide.",
  },
  liquidity: {
    title: "Нет лидеров ликвидности",
    text: "Список «Где деньги» пуст для текущего universe.",
  },
  volatility: {
    title: "Нет прострелов",
    text: "Нет инструментов с движением ниже качества In Play.",
  },
  risk: {
    title: "Нет risk-строк",
    text: "Нет eligible бумаг с soft risk / risk reasons.",
  },
};

export function buildPriorityFilterSets(
  result: MarketPriorityResult | null | undefined,
): PriorityFilterSets {
  const empty = {
    inPlayFocus: new Set<string>(),
    inPlayCandidates: new Set<string>(),
    liquidity: new Set<string>(),
    volatility: new Set<string>(),
    risk: new Set<string>(),
  };
  if (!result) return empty;

  const inPlayFocus = new Set(result.focusInPlayLeaders.map((i) => i.secid));
  const inPlayCandidates = new Set(
    (result.inPlayCandidateLeaders.length > 0
      ? result.inPlayCandidateLeaders
      : result.inPlayLeaders
    )
      .filter((i) => i.live?.inPlayCandidate !== false)
      .map((i) => i.secid),
  );
  const liquidity = new Set(result.liquidityLeaders.map((i) => i.secid));
  const volatility = new Set(result.volatilityLeaders.map((i) => i.secid));
  const risk = new Set(
    result.all
      .filter((i) => i.isEligible && i.riskReasons.length > 0)
      .map((i) => i.secid),
  );

  return { inPlayFocus, inPlayCandidates, liquidity, volatility, risk };
}

export function getQuickFilterSet(
  filter: StockQuickFilter,
  sets: PriorityFilterSets,
): Set<string> | null {
  if (filter === "all") return null;
  if (filter === "in_play") return sets.inPlayCandidates;
  if (filter === "liquidity") return sets.liquidity;
  if (filter === "volatility") return sets.volatility;
  return sets.risk;
}

export function countQuickFilter(filter: StockQuickFilter, sets: PriorityFilterSets): number | null {
  if (filter === "all") return null;
  const set = getQuickFilterSet(filter, sets);
  return set?.size ?? 0;
}
