import { z } from "zod";

export const assetClassSchema = z.enum(["stock", "future"]);
export type AssetClass = z.infer<typeof assetClassSchema>;

export const tradingStatusSchema = z.enum(["open", "halted", "auction", "closed", "unknown"]);
export type TradingStatus = z.infer<typeof tradingStatusSchema>;
export const stockActivityClassSchema = z.enum(["active", "has_activity", "inactive", "unknown"]);
export type StockActivityClass = z.infer<typeof stockActivityClassSchema>;

export const screenerMetricSetSchema = z.object({
  turnoverRatio: z.number().nullable(),
  volumeRatio: z.number().nullable(),
  turnoverVsAverage: z.number().nullable(),
  rangeVsAverage: z.number().nullable(),
  tradesVsAverage: z.number().nullable(),
  turnoverPercentile: z.number().nullable(),
  tradesPercentile: z.number().nullable(),
  rangePercentile: z.number().nullable(),
  dayRangePct: z.number().nullable(),
  gapPct: z.number().nullable(),
  relativeVolatility20d: z.number().nullable(),
  inPlayScore: z.number().nullable(),
  isInPlay: z.boolean(),
  inPlayTags: z.array(z.string()),
  reasonLabel: z.string().nullable(),
  currentTurnoverRub: z.number().nullable(),
  previousDayTurnoverRub: z.number().nullable(),
  activityRatio: z.number().nullable(),
  requiredActivityRatio: z.number().nullable(),
  sessionProgress: z.number().nullable(),
  /** Оборот vs норма на текущий момент сессии (intraday baseline). */
  volumeRatioNow: z.number().nullable().optional(),
  /** Сделки vs норма на текущий момент сессии. */
  tradesRatioNow: z.number().nullable().optional(),
  intradayBaselineStatus: z.enum(["ok", "no-history", "partial", "rough"]).nullable().optional(),
  intradayBaselineKind: z
    .enum(["intraday-ok", "intraday-partial", "rough-day-avg", "previous-day", "none"])
    .nullable()
    .optional(),
  /** same-time = intraday к времени; full-day = rough/вчера × progress. */
  baselineMode: z.enum(["same-time", "full-day", "missing"]).nullable().optional(),
  baselineSource: z.enum(["yesterday", "5d-average", "20d-average", "unknown"]).nullable().optional(),
  baselineTimeMsk: z.string().nullable().optional(),
  baselineIsReliable: z.boolean().optional(),
  avgTurnoverAtTimeRub: z.number().nullable().optional(),
  avgTradesAtTimeRub: z.number().nullable().optional(),
  baselineSessionsCount: z.number().nullable().optional(),
  baselineWarning: z.string().nullable().optional(),
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
  stockActivityClass: stockActivityClassSchema,
  tradingStatus: tradingStatusSchema,
  lotSize: z.number().nullable(),
  /** MOEX ISS SECTYPE on shares board (1=common, 2=preferred, J=ETF, …). Optional enrich. */
  moexSecType: z.string().nullable().optional(),
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
  stockActivity: z.enum(["active", "has_activity", "all"]).default("active"),
});
export type ScreenerFilterState = z.infer<typeof screenerFilterStateSchema>;

export const screenerDataSourceSchema = z.enum(["moex", "demo", "fallback", "off"]);
export type ScreenerDataSource = z.infer<typeof screenerDataSourceSchema>;

export const screenerFallbackReasonSchema = z.enum([
  "moex-unavailable",
  "validation-failed",
  "no-usable-rows",
  "explicit-dev-fallback",
  "data-disabled",
]);
export type ScreenerFallbackReason = z.infer<typeof screenerFallbackReasonSchema>;

export const baselineStatusSchema = z.enum(["ok", "skipped", "error"]);
export type BaselineStatus = z.infer<typeof baselineStatusSchema>;

export const screenerDataModeSchema = z.enum(["live", "historical"]);
export type ScreenerDataMode = z.infer<typeof screenerDataModeSchema>;

