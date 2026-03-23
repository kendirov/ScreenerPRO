import { z } from "zod";

export const assetClassSchema = z.enum(["stock", "future"]);
export type AssetClass = z.infer<typeof assetClassSchema>;

export const tradingStatusSchema = z.enum(["open", "halted", "auction", "closed", "unknown"]);
export type TradingStatus = z.infer<typeof tradingStatusSchema>;
export const liquidityClassSchema = z.enum(["liquid", "illiquid", "unknown"]);
export type LiquidityClass = z.infer<typeof liquidityClassSchema>;

export const screenerMetricSetSchema = z.object({
  turnoverRatio: z.number().nullable(),
  volumeRatio: z.number().nullable(),
  dayRangePct: z.number().nullable(),
  gapPct: z.number().nullable(),
  relativeVolatility20d: z.number().nullable(),
  inPlayScore: z.number().nullable(),
  isInPlay: z.boolean(),
});
export type ScreenerMetricSet = z.infer<typeof screenerMetricSetSchema>;

export const marketSnapshotSchema = z.object({
  ticker: z.string(),
  shortName: z.string(),
  assetClass: assetClassSchema,
  lastPrice: z.number().nullable(),
  previousClose: z.number().nullable(),
  absoluteChange: z.number().nullable(),
  percentChange: z.number().nullable(),
  volume: z.number().nullable(),
  turnover: z.number().nullable(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  tradesCount: z.number().nullable().optional(),
  openInterest: z.number().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  liquidityClass: liquidityClassSchema,
  tradingStatus: tradingStatusSchema,
  lotSize: z.number().nullable(),
  updatedAt: z.string(),
  sourceUpdatedAt: z.string().nullable(),
});
export type MarketSnapshot = z.infer<typeof marketSnapshotSchema>;

export const screenerRowSchema = marketSnapshotSchema.extend({
  metrics: screenerMetricSetSchema,
});
export type ScreenerRow = z.infer<typeof screenerRowSchema>;

export const instrumentHistoryBarSchema = z.object({
  date: z.string(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  close: z.number().nullable(),
  volume: z.number().nullable(),
  turnover: z.number().nullable(),
});
export type InstrumentHistoryBar = z.infer<typeof instrumentHistoryBarSchema>;

export const instrumentDetailSchema = z.object({
  ticker: z.string(),
  shortName: z.string(),
  assetClass: assetClassSchema,
  board: z.string().nullable(),
  engine: z.string().nullable(),
  market: z.string().nullable(),
  lotSize: z.number().nullable(),
  tradingStatus: tradingStatusSchema,
  snapshot: marketSnapshotSchema.nullable(),
  metrics: screenerMetricSetSchema.nullable(),
});
export type InstrumentDetail = z.infer<typeof instrumentDetailSchema>;

export const screenerFilterStateSchema = z.object({
  assetClass: z.enum(["all", "stock", "future"]).default("all"),
  onlyInPlay: z.boolean().default(false),
  stockLiquidity: z.enum(["liquid", "all"]).default("liquid"),
});
export type ScreenerFilterState = z.infer<typeof screenerFilterStateSchema>;

export const screenerDataSourceSchema = z.enum(["moex", "demo"]);
export type ScreenerDataSource = z.infer<typeof screenerDataSourceSchema>;

export const screenerFallbackReasonSchema = z.enum(["moex-unavailable", "validation-failed", "no-usable-rows"]);
export type ScreenerFallbackReason = z.infer<typeof screenerFallbackReasonSchema>;

export const screenerDataStatusSchema = z.object({
  source: screenerDataSourceSchema,
  fetchTimestamp: z.string(),
  sourceTimestamp: z.string().nullable(),
  stockRows: z.number().int().nonnegative(),
  futuresRows: z.number().int().nonnegative(),
  fallbackReason: screenerFallbackReasonSchema.nullable(),
  message: z.string().nullable(),
});
export type ScreenerDataStatus = z.infer<typeof screenerDataStatusSchema>;

export const screenerBenchmarkSchema = z.object({
  code: z.string(),
  name: z.string(),
  market: z.enum(["stock"]),
  lastValue: z.number().nullable(),
  percentChange: z.number().nullable(),
  dayRangePct: z.number().nullable(),
  updatedAt: z.string(),
  sourceUpdatedAt: z.string().nullable(),
});
export type ScreenerBenchmark = z.infer<typeof screenerBenchmarkSchema>;

export const screenerApiResponseSchema = z.object({
  assetClass: z.enum(["stock", "future", "all"]),
  rows: z.array(screenerRowSchema),
  benchmarks: z.array(screenerBenchmarkSchema),
  status: screenerDataStatusSchema,
});
export type ScreenerApiResponse = z.infer<typeof screenerApiResponseSchema>;

export const screenerDiagnosticsResponseSchema = z.object({
  status: screenerDataStatusSchema,
  totalRows: z.number().int().nonnegative(),
  byAssetClass: z.object({
    stock: z.number().int().nonnegative(),
    future: z.number().int().nonnegative(),
  }),
});
export type ScreenerDiagnosticsResponse = z.infer<typeof screenerDiagnosticsResponseSchema>;
