/**
 * Режимы инструментов на странице «Ставка ЦБ Replay».
 * Акции (IMOEX), валюта (USD/CNY) и срочный рынок (MX/Si/CNY) не смешиваются в одном выводе.
 */

import type { CbrChartSlotId } from "@/lib/domain/cbr-rate-chart-model";

export type CbrReplayMarketMode = "equities" | "currency" | "derivatives";

export const CBR_REPLAY_MARKET_MODES: readonly CbrReplayMarketMode[] = [
  "equities",
  "currency",
  "derivatives",
] as const;

export const CBR_REPLAY_MODE_LABELS: Record<CbrReplayMarketMode, string> = {
  equities: "Акции",
  currency: "Валюта",
  derivatives: "Срочный рынок",
};

export const CBR_REPLAY_MODE_HINTS: Record<CbrReplayMarketMode, string> = {
  equities: "IMOEX · SBER · GAZP · LKOH · VTBR · RGBI",
  currency: "USD/RUB · CNY/RUB · perpetual → Si/CNY",
  derivatives: "MX · Si · CNY",
};

/** Ключевые слоты для guard целостности (LKOH, VTBR, RGBI — опциональные). */
export const CBR_KEY_EQUITIES_SLOT_IDS: readonly CbrChartSlotId[] = [
  "equity-index",
  "sber",
  "gazp",
];

export const CBR_KEY_CURRENCY_SLOT_IDS: readonly CbrChartSlotId[] = ["usd-rub", "cny-rub"];

export const CBR_KEY_DERIVATIVES_SLOT_IDS: readonly CbrChartSlotId[] = [
  "mx-futures",
  "usd-rub",
  "cny-rub",
];

export function keyReplaySlotIdsForMode(mode: CbrReplayMarketMode): readonly CbrChartSlotId[] {
  if (mode === "equities") return CBR_KEY_EQUITIES_SLOT_IDS;
  if (mode === "currency") return CBR_KEY_CURRENCY_SLOT_IDS;
  return CBR_KEY_DERIVATIVES_SLOT_IDS;
}

export function replayModeBenchmarkLabel(mode: CbrReplayMarketMode): string {
  if (mode === "equities") return "IMOEX";
  if (mode === "derivatives") return "MX";
  return "валюта";
}

export function benchmarkSlotIdForReplayMode(mode: CbrReplayMarketMode): CbrChartSlotId {
  if (mode === "equities") return "equity-index";
  if (mode === "derivatives") return "mx-futures";
  return "usd-rub";
}

/** Порог live-инструментов для full_moex (не больше числа слотов режима). */
export function minLiveInstrumentsForFullReplay(mode: CbrReplayMarketMode): number {
  if (mode === "equities") return 3;
  if (mode === "derivatives") return 3;
  return 2;
}
