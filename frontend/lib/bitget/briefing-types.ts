import type { BitgetScreenerRow } from "@/lib/bitget/types";

export type BriefingSituation =
  | "PUMP"
  | "DUMP"
  | "VOLUME_EXPLOSION"
  | "VOL_EXPANSION"
  | "WAKE_UP"
  | "QUIET"
  | "WATCH_ONLY";

export type BriefingDisposition = "IN_PLAY" | "WATCH_ONLY" | "QUIET";

export type BriefingQuality = "LIVE_PARTIAL" | "BASELINE_MISSING" | "STALE" | "ERROR";

export type BriefingRow = {
  row: BitgetScreenerRow;
  attention: number;
  executionQuality: number;
  situationQuality: number;
  situation: BriefingSituation;
  disposition: BriefingDisposition;
  reasons: string[];
  quality: BriefingQuality;
  baseline: "MISSING" | "READY";
};

export type BitgetBriefingResponse = {
  generatedAt: string;
  marketMode: "BITGET_EXECUTION";
  rows: BriefingRow[];
  topInPlay: BriefingRow[];
  watchOnly: BriefingRow[];
  status: {
    source: "bitget-v3" | "partial";
    asOf: string;
    latencyMs: number;
    quality: BriefingQuality;
    baseline: "MISSING" | "READY";
    warnings: string[];
  };
};
