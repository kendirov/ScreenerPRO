/**
 * Проверка целостности данных страницы «Ставка ЦБ».
 *
 * Слои:
 * 1. Официальные данные ЦБ (дата, ставки, пресс-релиз, 13:30)
 * 2. Рыночные MOEX (свечи, объём, диапазон)
 * 3. Ручные (ожидание, тон, трейдерский вывод)
 * 4. Demo/mock — только при отсутствии реальных данных
 */

import type { CbrChartSlot } from "@/lib/domain/cbr-rate-chart-model";
import { resolveCbrChartSlotBadge } from "@/lib/domain/cbr-rate-chart-model";
import {
  isUpcomingEvent,
  type CbrEventDataStatus,
  type CbrRateEvent,
  type CbrTone,
} from "@/lib/cbr/cbr-rate-events";

export type CbrDataIntegrityStatus =
  | "official_event_live_charts"
  | "manual_event_live_charts"
  | "official_event_partial_charts"
  | "manual_event_demo_charts"
  | "mock";

export type CbrEventIntegrityBadge = "official" | "manual" | "mock";

export type CbrInstrumentChartIntegrity = {
  slotId: string;
  ticker: string;
  title: string;
  status: "moex" | "demo" | "no_data" | "partial";
};

export type CbrChartsIntegrityBundle = "moex" | "partial" | "demo" | "no_data";

export type CbrOfficialDataLayer = {
  date: boolean;
  rateBefore: boolean;
  rateAfter: boolean;
  pressRelease: boolean;
  decisionTime13_30: boolean;
};

export type CbrManualDataLayer = {
  expectation: boolean;
  tone: boolean;
  traderTakeaway: boolean;
};

export type CbrMoexDataLayer = {
  candles: boolean;
  volume: boolean;
  dayRange: boolean;
};

export type CbrDataLayers = {
  official: CbrOfficialDataLayer;
  manual: CbrManualDataLayer;
  moex: CbrMoexDataLayer;
  usesDemoFallback: boolean;
};

export type CbrDataIntegrityView = {
  status: CbrDataIntegrityStatus;
  caption: string;
  eventBadge: CbrEventIntegrityBadge;
  chartsBundle: CbrChartsIntegrityBundle;
  layers: CbrDataLayers;
  instruments: CbrInstrumentChartIntegrity[];
};

export const CBR_DATA_INTEGRITY_CAPTIONS: Record<CbrDataIntegrityStatus, string> = {
  official_event_live_charts: "Ставка: официально / графики: MOEX",
  manual_event_live_charts: "Ставка: вручную / графики: MOEX",
  official_event_partial_charts: "Ставка: официально / графики: частично MOEX",
  manual_event_demo_charts: "Ставка: вручную / графики: частично MOEX",
  mock: "Нет данных MOEX за выбранный день",
};

export const CBR_EVENT_INTEGRITY_LABELS: Record<CbrEventIntegrityBadge, string> = {
  official: "официально",
  manual: "вручную",
  mock: "демо",
};

export const CBR_INSTRUMENT_INTEGRITY_LABELS: Record<
  CbrInstrumentChartIntegrity["status"],
  string
> = {
  moex: "MOEX",
  partial: "INCOMPLETE",
  demo: "NO DATA",
  no_data: "NO DATA",
};

export type CbrRateSourceDisplay = "official" | "manual";

export type CbrChartsStatusDisplay = "MOEX" | "partial" | "no data";

export function resolveRateSourceDisplay(event: CbrRateEvent): CbrRateSourceDisplay {
  if (event.sourceStatus === "official") return "official";
  return "manual";
}

export function resolveChartsStatusDisplay(
  bundle: CbrChartsIntegrityBundle,
): CbrChartsStatusDisplay {
  if (bundle === "moex") return "MOEX";
  if (bundle === "partial") return "partial";
  return "no data";
}

export function resolveEventIntegrityBadge(event: CbrRateEvent): CbrEventIntegrityBadge {
  const source = resolveEventDataSource(event.dataStatus, event);
  if (source === "official") return "official";
  if (source === "manual") return "manual";
  return "mock";
}

function resolveEventDataSource(
  dataStatus: CbrEventDataStatus,
  event: CbrRateEvent,
): "official" | "manual" | "mock" {
  if (isUpcomingEvent(event) || dataStatus === "mock") return "mock";
  if (dataStatus === "manual") return "manual";
  if (dataStatus === "real" || dataStatus === "partial") return "official";
  return "mock";
}

