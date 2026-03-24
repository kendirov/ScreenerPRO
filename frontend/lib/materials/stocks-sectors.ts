import type { ScreenerRow } from "@screenerpro/shared";

export type SectorHeatMetric = "turnover" | "market-share" | "breadth" | "move" | "concentration";

export type StocksSectorDef = {
  id: string;
  title: string;
  description: string;
  tickers: string[];
};

export type StocksSectorView = StocksSectorDef & {
  members: ScreenerRow[];
  turnover: number;
  trades: number;
  marketTurnoverSharePct: number | null;
  marketTradesSharePct: number | null;
  up: number;
  neutral: number;
  down: number;
  medianMovePct: number | null;
  top3TurnoverSharePct: number | null;
  breadthScore: number | null;
  isBroad: boolean;
  moneyFlowType: "real" | "concentrated";
  leadersByTurnover: ScreenerRow[];
  leadersByMove: ScreenerRow[];
  laggards: ScreenerRow[];
  topContributors: Array<{
    ticker: string;
    shortName: string;
    contributionPct: number;
    percentChange: number | null;
    turnover: number | null;
  }>;
};

export type StocksSectorsViewModel = {
  marketTurnover: number;
  marketTrades: number;
  sectors: StocksSectorView[];
};

const OFFICIAL_SECTOR_DEFS: StocksSectorDef[] = [
  {
    id: "oil-gas",
    title: "Нефть и газ",
    description: "Экспортный поток и тяжеловесы энерго-сегмента.",
    tickers: ["LKOH", "ROSN", "TATN", "SIBN", "GAZP", "NVTK"],
  },
  {
    id: "metals-mining",
    title: "Металлы и добыча",
    description: "Сырьевой и металлургический блок MOEX.",
    tickers: ["GMKN", "RUAL", "NLMK", "MAGN", "CHMF", "PLZL", "UGLD"],
  },
  {
    id: "finance",
    title: "Финансы",
    description: "Банки и биржевая инфраструктура.",
    tickers: ["SBER", "VTBR", "T", "MOEX", "SVCB"],
  },
  {
    id: "power",
    title: "Электроэнергетика",
    description: "Генерация и сетевой контур.",
    tickers: ["IRAO", "FEES", "HYDR", "MSNG"],
  },
  {
    id: "telecom",
    title: "Телеком",
    description: "Телеком-операторы с защитным профилем.",
    tickers: ["MTSS", "RTKM"],
  },
  {
    id: "transport",
    title: "Транспорт",
    description: "Логистика, флот и авиаперевозки.",
    tickers: ["FLOT", "AFLT", "NMTP"],
  },
  {
    id: "consumer",
    title: "Потребительский сектор",
    description: "Ритейл и внутренний спрос.",
    tickers: ["MGNT", "X5", "BELU"],
  },
  {
    id: "chem-petrochem",
    title: "Химия и нефтехимия",
    description: "Химический и агрохимический контур.",
    tickers: ["PHOR", "AKRN", "KAZT", "NKNCP"],
  },
];

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function asPct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

export function buildStocksSectorsView(rows: ScreenerRow[]): StocksSectorsViewModel {
  const stocks = rows.filter((row) => row.assetClass === "stock");
  const marketTurnover = stocks.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  const marketTrades = stocks.reduce((acc, row) => acc + (row.tradesCount ?? 0), 0);

  const sectors: StocksSectorView[] = OFFICIAL_SECTOR_DEFS.map((def) => {
    const members = stocks.filter((row) => def.tickers.includes(row.ticker));
    const turnover = members.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
    const trades = members.reduce((acc, row) => acc + (row.tradesCount ?? 0), 0);
    const up = members.filter((row) => (row.percentChange ?? 0) > 0).length;
    const down = members.filter((row) => (row.percentChange ?? 0) < 0).length;
    const neutral = Math.max(0, members.length - up - down);
    const breadthScore = members.length > 0 ? (up - down) / members.length : null;
    const moves = members.map((row) => row.percentChange).filter((v): v is number => v !== null);
    const medianMovePct = median(moves);
    const top3Turnover = [...members]
      .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
      .slice(0, 3)
      .reduce((acc, row) => acc + (row.turnover ?? 0), 0);
    const top3TurnoverSharePct = asPct(top3Turnover, Math.max(turnover, 1));
    const marketTurnoverSharePct = asPct(turnover, Math.max(marketTurnover, 1));
    const marketTradesSharePct = asPct(trades, Math.max(marketTrades, 1));
    const isBroad = (breadthScore ?? 0) >= 0.2 || (breadthScore ?? 0) <= -0.2;
    const moneyFlowType = (top3TurnoverSharePct ?? 1) <= 0.62 ? "real" : "concentrated";

    const leadersByTurnover = [...members]
      .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
      .slice(0, 5);
    const leadersByMove = [...members]
      .filter((row) => row.percentChange !== null)
      .sort((a, b) => (b.percentChange ?? 0) - (a.percentChange ?? 0))
      .slice(0, 5);
    const laggards = [...members]
      .filter((row) => row.percentChange !== null)
      .sort((a, b) => (a.percentChange ?? 0) - (b.percentChange ?? 0))
      .slice(0, 5);

    const absMoveDen = members.reduce((acc, row) => acc + Math.abs((row.percentChange ?? 0) * (row.turnover ?? 0)), 0);
    const topContributors = [...members]
      .map((row) => ({
        ticker: row.ticker,
        shortName: row.shortName,
        contributionPct: absMoveDen > 0 ? Math.abs((row.percentChange ?? 0) * (row.turnover ?? 0)) / absMoveDen : 0,
        percentChange: row.percentChange ?? null,
        turnover: row.turnover ?? null,
      }))
      .sort((a, b) => b.contributionPct - a.contributionPct)
      .slice(0, 5);

    return {
      ...def,
      members,
      turnover,
      trades,
      marketTurnoverSharePct,
      marketTradesSharePct,
      up,
      neutral,
      down,
      medianMovePct,
      top3TurnoverSharePct,
      breadthScore,
      isBroad,
      moneyFlowType,
      leadersByTurnover,
      leadersByMove,
      laggards,
      topContributors,
    };
  })
    .filter((sector) => sector.members.length > 0)
    .sort((a, b) => b.turnover - a.turnover);

  return { marketTurnover, marketTrades, sectors };
}

export function sectorHeatValue(sector: StocksSectorView, metric: SectorHeatMetric): number {
  if (metric === "turnover") return sector.turnover;
  if (metric === "market-share") return sector.marketTurnoverSharePct ?? 0;
  if (metric === "breadth") return sector.breadthScore ?? 0;
  if (metric === "move") return sector.medianMovePct ?? 0;
  return sector.top3TurnoverSharePct ?? 0;
}

