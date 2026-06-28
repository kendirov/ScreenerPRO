import type { ScreenerRow } from "@screenerpro/shared";

export type StockExclusionReason =
  | "non-stock-asset-class"
  | "missing-ticker"
  | "missing-market-data"
  | "bond-like-secid"
  | "ofz-like-secid"
  | "isin-like-ticker"
  | "invalid-ticker-shape"
  | "excluded-name-bond"
  | "excluded-name-fund";

export type ExcludedInstrument = {
  ticker: string;
  reason: StockExclusionReason;
};

export type UniverseFilterAudit = {
  rawRows: number;
  afterAssetClass: number;
  afterTypeFilter: number;
  afterTickerShapeFilter: number;
  afterBondFundExclusion: number;
  duplicatesRemoved: number;
  invalidRowsRemoved: number;
  excludedBondLike: number;
  excludedFunds: number;
  excludedExamples: ExcludedInstrument[];
};

const BOND_NAME = /облигац|бонд|\bофз\b|купон|замещающ|выпуск\s*\d|exchange bond/i;
const FUND_NAME = /\bфонд\b|бpif|bpif|\betf\b|\bpif\b|управляющ|mutual fund|биржевой фонд|паев/i;
const EQUITY_TICKER = /^[A-Z][A-Z0-9]{0,6}(P|PR|RP|RX|DR|SP)?$/i;

function isBondLikeReason(reason: StockExclusionReason): boolean {
  return (
    reason === "bond-like-secid" ||
    reason === "ofz-like-secid" ||
    reason === "isin-like-ticker" ||
    reason === "excluded-name-bond"
  );
}

function isFundReason(reason: StockExclusionReason): boolean {
  return reason === "excluded-name-fund";
}

function checkTickerShape(ticker: string): StockExclusionReason | null {
  if (/^RU000/i.test(ticker)) return "bond-like-secid";
  if (/^SU\d/i.test(ticker)) return "ofz-like-secid";
  if (/^RU[A-Z0-9]{10,}$/i.test(ticker)) return "isin-like-ticker";
  if (ticker.length > 8 || !EQUITY_TICKER.test(ticker)) return "invalid-ticker-shape";
  return null;
}

function checkName(name: string): StockExclusionReason | null {
  if (BOND_NAME.test(name)) return "excluded-name-bond";
  if (FUND_NAME.test(name)) return "excluded-name-fund";
  return null;
}

export function classifyStockInstrument(row: ScreenerRow): { valid: boolean; reason?: StockExclusionReason } {
  if (row.assetClass !== "stock") return { valid: false, reason: "non-stock-asset-class" };
  const ticker = row.ticker?.trim().toUpperCase() ?? "";
  if (!ticker) return { valid: false, reason: "missing-ticker" };
  if (row.lastPrice == null && (row.turnover ?? 0) <= 0 && (row.tradesCount ?? 0) <= 0) {
    return { valid: false, reason: "missing-market-data" };
  }
  const shapeReason = checkTickerShape(ticker);
  if (shapeReason) return { valid: false, reason: shapeReason };
  const nameReason = checkName((row.shortName ?? "").trim());
  if (nameReason) return { valid: false, reason: nameReason };
  return { valid: true };
}

function rowActivityScore(row: ScreenerRow): number {
  return (row.turnover ?? 0) + (row.tradesCount ?? 0) * 1000;
}

export function filterValidStockUniverse(rows: ScreenerRow[]): {
  universe: ScreenerRow[];
  audit: UniverseFilterAudit;
} {
  const rawRows = rows.length;
  let afterAssetClass = 0;
  let afterTypeFilter = 0;
  let afterTickerShapeFilter = 0;
  let afterBondFundExclusion = 0;
  let invalidRowsRemoved = 0;
  let excludedBondLike = 0;
  let excludedFunds = 0;
  let duplicatesRemoved = 0;
  const excludedExamples: ExcludedInstrument[] = [];
  const byTicker = new Map<string, ScreenerRow>();

  for (const row of rows) {
    if (row.assetClass !== "stock") continue;
    afterAssetClass++;

    const ticker = row.ticker?.trim().toUpperCase() ?? "";
    if (!ticker) {
      invalidRowsRemoved++;
      pushExcluded(excludedExamples, ticker || row.ticker, "missing-ticker");
      continue;
    }
    if (row.lastPrice == null && (row.turnover ?? 0) <= 0 && (row.tradesCount ?? 0) <= 0) {
      invalidRowsRemoved++;
      pushExcluded(excludedExamples, ticker, "missing-market-data");
      continue;
    }
    afterTypeFilter++;

    const shapeReason = checkTickerShape(ticker);
    if (shapeReason) {
      invalidRowsRemoved++;
      if (isBondLikeReason(shapeReason)) excludedBondLike++;
      pushExcluded(excludedExamples, ticker, shapeReason);
      continue;
    }
    afterTickerShapeFilter++;

    const nameReason = checkName((row.shortName ?? "").trim());
    if (nameReason) {
      invalidRowsRemoved++;
      if (isFundReason(nameReason)) excludedFunds++;
      else if (isBondLikeReason(nameReason)) excludedBondLike++;
      pushExcluded(excludedExamples, ticker, nameReason);
      continue;
    }
    afterBondFundExclusion++;

    const existing = byTicker.get(ticker);
    if (existing) {
      duplicatesRemoved++;
      if (rowActivityScore(row) > rowActivityScore(existing)) {
        byTicker.set(ticker, { ...row, ticker: row.ticker.trim() });
      }
    } else {
      byTicker.set(ticker, { ...row, ticker: row.ticker.trim() });
    }
  }

  return {
    universe: [...byTicker.values()],
    audit: {
      rawRows,
      afterAssetClass,
      afterTypeFilter,
      afterTickerShapeFilter,
      afterBondFundExclusion,
      duplicatesRemoved,
      invalidRowsRemoved,
      excludedBondLike,
      excludedFunds,
      excludedExamples,
    },
  };
}

function pushExcluded(list: ExcludedInstrument[], ticker: string, reason: StockExclusionReason) {
  if (list.length >= 20) return;
  list.push({ ticker, reason });
}

export { EQUITY_TICKER };
