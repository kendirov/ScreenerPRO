import type { ScreenerRow } from "@screenerpro/shared";

export type CurrencyCorrelationFamily = "SI" | "CNY" | "ED";

export type CurrencyCorrelationInstrument = {
  family: CurrencyCorrelationFamily;
  label: string;
  ticker: string;
  baseName: string;
  lastPrice: number | null;
  changePct: number | null;
  turnoverRub: number | null;
  tradesCount: number | null;
};

export type CurrencyCorrelationCard = CurrencyCorrelationInstrument & {
  status: "найден" | "нет данных";
};

export type CurrencyCorrelationSnapshot = {
  instruments: CurrencyCorrelationCard[];
  foundCount: number;
  totalFamilies: 3;
};

/** @todo Загрузка истории по активным тикерам (MOEX ISS candles или ingest/SQLite). */
export type CurrencyHistoryRequest = {
  tickers: string[];
  limitDays: number;
};

/** @todo Нормализация рядов от 100. */
export type NormalizedPriceSeries = {
  ticker: string;
  dates: string[];
  values: number[];
};

/** @todo Скользящая корреляция по изменениям. */
export type RollingCorrelationSeries = {
  window: number;
  dates: string[];
  pairs: Array<{ a: CurrencyCorrelationFamily; b: CurrencyCorrelationFamily; values: (number | null)[] }>;
};

/** @todo Зоны расхождения от среднего. */
export type DivergenceZone = {
  family: CurrencyCorrelationFamily;
  startDate: string;
  endDate: string;
  severity: "умеренное" | "сильное";
};

export const CURRENCY_FAMILY_META: Record<
  CurrencyCorrelationFamily,
  { label: string; baseName: string; emptyHint: string }
> = {
  SI: { label: "Доллар/рубль", baseName: "USD/RUB", emptyHint: "Нет активного контракта Si в текущих данных" },
  CNY: { label: "Юань/рубль", baseName: "CNY/RUB", emptyHint: "Нет активного контракта юань/рубль в текущих данных" },
  ED: {
    label: "Евро/доллар",
    baseName: "EUR/USD",
    emptyHint: "Евро/доллар: нет активного контракта в текущих данных",
  },
};

function matchesSi(ticker: string, shortName: string): boolean {
  const t = ticker.toUpperCase();
  if (/^SI[A-Z0-9]/.test(t) || t === "SI") return true;
  if (/USD\s*\/\s*RUB|доллар.*рубл/i.test(shortName)) return true;
  return false;
}

function matchesCny(ticker: string, shortName: string): boolean {
  const t = ticker.toUpperCase();
  if (/^CR[A-Z0-9]/.test(t)) return true;
  if (/^CNY/.test(t) || /CNYRUB/i.test(t)) return true;
  if (/юань.*рубл|CNY\/RUB/i.test(shortName)) return true;
  return false;
}

/** ED — кросс евро/доллар; Eu/Eu* — евро/рубль, не путать. */
function matchesEd(ticker: string, shortName: string): boolean {
  const t = ticker.toUpperCase();
  if (/^EU[A-Z0-9]/.test(t) && !/^ED/.test(t)) return false;
  if (/^ED[A-Z0-9]/.test(t) || t === "ED") return true;
  if (/EUR\s*\/\s*USD|евро.*доллар/i.test(shortName) && !/рубл/i.test(shortName)) return true;
  return false;
}

const FAMILY_MATCHERS: Record<CurrencyCorrelationFamily, (ticker: string, shortName: string) => boolean> = {
  SI: matchesSi,
  CNY: matchesCny,
  ED: matchesEd,
};

function compareActiveContracts(a: ScreenerRow, b: ScreenerRow): number {
  const turnoverDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
  if (turnoverDiff !== 0) return turnoverDiff;
  const tradesDiff = (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
  if (tradesDiff !== 0) return tradesDiff;
  return a.ticker.localeCompare(b.ticker, "ru");
}

export function resolveCurrencyFamily(ticker: string, shortName = ""): CurrencyCorrelationFamily | null {
  if (matchesSi(ticker, shortName)) return "SI";
  if (matchesCny(ticker, shortName)) return "CNY";
  if (matchesEd(ticker, shortName)) return "ED";
  return null;
}

function rowToInstrument(row: ScreenerRow, family: CurrencyCorrelationFamily): CurrencyCorrelationInstrument {
  const meta = CURRENCY_FAMILY_META[family];
  return {
    family,
    label: meta.label,
    ticker: row.ticker,
    baseName: meta.baseName,
    lastPrice: row.lastPrice,
    changePct: row.percentChange,
    turnoverRub: row.turnover ?? null,
    tradesCount: row.tradesCount ?? null,
  };
}

function emptyCard(family: CurrencyCorrelationFamily): CurrencyCorrelationCard {
  const meta = CURRENCY_FAMILY_META[family];
  return {
    family,
    label: meta.label,
    ticker: "—",
    baseName: meta.baseName,
    lastPrice: null,
    changePct: null,
    turnoverRub: null,
    tradesCount: null,
    status: "нет данных",
  };
}

const CANDIDATE_LIMIT = 5;

export function pickContractCandidatesForFamily(
  rows: ScreenerRow[],
  family: CurrencyCorrelationFamily,
  limit = CANDIDATE_LIMIT,
): ScreenerRow[] {
  const futures = rows.filter((row) => row.assetClass === "future");
  const matcher = FAMILY_MATCHERS[family];
  const candidates = futures.filter((row) => matcher(row.ticker, row.shortName ?? ""));
  if (!candidates.length) return [];
  return [...candidates].sort(compareActiveContracts).slice(0, limit);
}

export function pickActiveContractForFamily(
  rows: ScreenerRow[],
  family: CurrencyCorrelationFamily,
): CurrencyCorrelationCard | null {
  const ranked = pickContractCandidatesForFamily(rows, family, 1);
  if (!ranked.length) return null;
  const chosen = ranked[0]!;

  return {
    ...rowToInstrument(chosen, family),
    status: "найден",
  };
}

export function buildCurrencyCorrelationSnapshot(rows: ScreenerRow[]): CurrencyCorrelationSnapshot {
  const families: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];
  const instruments = families.map((family) => pickActiveContractForFamily(rows, family) ?? emptyCard(family));
  const foundCount = instruments.filter((item) => item.status === "найден").length;

  return {
    instruments,
    foundCount,
    totalFamilies: 3,
  };
}

/** @todo Реализовать: fetch + normalize + correlation + divergence. */
export async function buildCurrencyCorrelationAnalytics(
  _rows: ScreenerRow[],
): Promise<{
  normalized: NormalizedPriceSeries[];
  correlation: RollingCorrelationSeries | null;
  divergence: DivergenceZone[];
}> {
  return { normalized: [], correlation: null, divergence: [] };
}
