import type { ScreenerRow } from "@screenerpro/shared";

export type FuturesPageMode = "market" | "curve" | "roll";

export interface FuturesContractInFamily {
  ticker: string;
  shortName: string;
  expiryDate: string | null;
  dte: number | null;
  lastPrice: number | null;
  percentChange: number | null;
  turnover: number;
  openInterest: number;
  dayRangePct: number | null;
  turnoverShareWithinGroup: number;
  oiShareWithinGroup: number;
  frontRecencyScore: number;
}

export interface FuturesFamilyCurve {
  frontNextSpread: number | null;
  curveShape: "contango" | "backwardation" | "flat";
  annualizedCarry: number | null;
}

export interface FuturesFamilyBasis {
  basis: number | null;
  annualizedCarry: number | null;
}

export interface FuturesFamilyGroup {
  familyKey: string;
  familyLabel: string;
  activeContractTicker: string;
  activeContractScore: number;
  totalTurnover: number;
  totalOpenInterest: number;
  activePrice: number | null;
  activePercentChange: number | null;
  activeRangePct: number | null;
  signal: string;
  curve: FuturesFamilyCurve;
  basis: FuturesFamilyBasis;
  contracts: FuturesContractInFamily[];
  comparableContracts: FuturesContractInFamily[];
  subfamilies: FuturesSubfamily[];
  mainTradingLineKey: string | null;
  mainOILineKey: string | null;
  secondaryOiLineContract: string | null;
  anchorContracts: FuturesContractInFamily[];
  nextSeriesTicker: string | null;
  frontTurnoverShare: number;
  rollStatus: "Фронт" | "Слабый" | "Идёт" | "Активный";
  rollRatio: number;
}

export interface FuturesSubfamily {
  key: string;
  contracts: FuturesContractInFamily[];
  totalTurnover: number;
  totalOpenInterest: number;
  totalTurnoverShare: number;
  totalOIShare: number;
  frontContract: FuturesContractInFamily | null;
  nextContract: FuturesContractInFamily | null;
  comparableCurvePointsCount: number;
}

interface FamilyAlias {
  key: string;
  label: string;
  spotTicker?: string;
}

const MONTH_CODES = "FGHJKMNQUVXZ";
const MS_IN_DAY = 24 * 60 * 60 * 1000;

