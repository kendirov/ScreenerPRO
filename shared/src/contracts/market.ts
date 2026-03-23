import { z } from "zod";

export const assetClassSchema = z.enum(["stock", "future"]);
export type AssetClass = z.infer<typeof assetClassSchema>;

export const tradingStatusSchema = z.enum(["open", "halted", "auction", "closed", "unknown"]);
export type TradingStatus = z.infer<typeof tradingStatusSchema>;

export const screenerMetricSetSchema = z.object({
  turnoverRatio: z.number().nullable(),
  volumeRatio: z.number().nullable(),
  intradayRangePct: z.number().nullable(),
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
});
export type ScreenerFilterState = z.infer<typeof screenerFilterStateSchema>;
