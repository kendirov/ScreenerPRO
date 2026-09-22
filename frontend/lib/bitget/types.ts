export type BitgetCategory =
  | "SPOT"
  | "MARGIN"
  | "USDT-FUTURES"
  | "USDC-FUTURES"
  | "COIN-FUTURES";

export type BitgetMarketGroup =
  | "CRYPTO_SPOT"
  | "CRYPTO_FUTURES"
  | "MARGIN"
  | "RTOKEN_SPOT"
  | "STOCK_PERPS"
  | "COMMODITY_PERPS";

export type BitgetQuickFilter =
  | "all"
  | "inPlay"
  | "gainers"
  | "losers"
  | "wideRange"
  | "funding";

export type BitgetScreenerRow = {
  id: string;
  category: BitgetCategory;
  marketGroup: BitgetMarketGroup;
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  symbolType: string;
  status: string;
  isReality: boolean;
  contractType: string | null;
  lastPrice: number | null;
  change24hPct: number | null;
  high24h: number | null;
  low24h: number | null;
  range24hPct: number | null;
  rangePositionPct: number | null;
  turnover24h: number | null;
  platformTurnover24h: number | null;
  volume24h: number | null;
  bid: number | null;
  ask: number | null;
  spreadBps: number | null;
  fundingRatePct: number | null;
  openInterest: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  maxLeverage: number | null;
  minOrderAmount: number | null;
  launchTime: number | null;
  updatedAt: number | null;
  attentionScore: number;
  attentionReasons: string[];
  inPlay: boolean;
};

export type BitgetScreenerSummary = {
  total: number;
  online: number;
  inPlay: number;
  spot: number;
  futures: number;
  margin: number;
  reality: number;
  stockPerps: number;
  commodityPerps: number;
  gainers: number;
  losers: number;
};

export type BitgetScreenerResponse = {
  rows: BitgetScreenerRow[];
  summary: BitgetScreenerSummary;
  status: {
    source: "bitget-v3" | "partial";
    asOf: string;
    latencyMs: number;
    warnings: string[];
    categoriesLoaded: BitgetCategory[];
  };
};
