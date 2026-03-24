import { z } from "zod";

export const availabilityStatusSchema = z.enum(["available", "derived", "unavailable"]);
export type AvailabilityStatus = z.infer<typeof availabilityStatusSchema>;

export const valueWithStatusSchema = z.object({
  value: z.number().nullable(),
  status: availabilityStatusSchema,
  note: z.string().nullable().optional(),
});
export type ValueWithStatus = z.infer<typeof valueWithStatusSchema>;

export const materialsAssetClassFilterSchema = z.enum(["all", "stock", "future"]);
export type MaterialsAssetClassFilter = z.infer<typeof materialsAssetClassFilterSchema>;

export const technicalCharacteristicsRowSchema = z.object({
  ticker: z.string(),
  instrumentName: z.string(),
  assetClass: z.enum(["stock", "future"]),
  board: z.string().nullable(),
  market: z.string().nullable(),
  lotSize: valueWithStatusSchema,
  priceStep: valueWithStatusSchema,
  stepValue: valueWithStatusSchema,
  currentPrice: valueWithStatusSchema,
  lotPrice: valueWithStatusSchema,
  spreadPct: valueWithStatusSchema,
  spreadRub: valueWithStatusSchema,
  spreadTicks: valueWithStatusSchema,
  tradesCount: valueWithStatusSchema,
  turnoverRub: valueWithStatusSchema,
  turnoverPerTradeRub: valueWithStatusSchema,
  largeLotRub: valueWithStatusSchema,
  commissionRub: valueWithStatusSchema,
  pointsToCoverCommission: valueWithStatusSchema,
  rublesToCoverCommission: valueWithStatusSchema,
  slippageSensitivity: valueWithStatusSchema,
  commissionToRangeScore: valueWithStatusSchema,
  intradayUsabilityScore: valueWithStatusSchema,
  underlying: z.string().nullable(),
  expiryDate: z.string().nullable(),
  daysToExpiry: valueWithStatusSchema,
  contractSize: valueWithStatusSchema,
  marginFootprintRub: valueWithStatusSchema,
  liquidityQuality: z.enum(["high", "medium", "low", "unknown"]),
  scalabilityHint: z.string(),
  availabilityConfidence: z.number().min(0).max(100),
  sourceMeta: z.object({
    source: z.literal("moex"),
    sourceUpdatedAt: z.string().nullable(),
  }),
});
export type TechnicalCharacteristicsRow = z.infer<typeof technicalCharacteristicsRowSchema>;

export const technicalCharacteristicsStatusSchema = z.object({
  source: z.enum(["moex", "demo"]),
  fetchTimestamp: z.string(),
  sourceTimestamp: z.string().nullable(),
  rows: z.number().int().nonnegative(),
  message: z.string().nullable(),
});
export type TechnicalCharacteristicsStatus = z.infer<typeof technicalCharacteristicsStatusSchema>;

export const technicalCharacteristicsResponseSchema = z.object({
  rows: z.array(technicalCharacteristicsRowSchema),
  status: technicalCharacteristicsStatusSchema,
});
export type TechnicalCharacteristicsResponse = z.infer<typeof technicalCharacteristicsResponseSchema>;

export type MaterialsPage = {
  slug: string;
  title: string;
  description: string;
  href: string;
  status: "live" | "planned";
};
