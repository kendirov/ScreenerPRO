import type { ScreenerRow } from "@screenerpro/shared";

export type IndexHeatMetric = "turnover" | "breadth" | "move" | "concentration";

export type IndexLensDef = {
  id: "imoex" | "bluechips" | "broad-market" | "mid-small";
  title: string;
  description: string;
  tickers: string[];
};

export type IndexLensView = IndexLensDef & {
  members: ScreenerRow[];
  turnover: number;
  trades: number;
  marketTurnoverSharePct: number | null;
  breadth: { up: number; neutral: number; down: number };
  breadthScore: number | null;
  medianMovePct: number | null;
  concentrationTop3Pct: number | null;
  concentrationTop5Pct: number | null;
  marketMoveContributionPct: number | null;
  topContributors: Array<{ ticker: string; contributionPct: number; percentChange: number | null }>;
  topDraggers: ScreenerRow[];
  topLeaders: ScreenerRow[];
  topTurnover: ScreenerRow[];
};

export type MarketRegime =
  | "Широкое участие"
  | "Узкое лидерство"
  | "Слабое подтверждение"
  | "Широкое давление"
  | "Разнонаправленный рынок";

export type IndicesViewModel = {
  lenses: IndexLensView[];
  regime: MarketRegime;
};

const LENSES: IndexLensDef[] = [
  { id: "imoex", title: "IMOEX", description: "Ядро индекса МосБиржи как главный market pulse.", tickers: ["SBER", "GAZP", "LKOH", "NVTK", "ROSN", "TATN", "GMKN", "YDEX", "T"] },
  { id: "bluechips", title: "Голубые фишки", description: "Ликвидные тяжеловесы с наибольшей емкостью оборота.", tickers: ["SBER", "GAZP", "LKOH", "NVTK", "ROSN", "TATN", "GMKN", "MGNT"] },
  { id: "broad-market", title: "Широкий рынок", description: "Расширенное покрытие для подтверждения импульса.", tickers: ["SBER", "GAZP", "LKOH", "ROSN", "NVTK", "GMKN", "NLMK", "MAGN", "MTSS", "AFLT", "YDEX", "MOEX"] },
  { id: "mid-small", title: "Mid/Small", description: "Второй эшелон как слой подтверждения или дивергенции.", tickers: ["AFKS", "AFLT", "FLOT", "MTLR", "POSI", "SVCB", "RTKM"] },
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

export function buildIndicesView(rows: ScreenerRow[]): IndicesViewModel {
  const stocks = rows.filter((row) => row.assetClass === "stock");
  const marketTurnover = stocks.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  const marketAbsMove = stocks.reduce((acc, row) => acc + Math.abs((row.percentChange ?? 0) * (row.turnover ?? 0)), 0);

  const lenses = LENSES.map((lens) => {
    const members = stocks.filter((row) => lens.tickers.includes(row.ticker));
    const turnover = members.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
    const trades = members.reduce((acc, row) => acc + (row.tradesCount ?? 0), 0);
    const up = members.filter((row) => (row.percentChange ?? 0) > 0).length;
    const down = members.filter((row) => (row.percentChange ?? 0) < 0).length;
    const neutral = Math.max(0, members.length - up - down);
    const breadthScore = members.length > 0 ? (up - down) / members.length : null;
    const medianMovePct = median(members.map((row) => row.percentChange).filter((v): v is number => v !== null));
    const byTurnover = [...members].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0));
    const top3 = byTurnover.slice(0, 3).reduce((acc, row) => acc + (row.turnover ?? 0), 0);
    const top5 = byTurnover.slice(0, 5).reduce((acc, row) => acc + (row.turnover ?? 0), 0);
    const concentrationTop3Pct = share(top3, Math.max(turnover, 1));
    const concentrationTop5Pct = share(top5, Math.max(turnover, 1));
    const absMoveWeighted = members.reduce((acc, row) => acc + Math.abs((row.percentChange ?? 0) * (row.turnover ?? 0)), 0);
    const marketMoveContributionPct = share(absMoveWeighted, Math.max(marketAbsMove, 1));
    const denom = Math.max(absMoveWeighted, 1);
    const topContributors = members
      .map((row) => ({
        ticker: row.ticker,
        contributionPct: Math.abs((row.percentChange ?? 0) * (row.turnover ?? 0)) / denom,
        percentChange: row.percentChange ?? null,
      }))
      .sort((a, b) => b.contributionPct - a.contributionPct)
      .slice(0, 5);
    const topLeaders = [...members].filter((r) => r.percentChange !== null).sort((a, b) => (b.percentChange ?? 0) - (a.percentChange ?? 0)).slice(0, 5);
    const topDraggers = [...members].filter((r) => r.percentChange !== null).sort((a, b) => (a.percentChange ?? 0) - (b.percentChange ?? 0)).slice(0, 5);

    return {
      ...lens,
      members,
      turnover,
      trades,
      marketTurnoverSharePct: share(turnover, Math.max(marketTurnover, 1)),
      breadth: { up, neutral, down },
      breadthScore,
      medianMovePct,
      concentrationTop3Pct,
      concentrationTop5Pct,
      marketMoveContributionPct,
      topContributors,
      topDraggers,
      topLeaders,
      topTurnover: byTurnover.slice(0, 5),
    } satisfies IndexLensView;
  }).filter((lens) => lens.members.length > 0);

  const regime = deriveRegime(lenses);
  return { lenses: lenses.sort((a, b) => b.turnover - a.turnover), regime };
}

function deriveRegime(lenses: IndexLensView[]): MarketRegime {
  const imoex = lenses.find((l) => l.id === "imoex");
  const broad = lenses.find((l) => l.id === "broad-market");
  const mid = lenses.find((l) => l.id === "mid-small");
  if (!imoex || !broad || !mid) return "Разнонаправленный рынок";
  const imoexNarrow = (imoex.concentrationTop3Pct ?? 0) >= 0.65;
  const broadPositive = (broad.breadthScore ?? 0) > 0.2;
  const broadNegative = (broad.breadthScore ?? 0) < -0.2;
  const midConfirms = (mid.breadthScore ?? 0) > 0.1;
  const midDiverges = (mid.breadthScore ?? 0) < -0.1;
  if (broadPositive && midConfirms && !imoexNarrow) return "Широкое участие";
  if (imoexNarrow && !midConfirms) return "Узкое лидерство";
  if (broadPositive && midDiverges) return "Слабое подтверждение";
  if (broadNegative && (mid.breadthScore ?? 0) < 0) return "Широкое давление";
  return "Разнонаправленный рынок";
}

export function indicesHeatValue(lens: IndexLensView, metric: IndexHeatMetric): number {
  if (metric === "turnover") return lens.turnover;
  if (metric === "breadth") return lens.breadthScore ?? 0;
  if (metric === "move") return lens.medianMovePct ?? 0;
  return lens.concentrationTop3Pct ?? 0;
}

