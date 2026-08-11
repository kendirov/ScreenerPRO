import type {
  BitgetCategory,
  BitgetMarketGroup,
  BitgetScreenerResponse,
  BitgetScreenerRow,
} from "@/lib/bitget/types";

const BITGET_API = "https://api.bitget.com";

const INSTRUMENT_CATEGORIES: BitgetCategory[] = [
  "SPOT",
  "MARGIN",
  "USDT-FUTURES",
  "USDC-FUTURES",
  "COIN-FUTURES",
];

const TICKER_CATEGORIES: Exclude<BitgetCategory, "MARGIN">[] = [
  "SPOT",
  "USDT-FUTURES",
  "USDC-FUTURES",
  "COIN-FUTURES",
];

type JsonRecord = Record<string, unknown>;

type BitgetEnvelope = {
  code?: string;
  msg?: string;
  data?: unknown;
};

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratioToPct(value: unknown): number | null {
  const parsed = numberOrNull(value);
  return parsed == null ? null : parsed * 100;
}

async function bitgetGet(path: string): Promise<BitgetEnvelope> {
  const response = await fetch(`${BITGET_API}${path}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Bitget HTTP ${response.status} for ${path}`);
  }

  const json = (await response.json()) as BitgetEnvelope;
  if (json.code !== "00000") {
    throw new Error(`Bitget ${json.code ?? "unknown"}: ${json.msg ?? "request failed"}`);
  }
  return json;
}

function listData(envelope: BitgetEnvelope): JsonRecord[] {
  return Array.isArray(envelope.data)
    ? envelope.data.filter((row): row is JsonRecord => Boolean(row) && typeof row === "object")
    : [];
}

function classify(instrument: JsonRecord, category: BitgetCategory): BitgetMarketGroup {
  const symbolType = text(instrument.symbolType).toLowerCase();
  const isReality = text(instrument.isReality).toLowerCase() === "yes";

  if (category === "MARGIN") return "MARGIN";
  if (category === "SPOT") return isReality ? "RTOKEN_SPOT" : "CRYPTO_SPOT";
  if (symbolType === "stock") return "STOCK_PERPS";
  if (symbolType === "metal" || symbolType === "commodity") return "COMMODITY_PERPS";
  return "CRYPTO_FUTURES";
}

function percentileRanks(rows: BitgetScreenerRow[]): Map<string, number> {
  const ranked = rows
    .filter((row) => (row.turnover24h ?? 0) > 0)
    .slice()
    .sort((a, b) => (a.turnover24h ?? 0) - (b.turnover24h ?? 0));
  const result = new Map<string, number>();
  if (ranked.length <= 1) {
    ranked.forEach((row) => result.set(row.id, ranked.length === 1 ? 1 : 0));
    return result;
  }
  ranked.forEach((row, index) => result.set(row.id, index / (ranked.length - 1)));
  return result;
}

function scoreRows(rows: BitgetScreenerRow[]): BitgetScreenerRow[] {
  const turnoverRanks = percentileRanks(rows);

  return rows.map((row) => {
    const reasons: string[] = [];
    const move = Math.abs(row.change24hPct ?? 0);
    const range = row.range24hPct ?? 0;
    const turnoverRank = turnoverRanks.get(row.id) ?? 0;
    const spread = row.spreadBps;
    const funding = Math.abs(row.fundingRatePct ?? 0);

    let score = 0;
    score += Math.min(32, move * 3.2);
    score += Math.min(23, range * 2.3);
    score += turnoverRank * 30;
    if (spread != null) score += spread <= 5 ? 10 : spread <= 15 ? 6 : spread <= 40 ? 2 : 0;
    if (funding >= 0.03) score += Math.min(5, funding * 25);

    if (move >= 8) reasons.push(`ход ${move.toFixed(1)}%`);
    else if (move >= 4) reasons.push(`движение ${move.toFixed(1)}%`);
    if (range >= 8) reasons.push(`диапазон ${range.toFixed(1)}%`);
    else if (range >= 4) reasons.push(`широкий диапазон`);
    if (turnoverRank >= 0.95) reasons.push("топ оборота");
    else if (turnoverRank >= 0.8) reasons.push("высокий оборот");
    if (spread != null && spread <= 5) reasons.push("узкий спред");
    if (funding >= 0.05) reasons.push(`funding ${funding.toFixed(3)}%`);

    const attentionScore = Math.round(Math.min(100, score));
    const inPlay = attentionScore >= 58 && (turnoverRank >= 0.45 || move >= 5 || range >= 6);

    return {
      ...row,
      attentionScore,
      attentionReasons: reasons.slice(0, 3),
      inPlay,
    };
  });
}