export const screenerDataStatusSchema = z.object({
  source: screenerDataSourceSchema,
  isDemo: z.boolean(),
  degraded: z.boolean(),
  baselineStatus: baselineStatusSchema,
  generatedAt: z.string(),
  fetchTimestamp: z.string(),
  sourceTimestamp: z.string().nullable(),
  stockRows: z.number().int().nonnegative(),
  futuresRows: z.number().int().nonnegative(),
  fallbackReason: screenerFallbackReasonSchema.nullable(),
  message: z.string().nullable(),
  /** Запрошенная торговая дата (YYYY-MM-DD). */
  tradingDateKey: z.string().nullable().optional(),
  /** Фактическая дата данных (если найден ближайший торговый день). */
  resolvedTradingDateKey: z.string().nullable().optional(),
  dataMode: screenerDataModeSchema.optional(),
  historicalEmpty: z.boolean().optional(),
  /** Агрегированный статус торгов по выборке (live snapshot). */
  marketStatus: tradingStatusSchema.nullable().optional(),
  /** Причина пустого ответа / degraded режима для UI. */
  emptyReason: z.string().nullable().optional(),
  /** Использован кэш предыдущего успешного MOEX-ответа. */
  staleCache: z.boolean().optional(),
});
export type ScreenerDataStatus = z.infer<typeof screenerDataStatusSchema>;

export const screenerDiagnosticsSchema = z.object({
  source: screenerDataSourceSchema,
  assetClass: z.enum(["stock", "future", "all"]),
  rowsBeforeFilter: z.number().int().nonnegative(),
  rowsAfterFilter: z.number().int().nonnegative(),
  fallbackReason: screenerFallbackReasonSchema.nullable(),
  fetchTime: z.string(),
  marketStatus: tradingStatusSchema.nullable(),
  lastUpdated: z.string(),
  /** Расширенная диагностика пайплайна (не показывать сырой JSON в UI). */
  requestedAt: z.string().optional(),
  fetchMs: z.number().nonnegative().optional(),
  moexOk: z.boolean().optional(),
  fallbackUsed: z.boolean().optional(),
  rowsRaw: z.number().int().nonnegative().optional(),
  rowsNormalized: z.number().int().nonnegative().optional(),
  endpointUsed: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});
export type ScreenerDiagnostics = z.infer<typeof screenerDiagnosticsSchema>;

export const screenerBenchmarkSchema = z.object({
  code: z.string(),
  name: z.string(),
  market: z.enum(["stock"]),
  lastValue: z.number().nullable(),
  percentChange: z.number().nullable(),
  dayRangePct: z.number().nullable(),
  aggregateTurnover: z.number().nullable(),
  aggregateTrades: z.number().nullable(),
  updatedAt: z.string(),
  sourceUpdatedAt: z.string().nullable(),
  open: z.number().nullable().optional(),
  high: z.number().nullable().optional(),
  low: z.number().nullable().optional(),
  previousClose: z.number().nullable().optional(),
  absoluteChange: z.number().nullable().optional(),
});
export type ScreenerBenchmark = z.infer<typeof screenerBenchmarkSchema>;

export const screenerApiResponseSchema = z.object({
  assetClass: z.enum(["stock", "future", "all"]),
  rows: z.array(screenerRowSchema),
  benchmarks: z.array(screenerBenchmarkSchema),
  status: screenerDataStatusSchema,
  diagnostics: screenerDiagnosticsSchema.optional(),
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

export const screenerHealthResponseSchema = z.object({
  environment: z.enum(["development", "production"]),
  vercel: z.boolean(),
  moexFetchStatus: z.enum(["ok", "error"]),
  prismaStatus: baselineStatusSchema,
  demoFallbackAllowed: z.boolean(),
  moexDataMode: z.enum(["live", "fallback", "off", "demo"]).optional(),
  commitSha: z.string().nullable(),
  commitMessage: z.string().nullable(),
  branch: z.string().nullable(),
  deploymentUrl: z.string().nullable(),
  generatedAt: z.string(),
  /** Short SHA for quick glance; same commit as commitSha when on Vercel. */
  buildCommit: z.string().nullable(),
  /** @deprecated use generatedAt */
  timestamp: z.string(),
});
export type ScreenerHealthResponse = z.infer<typeof screenerHealthResponseSchema>;
