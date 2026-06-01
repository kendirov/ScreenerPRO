/** Сообщения для режима выбранной даты (live vs history). */

export const ScreenerDateModeMessages = {
  historicalBlockNotConnected: "Исторические данные для этого блока пока не подключены",
  historicalSparklinesLiveOnly: "Свечи и in-play baseline — только в режиме LIVE",
  historicalRadarSlice: "HIST · срез торгового дня",
} as const;

export type ScreenerHistoricalFeature = "liquidity" | "inPlay" | "volatility" | "sparklines" | "index";

/** Какие блоки поддерживают исторический режим (MOEX ISS history). */
export function isHistoricalFeatureSupported(feature: ScreenerHistoricalFeature): boolean {
  if (feature === "sparklines") return false;
  return true;
}

export function historicalFeatureMessage(feature: ScreenerHistoricalFeature): string | null {
  if (isHistoricalFeatureSupported(feature)) return null;
  return ScreenerDateModeMessages.historicalBlockNotConnected;
}
