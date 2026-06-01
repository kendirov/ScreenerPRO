import type { ScreenerRow } from "@screenerpro/shared";

/** Базовые коды квадрохеджа — не SECID MOEX. */
export type FuturesContractBase = "SI" | "EU" | "CN";

export type ResolvedFuturesContract = {
  base: FuturesContractBase;
  secid: string;
  shortName?: string;
  assetCode?: string;
  boardId?: string;
  market?: string;
  expiryDate?: string;
  isActive: boolean;
  hasCandles?: boolean;
  source: "moex-iss";
  fallbackUsed?: boolean;
  diagnostics: string[];
};

export type FuturesContractCandidate = {
  secid: string;
  shortName: string;
  assetCode?: string | null;
  expiryDate?: string | null;
  turnover?: number | null;
  lastPrice?: number | null;
  tradesCount?: number | null;
};

export const FUTURES_BASE_META: Record<
  FuturesContractBase,
  { label: string; assetCodes: readonly string[]; description: string }
> = {
  SI: {
    label: "USD/RUB",
    assetCodes: ["Si", "SI"],
    description: "Фьючерс USD/RUB (Si*)",
  },
  EU: {
    label: "EUR/RUB",
    assetCodes: ["Eu", "EU"],
    description: "Фьючерс EUR/RUB (Eu*, не Ed)",
  },
  CN: {
    label: "CNY/RUB",
    assetCodes: ["CNY", "CR"],
    description: "Фьючерс CNY/RUB (CR*, asset CNY)",
  },
};

const QUARTERLY_MONTH_CODES = new Set(["H", "M", "U", "Z"]);
const MS_IN_DAY = 24 * 60 * 60 * 1000;

