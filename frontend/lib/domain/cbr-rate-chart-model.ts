import { resolveInstrumentSpecsFromEvent } from "@/lib/cbr/cbr-domain-adapter";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import { getCbrRateEventById as getCanonicalCbrRateEventById } from "@/lib/cbr/cbr-rate-events";
import type { CbrDataStatus, CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import { fetchCbrRateCandlesFromApi } from "@/lib/domain/cbr-rate-candles-client";
import type { CbrMoexInstrumentSpec } from "@/lib/domain/cbr-rate-instrument-config";
import { resolveCbrReplayInstrumentSpecs } from "@/lib/domain/cbr-rate-instrument-config";
import {
  getEventWindow,
  mskTimeToUnix,
} from "@/lib/domain/cbr-rate-event-window";

export type CbrChartTimeframe = 1 | 5 | 15;

export type CbrChartRenderMode = "candles" | "area";

export type CbrChartSlotId =
  | "equity-index"
  | "sber"
  | "gazp"
  | "lkoh"
  | "vtbr"
  | "bonds"
  | "usd-rub"
  | "cny-rub"
  | "mx-futures";

export type CbrChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  value?: number;
};

export type CbrEventMarker = {
  id: "decision" | "press";
  timeUnix: number;
  timeMsk: string;
  label: string;
};

export const CBR_MOEX_ZERO_CANDLES_REASON =
  "MOEX ISS вернул 0 свечей за выбранный день";

export type CbrChartSlot = {
  id: CbrChartSlotId;
  ticker: string;
  title: string;
  secid: string;
  resolvedSecid?: string;
  placeholder: boolean;
  placeholderReason?: string;
  dataStatus: CbrDataStatus;
  candles: CbrChartCandle[];
  source?: "moex-iss" | "none";
  error?: string;
  diagnostics?: string[];
  currencyResolvedType?: "perpetual_futures" | "nearest_futures" | "unresolved";
};

export type CbrReactionChartGridModel = {
  eventId: string;
  replayMode: CbrReplayMarketMode;
  timeframe: CbrChartTimeframe;
  renderMode: CbrChartRenderMode;
  window: ReturnType<typeof getEventWindow>;
  markers: CbrEventMarker[];
  slots: CbrChartSlot[];
  bundleDataStatus: CbrDataStatus;
  loadError?: string;
};

export const CBR_CHART_TIMEFRAMES: CbrChartTimeframe[] = [1, 5, 15];

export const CBR_CHART_TIMEFRAME_LABELS: Record<CbrChartTimeframe, string> = {
  1: "1м",
  5: "5м",
  15: "15м",
};

export function candleDayChangePct(candles: CbrChartCandle[]): number | null {
  if (candles.length < 2) return null;
  const first = candles[0]!.open;
  const last = candles[candles.length - 1]!.close;
  if (!first) return null;
  return ((last - first) / first) * 100;
}

export function slotHasMoexCandles(slot: Pick<CbrChartSlot, "candles" | "dataStatus">): boolean {
  return (
    slot.candles.length >= 2 &&
    (slot.dataStatus === "live" || slot.dataStatus === "partial")
  );
}

export function buildCbrEventMarkers(event: CbrRateEvent): CbrEventMarker[] {
  const canonical = getCanonicalCbrRateEventById(event.id);
  const pressTime = canonical?.pressConferenceTime;

  const markers: CbrEventMarker[] = [
    {
      id: "decision",
      timeUnix: mskTimeToUnix(event.date, event.decisionTime),
      timeMsk: event.decisionTime,
      label: "Решение ЦБ",
    },
  ];

  if (pressTime) {
    markers.push({
      id: "press",
      timeUnix: mskTimeToUnix(event.date, pressTime),
      timeMsk: pressTime,
      label: "Комментарий / пресс-конференция",
    });
  }

  return markers;
}

export type CbrChartSlotBadgeLabel = "MOEX" | "NO DATA" | "ERROR" | "INCOMPLETE";

export function resolveCbrChartSlotBadge(
  slot: CbrChartSlot,
  options?: { loading?: boolean },
): { label: CbrChartSlotBadgeLabel; showChart: boolean } {
  if (options?.loading) {
    return { label: "NO DATA", showChart: false };
  }
  if (slot.error) {
    return { label: "ERROR", showChart: false };
  }
  if (slot.placeholder || slot.candles.length < 2) {
    return { label: "NO DATA", showChart: false };
  }
  if (slot.dataStatus === "live") {
    return { label: "MOEX", showChart: true };
  }
  if (slot.dataStatus === "partial") {
    return { label: "INCOMPLETE", showChart: true };
  }
  return { label: "NO DATA", showChart: false };
}

export function resolveCbrInstrumentSpecs(
  event: CbrRateEvent,
  mode: CbrReplayMarketMode = "equities",
): CbrMoexInstrumentSpec[] {
  const canonical = getCanonicalCbrRateEventById(event.id);
  if (canonical) return resolveInstrumentSpecsFromEvent(canonical, mode);
  return resolveCbrReplayInstrumentSpecs(mode);
}

