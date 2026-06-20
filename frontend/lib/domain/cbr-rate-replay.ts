/**
 * CBR rate replay — упрощённый слой для исторической страницы.
 */

import { CBR_SELECTOR_YEARS } from "@/lib/cbr/cbr-rate-event-selector";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import type { CbrReactionChartGridModel } from "@/lib/domain/cbr-rate-chart-model";
import type { CbrRateEvent, CbrTone } from "@/lib/domain/cbr-rate-events";
import { calculateSurpriseBps } from "@/lib/domain/cbr-rate-events";
import type { CbrInstrumentReactionMetrics } from "@/lib/domain/cbr-rate-reaction-metrics";
import { CBR_COMPACT_PATTERN_INCOMPLETE, CBR_COMPACT_PATTERN_NO_DATA } from "@/lib/domain/cbr-rate-reaction-metrics";
import {
  matrixPatternLabel,
} from "@/lib/cbr/cbr-replay-market-output";

export const CBR_REPLAY_YEARS = CBR_SELECTOR_YEARS;

export type CbrReplayYear = (typeof CBR_REPLAY_YEARS)[number];

export const CBR_EQUITIES_MATRIX_ROWS: Array<{
  slotId: string;
  label: string;
  tickerMatch: string;
}> = [
  { slotId: "equity-index", label: "IMOEX", tickerMatch: "IMOEX" },
  { slotId: "sber", label: "SBER", tickerMatch: "SBER" },
  { slotId: "gazp", label: "GAZP", tickerMatch: "GAZP" },
  { slotId: "lkoh", label: "LKOH", tickerMatch: "LKOH" },
  { slotId: "vtbr", label: "VTBR", tickerMatch: "VTBR" },
  { slotId: "bonds", label: "RGBI", tickerMatch: "RGBI" },
];

export const CBR_CURRENCY_MATRIX_ROWS: Array<{
  slotId: string;
  label: string;
  tickerMatch: string;
}> = [
  { slotId: "usd-rub", label: "USD/RUB", tickerMatch: "USDRUBF" },
  { slotId: "cny-rub", label: "CNY/RUB", tickerMatch: "CNYRUBF" },
];

export const CBR_DERIVATIVES_MATRIX_ROWS: Array<{
  slotId: string;
  label: string;
  tickerMatch: string;
}> = [
  { slotId: "mx-futures", label: "MX", tickerMatch: "MX" },
  { slotId: "usd-rub", label: "Si", tickerMatch: "Si" },
  { slotId: "cny-rub", label: "CNY", tickerMatch: "CNY" },
];

/** @deprecated use CBR_EQUITIES_MATRIX_ROWS / CBR_DERIVATIVES_MATRIX_ROWS */
export const CBR_COMPACT_MATRIX_ROWS = CBR_EQUITIES_MATRIX_ROWS;

/** @deprecated use CBR_COMPACT_MATRIX_ROWS */
export const CBR_REPLAY_MATRIX_SLOTS = CBR_COMPACT_MATRIX_ROWS;

export const TONE_CARD_LABELS: Record<CbrTone, string> = {
  dovish: "мягко",
  neutral: "нейтрально",
  hawkish: "жёстко",
};

export function groupCbrRateEventsByYear<T extends { date: string }>(
  events: T[],
): Record<number, T[]> {
  const map: Record<number, T[]> = {};
  for (const y of CBR_REPLAY_YEARS) map[y] = [];
  for (const e of events) {
    const y = Number(e.date.slice(0, 4));
    if (!map[y]) map[y] = [];
    map[y].push(e);
  }
  for (const y of Object.keys(map)) {
    map[Number(y)]!.sort((a, b) => b.date.localeCompare(a.date));
  }
  return map;
}

export function formatRateChangeBps(previous: number, actual: number | null): string {
  if (actual == null) return "—";
  const bps = Math.round((actual - previous) * 100);
  const sign = bps > 0 ? "+" : "";
  return `${sign}${bps} bps`;
}

