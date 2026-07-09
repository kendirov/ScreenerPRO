import type { ScreenerRow } from "@screenerpro/shared";

export type StockUniverseCategory =
  | "stock"
  | "preferred_stock"
  | "fund"
  | "etf"
  | "bond"
  | "currency"
  | "futures"
  | "index"
  | "unknown";

export type StockUniverseDecision = {
  isStock: boolean;
  reason: string;
  category: StockUniverseCategory;
};

/** @deprecated use StockUniverseDecision.reason mapping */
export type StockExclusionReason =
  | "non-stock-asset-class"
  | "missing-ticker"
  | "missing-market-data"
  | "bond-like-secid"
  | "ofz-like-secid"
  | "isin-like-ticker"
  | "invalid-ticker-shape"
  | "excluded-name-bond"
  | "excluded-name-fund"
  | "excluded-etf"
  | "excluded-gdr"
  | "excluded-moex-sectype"
  | "unknown-instrument";

export type ExcludedInstrument = {
  ticker: string;
  reason: string;
  category: StockUniverseCategory;
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
  excludedEtfs: number;
  excludedExamples: ExcludedInstrument[];
};

export type StockUniverseAudit = {
  total: number;
  tickerLikeSecids: number;
  ru000Secids: number;
  likelyFunds: number;
  likelyEtfs: number;
  likelyBonds: number;
  likelyStocks: number;
  likelyPreferredStocks: number;
  unknown: number;
  stockOnlyCount: number;
  topExcluded: Array<{ ticker: string; shortName: string; category: StockUniverseCategory; reason: string }>;
  byCategory: Record<StockUniverseCategory, number>;
};

/** MOEX ISS shares board for ordinary/preferred equities. */
export const EQUITY_SHARE_BOARDS = new Set(["TQBR", "EQBR", "SMAL"]);

/**
 * Ticker-like MOEX share SECID (includes preferred suffixes P/PR/… — not funds-only "ends with P").
 * @see docs/STOCK_UNIVERSE_FILTER.md
 */
export const EQUITY_TICKER = /^[A-Z][A-Z0-9]{0,6}(P|PR|RP|RX|DR|SP)?$/i;

const BOND_NAME =
  /облигац|бонд|\bофз\b|купон|замещающ|выпуск\s*\d|exchange bond|еврооблигац/i;
const FUND_NAME =
  /\bфонд\b|бpif|bpif|\bпиф\b|\bpif\b|биржевой фонд|паев|управляющ|mutual fund|зпиф|ипиф/i;
const ETF_NAME = /\betf\b|биржевой паевой|бпиф/i;
const GDR_NAME = /(?:^|[-\s])гдр(?:\b|$)|\bgdr\b/i;

/** MOEX SECTYPE on shares board — see ISS reference. */
const MOEX_SECTYPE_COMMON = new Set(["1"]);
const MOEX_SECTYPE_PREFERRED = new Set(["2"]);
const MOEX_SECTYPE_ETF = new Set(["J"]);
const MOEX_SECTYPE_FUND = new Set(["9", "A"]);
const MOEX_SECTYPE_BOND = new Set(["B"]);
const MOEX_SECTYPE_GDR = new Set(["D"]);

type UniverseRowFields = {
  ticker: string;
  shortName: string;
  assetClass: string | null;
  board: string | null;
  boardid: string | null;
  primaryBoardid: string | null;
  sectype: string | null;
  securityType: string | null;
  type: string | null;
  group: string | null;
  lastPrice: number | null;
  turnover: number | null;
  tradesCount: number | null;
};