function parseExpiry(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysToExpiry(expiryDate: string | null | undefined, now: Date): number | null {
  const d = parseExpiry(expiryDate);
  if (!d) return null;
  return Math.ceil((d.getTime() - now.getTime()) / MS_IN_DAY);
}

/** Бессрочные / расчётные — не квартальные контракты. */
export function isPerpetualOrCashFuturesTicker(ticker: string): boolean {
  const t = ticker.trim().toUpperCase();
  if (!t) return true;
  if (/F$/.test(t)) return true;
  if (/^(USDRUBF|CNYRUBF|EURRUBF|EURUSDF)$/i.test(t)) return true;
  return false;
}

function isQuarterlyTicker(ticker: string): boolean {
  const t = ticker.trim().toUpperCase();
  return /[HMUZ]\d/.test(t);
}

function assetCodeMatches(base: FuturesContractBase, assetCode: string | null | undefined): boolean {
  if (!assetCode) return false;
  const normalized = assetCode.trim();
  return FUTURES_BASE_META[base].assetCodes.some(
    (code) => code.toLowerCase() === normalized.toLowerCase(),
  );
}

/** Сопоставление SECID / ASSETCODE / shortName с базовой ногой. */
export function matchesFuturesContractBase(
  base: FuturesContractBase,
  ticker: string,
  shortName = "",
  assetCode?: string | null,
): boolean {
  const t = ticker.trim().toUpperCase();
  const name = shortName.trim();

  if (isPerpetualOrCashFuturesTicker(t)) return false;

  if (assetCodeMatches(base, assetCode)) {
    if (base === "EU" && /^ED/.test(t)) return false;
    if (base === "SI" && /^CR|^CNY|^EU|^ED/.test(t)) return false;
    if (base === "CN" && /^SI|^EU|^ED/.test(t)) return false;
    return true;
  }

  switch (base) {
    case "SI":
      if (/^SI[A-Z0-9]/.test(t)) return true;
      if (/USD\s*\/\s*RUB|доллар.*рубл/i.test(name) && !/юан|евро/i.test(name)) return true;
      return false;
    case "EU":
      if (/^ED/.test(t)) return false;
      if (/^EU[A-Z0-9]/.test(t)) return true;
      if (/EUR\s*\/\s*RUB|евро.*рубл/i.test(name) && !/доллар|USD/i.test(name)) return true;
      return false;
    case "CN":
      if (/^CR[A-Z0-9]/.test(t)) return true;
      if (/^CNY[A-Z0-9]/.test(t)) return true;
      if (/юань.*рубл|CNY\/RUB/i.test(name)) return true;
      return false;
  }
}

export function screenerRowToCandidate(row: ScreenerRow): FuturesContractCandidate {
  return {
    secid: row.ticker,
    shortName: row.shortName ?? row.ticker,
    assetCode: (row as ScreenerRow & { assetCode?: string }).assetCode ?? null,
    expiryDate: row.expiryDate ?? null,
    turnover: row.turnover ?? null,
    lastPrice: row.lastPrice ?? null,
    tradesCount: row.tradesCount ?? null,
  };
}

export function rankFuturesContractCandidates(
  candidates: FuturesContractCandidate[],
  base: FuturesContractBase,
  now = new Date(),
): FuturesContractCandidate[] {
  const matched = candidates.filter((c) =>
    matchesFuturesContractBase(base, c.secid, c.shortName, c.assetCode),
  );

  const active = matched.filter((c) => {
    const dte = daysToExpiry(c.expiryDate, now);
    return dte === null || dte >= 0;
  });

  return [...active].sort((a, b) => {
    const ad = daysToExpiry(a.expiryDate, now);
    const bd = daysToExpiry(b.expiryDate, now);
    const aQuarter = isQuarterlyTicker(a.secid);
    const bQuarter = isQuarterlyTicker(b.secid);

    if (aQuarter !== bQuarter) return aQuarter ? -1 : 1;

    if (ad !== null && bd !== null && ad !== bd) return ad - bd;
    if (ad !== null && bd === null) return -1;
    if (ad === null && bd !== null) return 1;

    const turnoverDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
    if (turnoverDiff !== 0) return turnoverDiff;

    const tradesDiff = (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
    if (tradesDiff !== 0) return tradesDiff;

    return a.secid.localeCompare(b.secid, "ru");
  });
}

export function buildResolvedContract(
  base: FuturesContractBase,
  candidate: FuturesContractCandidate | null,
  options?: {
    hasCandles?: boolean;
    fallbackUsed?: boolean;
    diagnostics?: string[];
    isActive?: boolean;
  },
): ResolvedFuturesContract {
  const diagnostics = [...(options?.diagnostics ?? [])];

  if (!candidate) {
    return {
      base,
      secid: "—",
      isActive: false,
      hasCandles: false,
      source: "moex-iss",
      fallbackUsed: options?.fallbackUsed,
      diagnostics: [
        ...diagnostics,
        `${base}: активный контракт не найден через MOEX ISS. Нужна проверка mapping.`,
      ],
    };
  }

  const dte = daysToExpiry(candidate.expiryDate, new Date());
  const isActive = options?.isActive ?? (dte === null || dte >= 0);

  if (dte !== null && dte < 0) {
    diagnostics.push(`${candidate.secid}: экспирация ${candidate.expiryDate} — контракт истёк.`);
  }

  if (options?.fallbackUsed) {
    diagnostics.push(`Использован следующий контракт после пустых свечей.`);
  }

  if (options?.hasCandles === false) {
    diagnostics.push(
      `${base}: контракт ${candidate.secid} найден, но свечей за выбранный период нет.`,
    );
  }

  return {
    base,
    secid: candidate.secid,
    shortName: candidate.shortName,
    assetCode: candidate.assetCode ?? undefined,
    market: "forts",
    expiryDate: candidate.expiryDate ?? undefined,
    isActive,
    hasCandles: options?.hasCandles,
    source: "moex-iss",
    fallbackUsed: options?.fallbackUsed,
    diagnostics,
  };
}

export function collectCandidatesFromScreener(rows: ScreenerRow[]): FuturesContractCandidate[] {
  return rows
    .filter((r) => r.assetClass === "future")
    .map(screenerRowToCandidate);
}

export function quadHedgeContractEmptyMessage(
  contracts: ResolvedFuturesContract[],
): string | null {
  const withCandles = contracts.filter((c) => c.hasCandles);
  if (withCandles.length >= 2) return null;
  return "Нужны минимум два реальных фьючерса с данными. Проверь resolved contracts и выбранную дату.";
}

export function contractStatusLabel(contract: ResolvedFuturesContract): "OK" | "NO DATA" | "NO CONTRACT" {
  if (!contract.secid || contract.secid === "—") return "NO CONTRACT";
  if (contract.hasCandles) return "OK";
  return "NO DATA";
}