export function formatToneCard(tone: CbrTone | null | "unknown"): string {
  if (!tone || tone === "unknown") return "—";
  return TONE_CARD_LABELS[tone];
}

export function formatMeetingCardDate(dateIso: string): string {
  return new Date(`${dateIso}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export type CbrReplayDataBadge = {
  label: "MOEX" | "INCOMPLETE" | "NO DATA" | "ERROR";
  kind: "live" | "partial" | "none" | "error";
};

export function resolveReplayDataBadge(
  chartModel: CbrReactionChartGridModel | null,
  loading: boolean,
): CbrReplayDataBadge {
  if (loading) return { label: "NO DATA", kind: "none" };
  if (!chartModel) return { label: "NO DATA", kind: "none" };
  if (chartModel.loadError) return { label: "ERROR", kind: "error" };
  if (chartModel.bundleDataStatus === "live") return { label: "MOEX", kind: "live" };
  if (chartModel.bundleDataStatus === "partial") return { label: "INCOMPLETE", kind: "partial" };
  return { label: "NO DATA", kind: "none" };
}

export type CbrReplaySummary = import("@/lib/domain/cbr-rate-reaction-summary").CbrRateReactionSummary;

export {
  buildCbrRateReactionSummary,
  buildConfirmationSentence,
  buildFactSentence,
  buildReactionSentence,
  buildReplaySummary,
  type CbrRateReactionSummary,
} from "@/lib/domain/cbr-rate-reaction-summary";

export function matrixRowsForReplayMode(mode: CbrReplayMarketMode) {
  if (mode === "equities") return CBR_EQUITIES_MATRIX_ROWS;
  if (mode === "currency") return CBR_CURRENCY_MATRIX_ROWS;
  return CBR_DERIVATIVES_MATRIX_ROWS;
}

export function pickCompactMatrixRows(
  rows: CbrInstrumentReactionMetrics[],
  chartModel: CbrReactionChartGridModel | null,
  mode: CbrReplayMarketMode = chartModel?.replayMode ?? "equities",
): Array<CbrInstrumentReactionMetrics | null> {
  const specs = matrixRowsForReplayMode(mode);

  return specs.map((spec) => {
    const slot = chartModel?.slots.find((s) => s.id === spec.slotId);
    const ticker = slot?.ticker ?? spec.tickerMatch;
    return rows.find((r) => r.ticker === ticker) ?? null;
  });
}

/** @deprecated use pickCompactMatrixRows */
export const pickReplayMatrixRows = pickCompactMatrixRows;

export function resolveCompactMatrixPattern(
  row: CbrInstrumentReactionMetrics | null,
  loading: boolean,
  allRows: CbrInstrumentReactionMetrics[] = [],
): string {
  if (loading) return "…";
  if (!row) return CBR_COMPACT_PATTERN_NO_DATA;
  if (row.dataStatus !== "live" && row.dataStatus !== "partial") return CBR_COMPACT_PATTERN_NO_DATA;
  if (row.reactionStatus === "no_data") return CBR_COMPACT_PATTERN_NO_DATA;
  if (row.reactionStatus === "incomplete") {
    const hasPartial =
      row.reactionPostPressPct != null ||
      row.reactionDayPct != null ||
      row.volumeRatio != null;
    return hasPartial ? CBR_COMPACT_PATTERN_INCOMPLETE : CBR_COMPACT_PATTERN_NO_DATA;
  }
  const hasMetric =
    row.reaction5mPct != null ||
    row.reaction30mPct != null ||
    row.reactionPostPressPct != null ||
    row.reactionDayPct != null;
  if (!hasMetric) return CBR_COMPACT_PATTERN_NO_DATA;
  const label = matrixPatternLabel(row, allRows);
  return label ?? "—";
}

export function surpriseFromEvent(event: CbrRateEvent): number | null {
  return event.surpriseBps ?? calculateSurpriseBps(event.expectedRate, event.actualRate);
}