const STATIC_ALIASES: Array<{ match: RegExp; alias: FamilyAlias }> = [
  { match: /^(si|usdrub)/i, alias: { key: "usd_rub", label: "Доллар/рубль" } },
  { match: /^(cr|cny|uc)/i, alias: { key: "cny_rub", label: "Юань/рубль" } },
  { match: /^(eu|ed|eur)/i, alias: { key: "eur_rub", label: "Евро/рубль" } },
  { match: /^(br|bm)/i, alias: { key: "brent", label: "Brent" } },
  { match: /^(ng)/i, alias: { key: "natural_gas", label: "Газ" } },
  { match: /^(gd|gold)/i, alias: { key: "gold", label: "Золото" } },
  { match: /^(sv|silver)/i, alias: { key: "silver", label: "Серебро" } },
  { match: /^(ri|rts)/i, alias: { key: "rts", label: "RTS" } },
  { match: /^(mx|mm|imoex)/i, alias: { key: "imoex", label: "IMOEX" } },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toFinite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseExpiryDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysToExpiry(expiryDate: string | null | undefined, nowDate: Date): number | null {
  const date = parseExpiryDate(expiryDate);
  if (!date) return null;
  return Math.ceil((date.getTime() - nowDate.getTime()) / MS_IN_DAY);
}

function detectFromTicker(ticker: string, shortName: string): FamilyAlias {
  const normalizedTicker = ticker.toLowerCase();
  const normalizedName = shortName.toLowerCase();
  for (const entry of STATIC_ALIASES) {
    if (entry.match.test(normalizedTicker) || entry.match.test(normalizedName)) {
      return entry.alias;
    }
  }

  const prefix = normalizedTicker.replace(/[0-9]/g, "").replace(new RegExp(`[${MONTH_CODES}]`, "gi"), "");
  if (prefix.length >= 3) {
    const equity = prefix.toUpperCase();
    return { key: `equity:${equity}`, label: equity };
  }
  const fallback = normalizedTicker.slice(0, 3).toUpperCase() || ticker.toUpperCase();
  return { key: `other:${fallback}`, label: fallback };
}

function frontRecencyScore(rank: number, dte: number | null): number {
  const base = rank === 0 ? 1 : rank === 1 ? 0.82 : rank === 2 ? 0.62 : 0.45;
  if (dte !== null && dte <= 7) return base * 0.35;
  return base;
}

function computeCurve(contracts: FuturesContractInFamily[]): FuturesFamilyCurve {
  const withPrice = contracts.filter((contract) => contract.lastPrice !== null);
  if (withPrice.length < 2) {
    return { frontNextSpread: null, curveShape: "flat", annualizedCarry: null };
  }
  const front = withPrice[0];
  const next = withPrice[1];
  if (front.lastPrice === null || next.lastPrice === null || front.lastPrice === 0) {
    return { frontNextSpread: null, curveShape: "flat", annualizedCarry: null };
  }
  const spread = ((next.lastPrice - front.lastPrice) / front.lastPrice) * 100;

  let increasing = 0;
  let decreasing = 0;
  for (let i = 1; i < withPrice.length; i += 1) {
    const prev = withPrice[i - 1];
    const cur = withPrice[i];
    if (prev.lastPrice === null || cur.lastPrice === null || prev.lastPrice === 0) continue;
    const step = ((cur.lastPrice - prev.lastPrice) / prev.lastPrice) * 100;
    if (step > 0.08) increasing += 1;
    if (step < -0.08) decreasing += 1;
  }

  const shape: FuturesFamilyCurve["curveShape"] =
    increasing > decreasing ? "contango" : decreasing > increasing ? "backwardation" : "flat";
  const dteDiff =
    front.dte !== null && next.dte !== null && next.dte > front.dte
      ? next.dte - front.dte
      : null;
  const annualizedCarry = dteDiff && dteDiff > 0 ? (spread / dteDiff) * 365 : null;
  return {
    frontNextSpread: round2(spread),
    curveShape: shape,
    annualizedCarry: annualizedCarry === null ? null : round2(annualizedCarry),
  };
}

function isAnchorTicker(ticker: string): boolean {
  return /f$/i.test(ticker);
}

function seriesPrefix(ticker: string): string {
  return ticker.replace(/[0-9]/g, "").replace(new RegExp(`[${MONTH_CODES}]`, "gi"), "").toUpperCase();
}

function contractsCompatibleByPriceScale(item: FuturesContractInFamily, activePrice: number | null): boolean {
  if (item.lastPrice === null || activePrice === null || activePrice <= 0) return false;
  const ratio = item.lastPrice / activePrice;
  return ratio >= 0.8 && ratio <= 1.25;
}

function buildSubfamilies(contracts: FuturesContractInFamily[]): {
  subfamilies: FuturesSubfamily[];
  anchorContracts: FuturesContractInFamily[];
} {
  const anchorContracts = contracts.filter((item) => isAnchorTicker(item.ticker));
  const nonAnchor = contracts.filter((item) => !isAnchorTicker(item.ticker));
  const totalTurnover = contracts.reduce((acc, item) => acc + item.turnover, 0);
  const totalOi = contracts.reduce((acc, item) => acc + item.openInterest, 0);

  const bySubfamily = new Map<string, FuturesContractInFamily[]>();
  for (const contract of nonAnchor) {
    const key = seriesPrefix(contract.ticker) || contract.ticker;
    const bucket = bySubfamily.get(key);
    if (bucket) bucket.push(contract);
    else bySubfamily.set(key, [contract]);
  }

  const subfamilies: FuturesSubfamily[] = [...bySubfamily.entries()].map(([key, items]) => {
    const ordered = [...items].sort((a, b) => (a.dte ?? Number.POSITIVE_INFINITY) - (b.dte ?? Number.POSITIVE_INFINITY));
    const sfTurnover = ordered.reduce((acc, item) => acc + item.turnover, 0);
    const sfOi = ordered.reduce((acc, item) => acc + item.openInterest, 0);
    return {
      key,
      contracts: ordered,
      totalTurnover: sfTurnover,
      totalOpenInterest: sfOi,
      totalTurnoverShare: totalTurnover > 0 ? sfTurnover / totalTurnover : 0,
      totalOIShare: totalOi > 0 ? sfOi / totalOi : 0,
      frontContract: ordered[0] ?? null,
      nextContract: ordered[1] ?? null,
      comparableCurvePointsCount: ordered.length,
    };
  });

  return { subfamilies, anchorContracts };
}

function computeRollStatus(front: FuturesContractInFamily | undefined, next: FuturesContractInFamily | undefined): {
  status: FuturesFamilyGroup["rollStatus"];
  ratio: number;
} {
  if (!front) return { status: "Фронт", ratio: 0 };
  const nextToFront = front.turnover > 0 && next ? next.turnover / front.turnover : 0;
  if (nextToFront >= 0.65) return { status: "Активный", ratio: nextToFront };
  if (nextToFront >= 0.35) return { status: "Идёт", ratio: nextToFront };
  if (nextToFront >= 0.2) return { status: "Слабый", ratio: nextToFront };
  return { status: "Фронт", ratio: nextToFront };
}

function signalForGroup(active: FuturesContractInFamily, contracts: FuturesContractInFamily[], curve: FuturesFamilyCurve): string {
  const front = contracts[0];
  const next = contracts[1];
  if (front && next) {
    const turnoverRoll = front.turnover > 0 && next.turnover >= front.turnover * 0.65;
    const oiRoll = front.openInterest > 0 && next.openInterest >= front.openInterest * 0.8;
    if (turnoverRoll || oiRoll) return "Перекат в следующую";
  }
  if (active.openInterest > 0 && Math.abs(active.percentChange ?? 0) >= 0.7) {
    return (active.percentChange ?? 0) > 0 ? "ОИ растет на движении" : "ОИ падает на движении";
  }
  if (curve.curveShape === "backwardation") return "Кривая инвертируется";
  if (Math.abs(curve.annualizedCarry ?? 0) >= 25) return "Базис растянут";
  return "Деньги во фронте";
}

export function buildFuturesFamilies(rows: ScreenerRow[], now = new Date()): FuturesFamilyGroup[] {
  const futures = rows.filter((row) => row.assetClass === "future");
  const grouped = new Map<string, { alias: FamilyAlias; rows: ScreenerRow[] }>();

  for (const row of futures) {
    const alias = detectFromTicker(row.ticker, row.shortName);
    const bucket = grouped.get(alias.key);
    if (bucket) {
      bucket.rows.push(row);
      continue;
    }
    grouped.set(alias.key, { alias, rows: [row] });
  }

  const families: FuturesFamilyGroup[] = [];
  for (const [, value] of grouped) {
    const sorted = [...value.rows].sort((a, b) => {
      const ad = daysToExpiry(a.expiryDate, now);
      const bd = daysToExpiry(b.expiryDate, now);
      if (ad !== null && bd !== null && ad !== bd) return ad - bd;
      return (b.turnover ?? 0) - (a.turnover ?? 0);
    });
    const totalTurnover = sorted.reduce((acc, row) => acc + toFinite(row.turnover), 0);
    const totalOi = sorted.reduce((acc, row) => acc + toFinite(row.openInterest), 0);
    const contracts: FuturesContractInFamily[] = sorted.map((row, idx) => {
      const turnover = toFinite(row.turnover);
      const oi = toFinite(row.openInterest);
      const dte = daysToExpiry(row.expiryDate, now);
      return {
        ticker: row.ticker,
        shortName: row.shortName,
        expiryDate: row.expiryDate ?? null,
        dte,
        lastPrice: row.lastPrice,
        percentChange: row.percentChange,
        turnover,
        openInterest: oi,
        dayRangePct: row.metrics.dayRangePct,
        turnoverShareWithinGroup: totalTurnover > 0 ? round2(turnover / totalTurnover) : 0,
        oiShareWithinGroup: totalOi > 0 ? round2(oi / totalOi) : 0,
        frontRecencyScore: frontRecencyScore(idx, dte),
      };
    });
    if (!contracts.length) continue;

    const { subfamilies, anchorContracts } = buildSubfamilies(contracts);
    const mainTradingLine = [...subfamilies].sort((a, b) => b.totalTurnover - a.totalTurnover)[0] ?? null;
    const mainOILine = [...subfamilies].sort((a, b) => b.totalOpenInterest - a.totalOpenInterest)[0] ?? null;
    const tradingContracts = mainTradingLine?.contracts ?? contracts;

    const scores = tradingContracts.map((contract) => ({
      ticker: contract.ticker,
      score: round2(
        contract.turnoverShareWithinGroup * 0.55
          + contract.oiShareWithinGroup * 0.3
          + contract.frontRecencyScore * 0.15,
      ),
    }));
    const bestByScore = [...scores].sort((a, b) => b.score - a.score)[0];
    const front = tradingContracts[0];
    const next = tradingContracts[1];
    let activeTicker = bestByScore?.ticker ?? tradingContracts[0]?.ticker ?? contracts[0].ticker;
    if (front && next) {
      const frontDtePenalty = front.dte !== null && front.dte <= 7;
      const turnoverRoll = front.turnover > 0 && next.turnover >= front.turnover * 0.65;
      if (frontDtePenalty && turnoverRoll) {
        activeTicker = next.ticker;
      }
    }
    const active = tradingContracts.find((contract) => contract.ticker === activeTicker) ?? tradingContracts[0] ?? contracts[0];
    const activeScore = scores.find((item) => item.ticker === active.ticker)?.score ?? 0;
    const comparableContracts = tradingContracts.filter((item) => contractsCompatibleByPriceScale(item, active.lastPrice));
    const curve = computeCurve(comparableContracts.length >= 2 ? comparableContracts : contracts);
    const signal = signalForGroup(active, contracts, curve);
    const frontComparable = comparableContracts[0];
    const nextComparable = comparableContracts[1];
    const frontTurnoverShare = frontComparable?.turnoverShareWithinGroup ?? 0;
    const roll = computeRollStatus(frontComparable, nextComparable);
    const secondaryOiLineContract =
      mainOILine && mainTradingLine && mainOILine.key !== mainTradingLine.key
        ? (mainOILine.frontContract?.ticker ?? null)
        : null;

    families.push({
      familyKey: value.alias.key,
      familyLabel: value.alias.label,
      activeContractTicker: active.ticker,
      activeContractScore: activeScore,
      totalTurnover,
      totalOpenInterest: totalOi,
      activePrice: active.lastPrice,
      activePercentChange: active.percentChange,
      activeRangePct: active.dayRangePct,
      signal,
      curve,
      basis: {
        basis: null,
        annualizedCarry: curve.annualizedCarry,
      },
      contracts,
      comparableContracts,
      subfamilies,
      mainTradingLineKey: mainTradingLine?.key ?? null,
      mainOILineKey: mainOILine?.key ?? null,
      secondaryOiLineContract,
      anchorContracts,
      nextSeriesTicker: nextComparable?.ticker ?? null,
      frontTurnoverShare,
      rollStatus: roll.status,
      rollRatio: round2(roll.ratio),
    });
  }

  return families.sort((a, b) => b.totalTurnover - a.totalTurnover);
}

export function rankFamiliesByMode(families: FuturesFamilyGroup[], mode: FuturesPageMode): FuturesFamilyGroup[] {
  if (mode === "curve") {
    return [...families].sort((a, b) => Math.abs(b.curve.annualizedCarry ?? 0) - Math.abs(a.curve.annualizedCarry ?? 0));
  }
  if (mode === "roll") {
    return [...families].sort((a, b) => {
      const aFront = a.contracts[0];
      const aNext = a.contracts[1];
      const bFront = b.contracts[0];
      const bNext = b.contracts[1];
      const aRoll = aFront && aNext && aFront.turnover > 0 ? aNext.turnover / aFront.turnover : 0;
      const bRoll = bFront && bNext && bFront.turnover > 0 ? bNext.turnover / bFront.turnover : 0;
      return bRoll - aRoll;
    });
  }
  return [...families].sort((a, b) => b.totalTurnover - a.totalTurnover);
}
