import type { ScreenerRow } from "@screenerpro/shared";
import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";

export type FuturesMode = "underlyings" | "curve" | "roll" | "basis";

export type FuturesContractNode = {
  ticker: string;
  name: string;
  underlying: string;
  expiry: string | null;
  dte: number | null;
  price: number | null;
  turnover: number | null;
  trades: number | null;
  openInterest: number | null;
  spreadPct: number | null;
  tickSize: number | null;
  tickValue: number | null;
  marginFootprintRub: number | null;
  availabilityConfidence: number;
};

export type FuturesUnderlyingChain = {
  id: string;
  title: string;
  contracts: FuturesContractNode[];
  totalTurnover: number;
  totalTrades: number;
  totalOpenInterest: number;
  front: FuturesContractNode | null;
  next: FuturesContractNode | null;
  frontTurnoverShare: number | null;
  nextTurnoverShare: number | null;
  curveShape: "contango" | "backwardation" | "flat" | "unavailable";
  rollState: "front-dominant" | "next-taking-over" | "roll-started" | "fragmented";
};

export function getFuturesModeLabel(mode: FuturesMode): string {
  if (mode === "underlyings") return "Базовые активы";
  if (mode === "curve") return "Кривая";
  if (mode === "roll") return "Ролл и ликвидность";
  return "Связи и базис";
}

function normalizeUnderlying(value: string | null): string {
  if (!value) return "UNKNOWN";
  return value.toUpperCase();
}

function resolveUnderlyingTitle(code: string): string {
  const map: Record<string, string> = {
    IMOEX: "IMOEX",
    MIX: "IMOEX",
    RTS: "RTS",
    USD000UTSTOM: "USD/RUB",
    CNYRUB_TOM: "CNY/RUB",
    BR: "Brent",
    GOLD: "Золото",
    SILVER: "Серебро",
    NG: "Газ",
  };
  return map[code] ?? code;
}

function calcCurveShape(front: FuturesContractNode | null, next: FuturesContractNode | null): FuturesUnderlyingChain["curveShape"] {
  if (!front?.price || !next?.price || front.price <= 0) return "unavailable";
  const deltaPct = ((next.price - front.price) / front.price) * 100;
  if (deltaPct > 0.25) return "contango";
  if (deltaPct < -0.25) return "backwardation";
  return "flat";
}

function calcRollState(frontShare: number | null, nextShare: number | null): FuturesUnderlyingChain["rollState"] {
  if (frontShare === null || nextShare === null) return "fragmented";
  if (frontShare >= 0.7) return "front-dominant";
  if (nextShare >= 0.5) return "next-taking-over";
  if (frontShare < 0.7 && nextShare >= 0.25) return "roll-started";
  return "fragmented";
}

export function buildFuturesChains(techRows: TechnicalCharacteristicsRow[], futuresRows: ScreenerRow[]): FuturesUnderlyingChain[] {
  const futuresTech = techRows.filter((row) => row.assetClass === "future");
  const oiByTicker = new Map<string, number | null>(futuresRows.map((row) => [row.ticker, row.openInterest ?? null]));
  const grouped = new Map<string, FuturesContractNode[]>();

  for (const row of futuresTech) {
    const underlying = normalizeUnderlying(row.underlying);
    const node: FuturesContractNode = {
      ticker: row.ticker,
      name: row.instrumentName,
      underlying,
      expiry: row.expiryDate,
      dte: row.daysToExpiry.value,
      price: row.currentPrice.value,
      turnover: row.turnoverRub.value,
      trades: row.tradesCount.value,
      openInterest: oiByTicker.get(row.ticker) ?? null,
      spreadPct: row.spreadPct.value,
      tickSize: row.priceStep.value,
      tickValue: row.stepValue.value,
      marginFootprintRub: row.marginFootprintRub.value,
      availabilityConfidence: row.availabilityConfidence,
    };
    if (!grouped.has(underlying)) grouped.set(underlying, []);
    grouped.get(underlying)?.push(node);
  }

  const chains: FuturesUnderlyingChain[] = [];
  for (const [id, contracts] of grouped.entries()) {
    const sorted = [...contracts].sort((a, b) => (a.dte ?? Number.MAX_SAFE_INTEGER) - (b.dte ?? Number.MAX_SAFE_INTEGER));
    const front = sorted[0] ?? null;
    const next = sorted[1] ?? null;
    const totalTurnover = sorted.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
    const totalTrades = sorted.reduce((acc, row) => acc + (row.trades ?? 0), 0);
    const totalOpenInterest = sorted.reduce((acc, row) => acc + (row.openInterest ?? 0), 0);
    const frontTurnoverShare = totalTurnover > 0 && front?.turnover ? front.turnover / totalTurnover : null;
    const nextTurnoverShare = totalTurnover > 0 && next?.turnover ? next.turnover / totalTurnover : null;
    const curveShape = calcCurveShape(front, next);
    const rollState = calcRollState(frontTurnoverShare, nextTurnoverShare);
    chains.push({
      id,
      title: resolveUnderlyingTitle(id),
      contracts: sorted,
      totalTurnover,
      totalTrades,
      totalOpenInterest,
      front,
      next,
      frontTurnoverShare,
      nextTurnoverShare,
      curveShape,
      rollState,
    });
  }

  return chains.sort((a, b) => b.totalTurnover - a.totalTurnover);
}
