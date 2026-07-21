import { z } from "zod";

export const aiDataOptionsSchema = z.object({
  mode: z.enum(["market", "pumps", "weakness", "technical", "briefing", "close"]).default("market"),
  universe: z.enum(["all", "liquid", "in-play", "money", "shots", "selected"]).default("all"),
  depth: z.enum(["compact", "detailed", "maximum"]).default("compact"),
  history: z.enum(["current", "previous", "five", "profile20"]).default("current"),
  shortlist: z.union([z.literal(0), z.literal(10), z.literal(20), z.literal(30)]).default(10),
  format: z.enum(["ai-text", "jsonl", "json", "csv"]).default("ai-text"),
  tickers: z.array(z.string().regex(/^[A-Z0-9._-]{1,16}$/)).max(30).default([]),
});

export type AiDataOptions = z.infer<typeof aiDataOptionsSchema>;

export type AiDataStock = {
  ticker: string; shortName: string; lastPrice: number | null; percentChangeDay: number | null;
  dayRangePct: number | null; rangePosition: number | null; distanceFromHighPct: number | null;
  distanceFromLowPct: number | null; currentTurnoverRub: number | null; volumeRatioNow: number | null;
  tradesRatioNow: number | null; liquidityClass: "liquid" | "standard" | "thin" | "unknown";
  spreadPct: number | null; marketPriorityBucket: "focus" | "in-play" | "active" | "risk" | "other";
  inPlay: boolean; focus: boolean; active: boolean; risk: boolean; situation: string | null;
  baselineKind: string | null; baselineReliable: boolean | null; dataQuality: "full" | "partial" | "live-only";
  stale: boolean; missingIntervals: number | null;
  return5m: number | null; return15m: number | null; return30m: number | null; return60m: number | null;
  turnover5mRub: number | null; turnover15mRub: number | null; turnover60mRub: number | null;
  trades5m: number | null; trades15m: number | null; trades60m: number | null;
  turnoverAcceleration: number | null; priceAcceleration: number | null;
  relativeStrengthVsIMOEX5m: number | null; relativeStrengthVsIMOEX30m: number | null; relativeStrengthVsIMOEX60m: number | null;
  trendEfficiency: number | null; chopScore: number | null; max5mMove: number | null; pullbackFromImpulse: number | null;
  openingRangeState: string | null; technicalityScore: number | null;
};

export type AiDataExport = {
  generatedAt: string; source: string; stale: boolean; options: AiDataOptions; market: Record<string, unknown>;
  stocks: AiDataStock[]; shortlist: Array<{ ticker: string; reason: string; score: number }>;
  quality: { covered: number; partial: number; missingHistory: number; notes: string[] }; formats: Record<"aiText" | "jsonl" | "json" | "csv", string>;
};