function bundleStatusFromSlots(slots: CbrChartSlot[]): CbrDataStatus {
  const withMoex = slots.filter(slotHasMoexCandles);
  if (!withMoex.length) return "mock";
  if (withMoex.length === slots.length && withMoex.every((s) => s.dataStatus === "live")) {
    return "live";
  }
  return "partial";
}

function buildNoDataSlot(
  spec: CbrMoexInstrumentSpec,
  partial: {
    ticker?: string;
    title?: string;
    secid?: string;
    resolvedSecid?: string;
    error?: string;
    diagnostics?: string[];
    currencyResolvedType?: CbrChartSlot["currencyResolvedType"];
  } = {},
): CbrChartSlot {
  const ticker = partial.ticker ?? spec.displayTicker;
  return {
    id: spec.slotId,
    ticker,
    title: partial.title ?? spec.label,
    secid: partial.secid ?? spec.secid ?? ticker,
    resolvedSecid: partial.resolvedSecid,
    placeholder: true,
    placeholderReason: CBR_MOEX_ZERO_CANDLES_REASON,
    dataStatus: "mock",
    candles: [],
    source: "none",
    error: partial.error ?? CBR_MOEX_ZERO_CANDLES_REASON,
    diagnostics: partial.diagnostics,
    currencyResolvedType: partial.currencyResolvedType,
  };
}

async function loadSlotCandles(
  event: CbrRateEvent,
  spec: CbrMoexInstrumentSpec,
  timeframe: CbrChartTimeframe,
  signal?: AbortSignal,
): Promise<CbrChartSlot> {
  if (spec.placeholder) {
    return buildNoDataSlot(spec, {
      error: spec.placeholderReason ?? CBR_MOEX_ZERO_CANDLES_REASON,
    });
  }

  try {
    const api = await fetchCbrRateCandlesFromApi(spec, event.date, timeframe, {
      allowFallback: false,
      signal,
    });

    const honestTitle = api.currencyDisplayLabel ?? spec.label;
    const resolvedTicker = api.resolvedTicker || spec.displayTicker;
    const hasLive = api.dataStatus === "live" && api.candles.length >= 2;

    if (!hasLive) {
      return buildNoDataSlot(spec, {
        ticker: resolvedTicker,
        title: honestTitle,
        secid: resolvedTicker,
        resolvedSecid:
          api.resolvedTicker !== (spec.secid ?? spec.displayTicker)
            ? api.resolvedTicker
            : undefined,
        error: api.error ?? CBR_MOEX_ZERO_CANDLES_REASON,
        diagnostics: api.diagnostics,
        currencyResolvedType: api.currencyResolvedType,
      });
    }

    return {
      id: spec.slotId,
      ticker: resolvedTicker,
      title: honestTitle,
      secid: resolvedTicker,
      resolvedSecid:
        api.resolvedTicker !== (spec.secid ?? spec.displayTicker) ? api.resolvedTicker : undefined,
      placeholder: false,
      dataStatus: "live",
      candles: api.candles,
      source: "moex-iss",
      error: api.error,
      diagnostics: api.diagnostics,
      currencyResolvedType: api.currencyResolvedType,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return buildNoDataSlot(spec, { error: message });
  }
}

export async function buildCbrReactionChartGridModel(
  event: CbrRateEvent,
  timeframe: CbrChartTimeframe,
  renderMode: CbrChartRenderMode = "candles",
  options?: { signal?: AbortSignal; replayMode?: CbrReplayMarketMode },
): Promise<CbrReactionChartGridModel> {
  const replayMode = options?.replayMode ?? "equities";
  const window = getEventWindow(event.date);
  const markers = buildCbrEventMarkers(event);
  const specs = resolveCbrInstrumentSpecs(event, replayMode);

  const slots = await Promise.all(
    specs.map((spec) => loadSlotCandles(event, spec, timeframe, options?.signal)),
  );

  return {
    eventId: event.id,
    replayMode,
    timeframe,
    renderMode,
    window,
    markers,
    slots,
    bundleDataStatus: bundleStatusFromSlots(slots),
  };
}

/** Skeleton while loading — без свечей */
export function buildCbrReactionChartGridSkeleton(
  event: CbrRateEvent,
  timeframe: CbrChartTimeframe,
  renderMode: CbrChartRenderMode = "candles",
  replayMode: CbrReplayMarketMode = "equities",
): CbrReactionChartGridModel {
  const specs = resolveCbrInstrumentSpecs(event, replayMode);
  const slots: CbrChartSlot[] = specs.map((spec) => ({
    id: spec.slotId,
    ticker: spec.displayTicker,
    title: spec.label,
    secid: spec.secid ?? spec.displayTicker,
    placeholder: true,
    placeholderReason: undefined,
    dataStatus: "mock",
    candles: [],
    source: "none",
  }));

  return {
    eventId: event.id,
    replayMode,
    timeframe,
    renderMode,
    window: getEventWindow(event.date),
    markers: buildCbrEventMarkers(event),
    slots,
    bundleDataStatus: "mock",
  };
}

export { minutesFromSessionOpen } from "@/lib/domain/cbr-rate-event-window";