export function chartSlotToInstrumentIntegrity(slot: CbrChartSlot): CbrInstrumentChartIntegrity {
  const badge = resolveCbrChartSlotBadge(slot);

  let status: CbrInstrumentChartIntegrity["status"];
  if (badge.label === "MOEX") status = "moex";
  else if (badge.label === "INCOMPLETE") status = "partial";
  else status = "no_data";

  return {
    slotId: slot.id,
    ticker: slot.ticker,
    title: slot.title,
    status,
  };
}

export function instrumentsDataFromChartSlots(
  slots: CbrChartSlot[] | undefined,
): CbrInstrumentChartIntegrity[] {
  if (!slots?.length) return [];
  return slots.map(chartSlotToInstrumentIntegrity);
}

export function resolveChartsIntegrityBundle(
  instrumentsData: CbrInstrumentChartIntegrity[],
): CbrChartsIntegrityBundle {
  const tradable = instrumentsData.filter((i) => i.status !== "no_data");
  if (!tradable.length) return "no_data";

  const moexLike = tradable.filter((i) => i.status === "moex" || i.status === "partial");
  const demo = tradable.filter((i) => i.status === "demo");

  if (demo.length === tradable.length) return "demo";
  if (moexLike.length === tradable.length && !tradable.some((i) => i.status === "partial")) {
    return "moex";
  }
  if (moexLike.length > 0 && demo.length > 0) return "partial";
  if (tradable.some((i) => i.status === "partial")) return "partial";
  if (moexLike.length > 0) return "partial";
  return "demo";
}

export function resolveDataLayers(
  event: CbrRateEvent,
  instrumentsData: CbrInstrumentChartIntegrity[],
): CbrDataLayers {
  const officialSource = resolveEventDataSource(event.dataStatus, event) === "official";

  const hasMoexCandles = instrumentsData.some(
    (i) => i.status === "moex" || i.status === "partial",
  );
  const hasDemo = instrumentsData.some((i) => i.status === "demo");

  return {
    official: {
      date: officialSource && Boolean(event.date),
      rateBefore: officialSource && event.previousRate != null,
      rateAfter: officialSource && event.actualRate != null,
      pressRelease: officialSource && Boolean(event.statementUrl ?? event.officialUrl),
      decisionTime13_30: officialSource && event.decisionTime === "13:30",
    },
    manual: {
      expectation: event.expectedRate != null,
      tone: isManualTone(event.tone),
      traderTakeaway: Boolean(event.traderTakeaway?.trim()),
    },
    moex: {
      candles: hasMoexCandles,
      volume: hasMoexCandles,
      dayRange: hasMoexCandles,
    },
    usesDemoFallback: hasDemo,
  };
}

function isManualTone(tone: CbrTone | null | undefined): boolean {
  return tone != null && tone !== "unknown";
}

export function getDataIntegrityStatus(
  event: CbrRateEvent,
  instrumentsData: CbrInstrumentChartIntegrity[],
): CbrDataIntegrityStatus {
  const eventSource = resolveEventDataSource(event.dataStatus, event);
  const charts = resolveChartsIntegrityBundle(instrumentsData);

  if (eventSource === "mock") return "mock";

  if (charts === "demo" || charts === "no_data") {
    return eventSource === "manual" ? "manual_event_demo_charts" : "mock";
  }

  if (charts === "partial") {
    return eventSource === "official"
      ? "official_event_partial_charts"
      : "manual_event_demo_charts";
  }

  return eventSource === "official"
    ? "official_event_live_charts"
    : "manual_event_live_charts";
}

export function getDataIntegrityCaption(status: CbrDataIntegrityStatus): string {
  return CBR_DATA_INTEGRITY_CAPTIONS[status];
}

export function buildDataIntegrityView(
  event: CbrRateEvent,
  instrumentsData: CbrInstrumentChartIntegrity[],
): CbrDataIntegrityView {
  const status = getDataIntegrityStatus(event, instrumentsData);
  return {
    status,
    caption: getDataIntegrityCaption(status),
    eventBadge: resolveEventIntegrityBadge(event),
    chartsBundle: resolveChartsIntegrityBundle(instrumentsData),
    layers: resolveDataLayers(event, instrumentsData),
    instruments: instrumentsData,
  };
}