function pickString(row: unknown, keys: string[]): string | null {
  if (!row || typeof row !== "object") return null;
  const obj = row as Record<string, unknown>;
  for (const key of keys) {
    const parts = key.split(".");
    let cur: unknown = obj;
    for (const part of parts) {
      if (!cur || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
  }
  return null;
}

function pickNumber(row: unknown, keys: string[]): number | null {
  if (!row || typeof row !== "object") return null;
  const obj = row as Record<string, unknown>;
  for (const key of keys) {
    const parts = key.split(".");
    let cur: unknown = obj;
    for (const part of parts) {
      if (!cur || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    if (typeof cur === "number" && Number.isFinite(cur)) return cur;
  }
  return null;
}

function extractRowFields(row: unknown): UniverseRowFields | null {
  const ticker =
    pickString(row, ["ticker", "secid", "symbol", "SECID"])?.toUpperCase() ?? "";
  if (!ticker) return null;

  return {
    ticker,
    shortName: pickString(row, ["shortName", "name", "SHORTNAME"]) ?? ticker,
    assetClass: pickString(row, ["assetClass", "asset_class"]),
    board: pickString(row, ["board", "BOARD"]),
    boardid: pickString(row, ["boardid", "boardId", "BOARDID"]),
    primaryBoardid: pickString(row, ["primary_boardid", "primaryBoardid", "PRIMARY_BOARDID"]),
    sectype: pickString(row, ["moexSecType", "sectype", "secType", "SECTYPE", "securityType"]),
    securityType: pickString(row, ["securityType", "security_type"]),
    type: pickString(row, ["type", "TYPE", "instrid", "INSTRID"]),
    group: pickString(row, ["group", "GROUP", "market", "MARKET", "engine", "ENGINE"]),
    lastPrice: pickNumber(row, ["lastPrice", "last", "LAST"]),
    turnover: pickNumber(row, ["turnover", "value", "VALTODAY"]),
    tradesCount: pickNumber(row, ["tradesCount", "trades", "NUMTRADES"]),
  };
}

function normalizeMoexSectype(sectype: string | null): string | null {
  if (!sectype) return null;
  return sectype.trim().toUpperCase();
}

function isTickerLikeShareSecid(ticker: string): boolean {
  return EQUITY_TICKER.test(ticker);
}

function isRu000Secid(ticker: string): boolean {
  return /^RU000/i.test(ticker);
}

function isOfzSecid(ticker: string): boolean {
  return /^SU\d/i.test(ticker);
}

function isIsinLikeSecid(ticker: string): boolean {
  return /^RU[A-Z0-9]{10,}$/i.test(ticker);
}

function hasTradingData(fields: UniverseRowFields): boolean {
  if (fields.lastPrice != null && fields.lastPrice > 0) return true;
  if ((fields.turnover ?? 0) > 0) return true;
  if ((fields.tradesCount ?? 0) > 0) return true;
  return false;
}

function classifyByMoexSectype(sectype: string): StockUniverseDecision | null {
  if (MOEX_SECTYPE_COMMON.has(sectype)) {
    return { isStock: true, reason: "moex-sectype-common-share", category: "stock" };
  }
  if (MOEX_SECTYPE_PREFERRED.has(sectype)) {
    return { isStock: true, reason: "moex-sectype-preferred-share", category: "preferred_stock" };
  }
  if (MOEX_SECTYPE_ETF.has(sectype)) {
    return { isStock: false, reason: "moex-sectype-etf", category: "etf" };
  }
  if (MOEX_SECTYPE_FUND.has(sectype)) {
    return { isStock: false, reason: "moex-sectype-fund", category: "fund" };
  }
  if (MOEX_SECTYPE_BOND.has(sectype)) {
    return { isStock: false, reason: "moex-sectype-bond-or-unit", category: "bond" };
  }
  if (MOEX_SECTYPE_GDR.has(sectype)) {
    return { isStock: false, reason: "moex-sectype-gdr", category: "unknown" };
  }
  return null;
}

function classifyByName(shortName: string): StockUniverseDecision | null {
  if (BOND_NAME.test(shortName)) {
    return { isStock: false, reason: "name-bond-like", category: "bond" };
  }
  if (ETF_NAME.test(shortName)) {
    return { isStock: false, reason: "name-etf-like", category: "etf" };
  }
  if (FUND_NAME.test(shortName)) {
    return { isStock: false, reason: "name-fund-like", category: "fund" };
  }
  if (GDR_NAME.test(shortName)) {
    return { isStock: false, reason: "name-gdr-like", category: "unknown" };
  }
  return null;
}

/**
 * Pure classifier for stock screener universe membership.
 * Accepts ScreenerRow, MOEX ISS row objects, or partial shapes.
 */
export function classifyStockUniverse(row: unknown): StockUniverseDecision {
  const fields = extractRowFields(row);
  if (!fields) {
    return { isStock: false, reason: "missing-secid", category: "unknown" };
  }

  if (fields.assetClass === "future") {
    return { isStock: false, reason: "asset-class-future", category: "futures" };
  }

  const board = (fields.boardid ?? fields.board ?? fields.primaryBoardid ?? "").toUpperCase();
  if (board && !EQUITY_SHARE_BOARDS.has(board) && board !== "TQBR") {
    if (/CETS|CNG|CUR|FX/.test(board)) {
      return { isStock: false, reason: `board-currency-${board}`, category: "currency" };
    }
    if (/FORTS|RFUD|RFUT/.test(board)) {
      return { isStock: false, reason: `board-futures-${board}`, category: "futures" };
    }
    if (/INDEX|INDX/.test(board)) {
      return { isStock: false, reason: `board-index-${board}`, category: "index" };
    }
    if (board && board !== "TQBR") {
      return { isStock: false, reason: `board-not-equity-${board}`, category: "unknown" };
    }
  }

  const sectype = normalizeMoexSectype(fields.sectype ?? fields.securityType ?? fields.type);
  if (sectype) {
    const bySectype = classifyByMoexSectype(sectype);
    if (bySectype) return bySectype;
  }

  const nameDecision = classifyByName(fields.shortName);
  if (nameDecision) return nameDecision;

  if (isOfzSecid(fields.ticker)) {
    return { isStock: false, reason: "secid-ofz-like", category: "bond" };
  }

  if (isRu000Secid(fields.ticker) || isIsinLikeSecid(fields.ticker)) {
    return {
      isStock: false,
      reason: "secid-isin-or-ru000-without-share-metadata",
      category: "bond",
    };
  }

  if (!isTickerLikeShareSecid(fields.ticker)) {
    return { isStock: false, reason: "secid-not-ticker-like-share", category: "unknown" };
  }

  if (!hasTradingData(fields)) {
    return { isStock: false, reason: "missing-price-or-trading-data", category: "unknown" };
  }

  const preferredByTicker = /(P|PR|RP|RX|DR|SP)$/i.test(fields.ticker) && fields.ticker.length > 1;
  if (preferredByTicker) {
    return { isStock: true, reason: "ticker-like-preferred-share", category: "preferred_stock" };
  }

  return { isStock: true, reason: "ticker-like-common-share", category: "stock" };
}

export function auditStockUniverse(rows: unknown[]): StockUniverseAudit {
  const byCategory = {
    stock: 0,
    preferred_stock: 0,
    fund: 0,
    etf: 0,
    bond: 0,
    currency: 0,
    futures: 0,
    index: 0,
    unknown: 0,
  } satisfies Record<StockUniverseCategory, number>;

  let tickerLikeSecids = 0;
  let ru000Secids = 0;
  let likelyFunds = 0;
  let likelyEtfs = 0;
  let likelyBonds = 0;
  let likelyStocks = 0;
  let likelyPreferredStocks = 0;
  let unknown = 0;
  let stockOnlyCount = 0;

  const excluded: Array<{ ticker: string; shortName: string; category: StockUniverseCategory; reason: string; score: number }> =
    [];

  for (const row of rows) {
    const fields = extractRowFields(row);
    const ticker = fields?.ticker ?? "?";
    const shortName = fields?.shortName ?? ticker;

    if (fields && isTickerLikeShareSecid(fields.ticker)) tickerLikeSecids++;
    if (fields && isRu000Secid(fields.ticker)) ru000Secids++;

    const decision = classifyStockUniverse(row);
    byCategory[decision.category]++;

    if (decision.isStock) {
      stockOnlyCount++;
      if (decision.category === "preferred_stock") likelyPreferredStocks++;
      else likelyStocks++;
    } else {
      if (decision.category === "fund") likelyFunds++;
      else if (decision.category === "etf") likelyEtfs++;
      else if (decision.category === "bond") likelyBonds++;
      else unknown++;

      const activity = (fields?.turnover ?? 0) + (fields?.tradesCount ?? 0) * 1000;
      excluded.push({ ticker, shortName, category: decision.category, reason: decision.reason, score: activity });
    }
  }

  excluded.sort((a, b) => b.score - a.score);

  return {
    total: rows.length,
    tickerLikeSecids,
    ru000Secids,
    likelyFunds,
    likelyEtfs,
    likelyBonds,
    likelyStocks,
    likelyPreferredStocks,
    unknown,
    stockOnlyCount,
    byCategory,
    topExcluded: excluded.slice(0, 30).map(({ score: _score, ...rest }) => rest),
  };
}

function toLegacyExclusionReason(decision: StockUniverseDecision): StockExclusionReason {
  switch (decision.reason) {
    case "asset-class-future":
      return "non-stock-asset-class";
    case "missing-secid":
      return "missing-ticker";
    case "missing-price-or-trading-data":
      return "missing-market-data";
    case "secid-isin-or-ru000-without-share-metadata":
      return "bond-like-secid";
    case "secid-ofz-like":
      return "ofz-like-secid";
    case "secid-not-ticker-like-share":
      return "invalid-ticker-shape";
    case "name-bond-like":
      return "excluded-name-bond";
    case "name-fund-like":
      return "excluded-name-fund";
    case "name-etf-like":
    case "moex-sectype-etf":
      return "excluded-etf";
    case "name-gdr-like":
    case "moex-sectype-gdr":
      return "excluded-gdr";
    case "moex-sectype-fund":
      return "excluded-name-fund";
    case "moex-sectype-bond-or-unit":
      return "excluded-name-bond";
    case "moex-sectype-common-share":
    case "moex-sectype-preferred-share":
      return "unknown-instrument";
    default:
      if (decision.category === "bond") return "bond-like-secid";
      if (decision.category === "fund") return "excluded-name-fund";
      if (decision.category === "etf") return "excluded-etf";
      return "unknown-instrument";
  }
}

export function classifyStockInstrument(row: ScreenerRow): { valid: boolean; reason?: StockExclusionReason } {
  const decision = classifyStockUniverse(row);
  if (decision.isStock) return { valid: true };
  return { valid: false, reason: toLegacyExclusionReason(decision) };
}

function rowActivityScore(row: ScreenerRow): number {
  return (row.turnover ?? 0) + (row.tradesCount ?? 0) * 1000;
}

/**
 * Stock-only rows for `/screener/stocks`.
 * @see docs/STOCK_UNIVERSE_FILTER.md
 */
export function selectStockOnlyUniverse(rows: ScreenerRow[]): ScreenerRow[] {
  return filterValidStockUniverse(rows).universe;
}

/** Single source of truth for `/screener/stocks` — filter applied once per API fetch. */
export type StockScreenerUniverse = {
  rawRows: ScreenerRow[];
  stockRows: ScreenerRow[];
  audit: UniverseFilterAudit;
  rawCount: number;
  stockCount: number;
  excludedCount: number;
};

export function buildStockScreenerUniverse(rawRows: ScreenerRow[]): StockScreenerUniverse {
  const { universe, audit } = filterValidStockUniverse(rawRows);
  return {
    rawRows,
    stockRows: universe,
    audit,
    rawCount: rawRows.length,
    stockCount: universe.length,
    excludedCount: Math.max(0, rawRows.length - universe.length),
  };
}

export function formatStockUniverseDebugLine(universe: Pick<StockScreenerUniverse, "rawCount" | "stockCount" | "excludedCount">): string {
  return `stock universe: raw ${universe.rawCount} → stocks ${universe.stockCount} → excluded ${universe.excludedCount}`;
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
  let excludedEtfs = 0;
  const excludedExamples: ExcludedInstrument[] = [];
  const byTicker = new Map<string, ScreenerRow>();

  for (const row of rows) {
    if (row.assetClass !== "stock") continue;
    afterAssetClass++;

    const decision = classifyStockUniverse(row);
    const ticker = row.ticker?.trim().toUpperCase() ?? "";

    if (!decision.isStock) {
      invalidRowsRemoved++;
      if (decision.category === "bond") excludedBondLike++;
      else if (decision.category === "fund") excludedFunds++;
      else if (decision.category === "etf") excludedEtfs++;
      pushExcluded(excludedExamples, ticker || row.ticker, decision);
      continue;
    }

    afterTypeFilter++;
    afterTickerShapeFilter++;
    afterBondFundExclusion++;

    const existing = byTicker.get(ticker);
    if (existing) {
      if (rowActivityScore(row) > rowActivityScore(existing)) {
        byTicker.set(ticker, { ...row, ticker: row.ticker.trim() });
      }
    } else {
      byTicker.set(ticker, { ...row, ticker: row.ticker.trim() });
    }
  }

  const universe = [...byTicker.values()];
  const duplicatesRemoved = Math.max(0, afterBondFundExclusion - universe.length);

  return {
    universe,
    audit: {
      rawRows,
      afterAssetClass,
      afterTypeFilter,
      afterTickerShapeFilter,
      afterBondFundExclusion: universe.length,
      duplicatesRemoved,
      invalidRowsRemoved,
      excludedBondLike,
      excludedFunds,
      excludedEtfs,
      excludedExamples,
    },
  };
}

function pushExcluded(list: ExcludedInstrument[], ticker: string, decision: StockUniverseDecision) {
  if (list.length >= 30) return;
  list.push({
    ticker,
    reason: decision.reason,
    category: decision.category,
  });
}