function buildRow(
  instrument: JsonRecord,
  ticker: JsonRecord | undefined,
  category: BitgetCategory,
): BitgetScreenerRow {
  const lastPrice = numberOrNull(ticker?.lastPrice);
  const high24h = numberOrNull(ticker?.highPrice24h);
  const low24h = numberOrNull(ticker?.lowPrice24h);
  const bid = numberOrNull(ticker?.bid1Price);
  const ask = numberOrNull(ticker?.ask1Price);
  const mid = bid != null && ask != null && bid > 0 && ask >= bid ? (bid + ask) / 2 : null;
  const spreadBps = mid != null ? ((ask! - bid!) / mid) * 10_000 : null;
  const range24hPct = lastPrice != null && lastPrice > 0 && high24h != null && low24h != null
    ? ((high24h - low24h) / lastPrice) * 100
    : null;
  const rangePositionPct = high24h != null && low24h != null && lastPrice != null && high24h > low24h
    ? ((lastPrice - low24h) / (high24h - low24h)) * 100
    : null;

  const symbol = text(instrument.symbol);
  const baseCoin = text(instrument.baseCoin);
  const quoteCoin = text(instrument.quoteCoin);

  return {
    id: `${category}:${symbol}`,
    category,
    marketGroup: classify(instrument, category),
    symbol,
    baseCoin,
    quoteCoin,
    symbolType: text(instrument.symbolType) || "unknown",
    status: text(instrument.status) || "unknown",
    isReality: text(instrument.isReality).toLowerCase() === "yes",
    contractType: text(instrument.type) || null,
    lastPrice,
    change24hPct: ratioToPct(ticker?.price24hPcnt),
    high24h,
    low24h,
    range24hPct,
    rangePositionPct,
    turnover24h: numberOrNull(ticker?.turnover24h),
    platformTurnover24h: numberOrNull(ticker?.platformTurnover24h),
    volume24h: numberOrNull(ticker?.volume24h),
    bid,
    ask,
    spreadBps,
    fundingRatePct: ratioToPct(ticker?.fundingRate),
    openInterest: numberOrNull(ticker?.openInterest),
    markPrice: numberOrNull(ticker?.markPrice),
    indexPrice: numberOrNull(ticker?.indexPrice),
    maxLeverage: numberOrNull(instrument.maxLeverage),
    minOrderAmount: numberOrNull(instrument.minOrderAmount),
    launchTime: numberOrNull(instrument.launchTime),
    updatedAt: numberOrNull(ticker?.ts),
    attentionScore: 0,
    attentionReasons: [],
    inPlay: false,
  };
}

export async function getBitgetGlobalScreener(): Promise<BitgetScreenerResponse> {
  const started = Date.now();
  const warnings: string[] = [];
  const instruments = new Map<BitgetCategory, JsonRecord[]>();
  const tickers = new Map<BitgetCategory, JsonRecord[]>();
  const loaded = new Set<BitgetCategory>();

  await Promise.all(
    INSTRUMENT_CATEGORIES.map(async (category) => {
      try {
        const response = await bitgetGet(`/api/v3/market/instruments?category=${encodeURIComponent(category)}`);
        instruments.set(category, listData(response));
        loaded.add(category);
      } catch (error) {
        warnings.push(`${category} instruments: ${error instanceof Error ? error.message : "ошибка"}`);
        instruments.set(category, []);
      }
    }),
  );

  await Promise.all(
    TICKER_CATEGORIES.map(async (category) => {
      try {
        const response = await bitgetGet(`/api/v3/market/tickers?category=${encodeURIComponent(category)}`);
        tickers.set(category, listData(response));
      } catch (error) {
        warnings.push(`${category} tickers: ${error instanceof Error ? error.message : "ошибка"}`);
        tickers.set(category, []);
      }
    }),
  );

  const spotTickerMap = new Map(
    (tickers.get("SPOT") ?? []).map((ticker) => [text(ticker.symbol), ticker] as const),
  );

  const rows: BitgetScreenerRow[] = [];
  for (const category of INSTRUMENT_CATEGORIES) {
    const ownTickers = new Map(
      (tickers.get(category) ?? []).map((ticker) => [text(ticker.symbol), ticker] as const),
    );
    for (const instrument of instruments.get(category) ?? []) {
      const symbol = text(instrument.symbol);
      const ticker = category === "MARGIN" ? spotTickerMap.get(symbol) : ownTickers.get(symbol);
      rows.push(buildRow(instrument, ticker, category));
    }
  }

  const scoredRows = scoreRows(rows).sort((a, b) => b.attentionScore - a.attentionScore);
  const online = scoredRows.filter((row) => row.status.toLowerCase() === "online");

  return {
    rows: scoredRows,
    summary: {
      total: scoredRows.length,
      online: online.length,
      inPlay: scoredRows.filter((row) => row.inPlay).length,
      spot: scoredRows.filter((row) => row.marketGroup === "CRYPTO_SPOT").length,
      futures: scoredRows.filter((row) => row.marketGroup === "CRYPTO_FUTURES").length,
      margin: scoredRows.filter((row) => row.marketGroup === "MARGIN").length,
      reality: scoredRows.filter((row) => row.marketGroup === "RTOKEN_SPOT").length,
      stockPerps: scoredRows.filter((row) => row.marketGroup === "STOCK_PERPS").length,
      commodityPerps: scoredRows.filter((row) => row.marketGroup === "COMMODITY_PERPS").length,
      gainers: scoredRows.filter((row) => (row.change24hPct ?? 0) > 0).length,
      losers: scoredRows.filter((row) => (row.change24hPct ?? 0) < 0).length,
    },
    status: {
      source: warnings.length === 0 ? "bitget-v3" : "partial",
      asOf: new Date().toISOString(),
      latencyMs: Date.now() - started,
      warnings,
      categoriesLoaded: INSTRUMENT_CATEGORIES.filter((category) => loaded.has(category)),
    },
  };
}
