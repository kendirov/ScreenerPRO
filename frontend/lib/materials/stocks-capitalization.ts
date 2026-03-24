import type { ScreenerRow } from "@screenerpro/shared";

export type CapitalizationHeatMetric = "turnover" | "market-share" | "breadth" | "move" | "concentration";

export type CapitalizationGroupDef = {
  id: "bluechips" | "imoex-core" | "broad-market" | "mid-small";
  title: string;
  role: string;
  description: string;
  tickers: string[];
};

export type CapitalizationGroupView = CapitalizationGroupDef & {
  members: ScreenerRow[];
  turnover: number;
  trades: number;
  marketTurnoverSharePct: number | null;
  marketTradesSharePct: number | null;
  marketMoveContributionPct: number | null;
  up: number;
  neutral: number;
  down: number;
  breadthScore: number | null;
  medianMovePct: number | null;
  top3ConcentrationPct: number | null;
  isParticipating: boolean;
  isConcentrated: boolean;
  topTurnover: ScreenerRow[];
  leaders: ScreenerRow[];
  laggards: ScreenerRow[];
};

export type CapitalizationViewModel = {
  groups: CapitalizationGroupView[];
  marketTurnover: number;
  marketTrades: number;
  breadthText: string;
};

const GROUPS: CapitalizationGroupDef[] = [
  {
    id: "bluechips",
    title: "Голубые фишки",
    role: "Core liquidity",
    description: "Основной ликвидный слой рынка; часто забирает крупный поток первой волны.",
    tickers: ["SBER", "GAZP", "LKOH", "NVTK", "ROSN", "GMKN", "TATN", "MGNT"],
  },
  {
    id: "imoex-core",
    title: "Индексное ядро",
    role: "Index heavy",
    description: "Тяжеловесы, которые чаще всего формируют направление индекса.",
    tickers: ["SBER", "GAZP", "LKOH", "NVTK", "ROSN", "YDEX", "T", "MOEX"],
  },
  {
    id: "broad-market",
    title: "Широкий рынок",
    role: "Breadth proxy",
    description: "Расширенный набор ликвидных бумаг для оценки подтверждения движения.",
    tickers: ["SBER", "GAZP", "LKOH", "ROSN", "NVTK", "GMKN", "MAGN", "NLMK", "MTSS", "AFLT", "YDEX", "T", "MOEX"],
  },
  {
    id: "mid-small",
    title: "Средняя/малая капитализация",
    role: "Opportunity layer",
    description: "Слой интрадей-альфы: выше dispersion, ниже глубина, выше избирательность.",
    tickers: ["AFKS", "AFLT", "FLOT", "MTLR", "POSI", "SVCB", "RTKM"],
  },
];

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function share(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

export function buildCapitalizationView(rows: ScreenerRow[]): CapitalizationViewModel {
  const stocks = rows.filter((row) => row.assetClass === "stock");
  const marketTurnover = stocks.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  const marketTrades = stocks.reduce((acc, row) => acc + (row.tradesCount ?? 0), 0);
  const marketAbsMove = stocks.reduce((acc, row) => acc + Math.abs((row.percentChange ?? 0) * (row.turnover ?? 0)), 0);

  const groups: CapitalizationGroupView[] = GROUPS.map((def) => {
    const members = stocks.filter((row) => def.tickers.includes(row.ticker));
    const turnover = members.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
    const trades = members.reduce((acc, row) => acc + (row.tradesCount ?? 0), 0);
    const up = members.filter((row) => (row.percentChange ?? 0) > 0).length;
    const down = members.filter((row) => (row.percentChange ?? 0) < 0).length;
    const neutral = Math.max(0, members.length - up - down);
    const breadthScore = members.length > 0 ? (up - down) / members.length : null;
    const medianMovePct = median(members.map((row) => row.percentChange).filter((v): v is number => v !== null));
    const top3Turnover = [...members]
      .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
      .slice(0, 3)
      .reduce((acc, row) => acc + (row.turnover ?? 0), 0);
    const top3ConcentrationPct = share(top3Turnover, Math.max(turnover, 1));
    const groupAbsMove = members.reduce((acc, row) => acc + Math.abs((row.percentChange ?? 0) * (row.turnover ?? 0)), 0);
    const marketMoveContributionPct = share(groupAbsMove, Math.max(marketAbsMove, 1));
    const marketTurnoverSharePct = share(turnover, Math.max(marketTurnover, 1));
    const marketTradesSharePct = share(trades, Math.max(marketTrades, 1));
    const isParticipating = (breadthScore ?? 0) >= 0.2 || (breadthScore ?? 0) <= -0.2;
    const isConcentrated = (top3ConcentrationPct ?? 1) >= 0.65;
    const topTurnover = [...members].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 5);
    const leaders = [...members].filter((row) => row.percentChange !== null).sort((a, b) => (b.percentChange ?? 0) - (a.percentChange ?? 0)).slice(0, 5);
    const laggards = [...members].filter((row) => row.percentChange !== null).sort((a, b) => (a.percentChange ?? 0) - (b.percentChange ?? 0)).slice(0, 5);
    return {
      ...def,
      members,
      turnover,
      trades,
      marketTurnoverSharePct,
      marketTradesSharePct,
      marketMoveContributionPct,
      up,
      neutral,
      down,
      breadthScore,
      medianMovePct,
      top3ConcentrationPct,
      isParticipating,
      isConcentrated,
      topTurnover,
      leaders,
      laggards,
    };
  }).filter((group) => group.members.length > 0);

  const totalUp = groups.reduce((acc, group) => acc + group.up, 0);
  const totalNeutral = groups.reduce((acc, group) => acc + group.neutral, 0);
  const totalDown = groups.reduce((acc, group) => acc + group.down, 0);

  return {
    groups: groups.sort((a, b) => b.turnover - a.turnover),
    marketTurnover,
    marketTrades,
    breadthText: `${totalUp}/${totalNeutral}/${totalDown}`,
  };
}

export function capitalizationHeatValue(group: CapitalizationGroupView, metric: CapitalizationHeatMetric): number {
  if (metric === "turnover") return group.turnover;
  if (metric === "market-share") return group.marketTurnoverSharePct ?? 0;
  if (metric === "breadth") return group.breadthScore ?? 0;
  if (metric === "move") return group.medianMovePct ?? 0;
  return group.top3ConcentrationPct ?? 0;
}

