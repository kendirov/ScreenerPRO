/**
 * Адаптер canonical CbrRateEvent → legacy domain shape для chart/replay модулей.
 */

import type { CbrChartSlotId } from "@/lib/domain/cbr-rate-chart-model";
import type {
  CbrDataStatus,
  CbrDecisionType as LegacyDecisionType,
  CbrEventStatus,
  CbrExpectationSource,
  CbrInstrumentReaction,
  CbrInstrumentRole as LegacyRole,
  CbrRateEvent as LegacyCbrRateEvent,
  CbrTone as LegacyTone,
} from "@/lib/domain/cbr-rate-events-legacy-types";
import type {
  CbrInstrumentRole,
  CbrRateEvent,
  CbrRateInstrumentConfig,
} from "@/lib/cbr/cbr-rate-events";
import { isUpcomingEvent } from "@/lib/cbr/cbr-rate-events";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import type { CbrMoexInstrumentSpec } from "@/lib/domain/cbr-rate-instrument-config";
import { resolveCbrReplayInstrumentSpecs } from "@/lib/domain/cbr-rate-instrument-config";

export type DomainCbrRateEvent = LegacyCbrRateEvent;

const ROLE_TO_SLOT: Record<CbrInstrumentRole, CbrChartSlotId> = {
  equity_index: "equity-index",
  bank: "sber",
  heavy_stock: "gazp",
  bonds: "bonds",
  usd_fut: "usd-rub",
  cny_fut: "cny-rub",
  index_fut: "mx-futures",
};

const ROLE_TO_LEGACY: Record<CbrInstrumentRole, LegacyRole> = {
  equity_index: "index",
  bank: "bank",
  heavy_stock: "heavy",
  bonds: "bonds",
  usd_fut: "currency",
  cny_fut: "currency",
  index_fut: "index",
};

const HEAVY_STOCK_SLOT: Record<string, CbrChartSlotId> = {
  GAZP: "gazp",
  LKOH: "lkoh",
  VTBR: "vtbr",
};

export function mapInstrumentDataStatusToDomain(
  status: CbrRateInstrumentConfig["dataStatus"],
): CbrDataStatus {
  if (status === "moex") return "live";
  if (status === "demo") return "fallback";
  return "mock";
}

export function mapEventDataStatusToDomain(status: CbrRateEvent["dataStatus"]): CbrDataStatus {
  if (status === "real") return "live";
  if (status === "partial") return "partial";
  if (status === "manual") return "mock";
  return "mock";
}

function mapTone(tone: CbrRateEvent["tone"]): LegacyTone | null {
  if (tone === "unknown") return null;
  return tone;
}

function mapDecisionType(event: CbrRateEvent): LegacyDecisionType | null {
  if (event.decisionType === "upcoming") return null;
  return event.decisionType;
}

function toLegacyInstrument(inst: CbrRateInstrumentConfig): CbrInstrumentReaction {
  return {
    ticker: inst.ticker,
    title: inst.title,
    marketType: inst.engine === "futures" ? "futures" : inst.role === "bonds" ? "bond" : "stock",
    role: ROLE_TO_LEGACY[inst.role],
    dataStatus: mapInstrumentDataStatusToDomain(inst.dataStatus),
    reaction5mPct: null,
    reaction30mPct: null,
    reactionPostPressPct: null,
    reactionDayPct: null,
    volumeRatio: null,
    volatilityRatio: null,
    interpretationTag: null,
    traderRead: null,
  };
}

export function toDomainCbrRateEvent(event: CbrRateEvent): DomainCbrRateEvent {
  const status: CbrEventStatus = isUpcomingEvent(event) ? "upcoming" : "past";
  const expectationSource: CbrExpectationSource =
    event.expectedRate != null ? "manual" : "mock";

  return {
    id: event.id,
    date: event.date,
    title: event.title,
    status,
    dataStatus: mapEventDataStatusToDomain(event.dataStatus),
    decisionTime: event.decisionTime,
    pressConferenceTime: event.pressConferenceTime ?? "",
    previousRate: event.previousRate ?? 0,
    expectedRate: event.expectedRate,
    expectationSource,
    actualRate: event.actualRate,
    surpriseBps: event.surpriseBps,
    decisionType: mapDecisionType(event),
    tone: mapTone(event.tone),
    toneLabelRu: event.tone !== "unknown" ? null : null,
    officialUrl: event.officialUrl ?? null,
    statementUrl: event.statementUrl ?? null,
    summary: event.summary,
    keyPhrases: [],
    marketContext: [event.traderTakeaway],
    statementBrief: null,
    instruments: event.instruments.map(toLegacyInstrument),
  };
}

function instrumentToMoexSpec(inst: CbrRateInstrumentConfig): CbrMoexInstrumentSpec | null {
  let slotId = ROLE_TO_SLOT[inst.role];
  if (inst.role === "heavy_stock") {
    slotId = HEAVY_STOCK_SLOT[inst.ticker] ?? "gazp";
  }

  const nearestCurrencyFut =
    (inst.role === "usd_fut" || inst.role === "cny_fut") &&
    (inst.ticker === "Si" || inst.ticker === "SI" || inst.ticker === "CNY");

  const spec: CbrMoexInstrumentSpec = {
    slotId,
    label: inst.title,
    displayTicker: inst.ticker,
    engine: inst.engine,
    market: inst.market,
    board: inst.board,
    marketSegment: nearestCurrencyFut
      ? "derivatives"
      : inst.role === "usd_fut" || inst.role === "cny_fut"
        ? "currency"
        : inst.engine === "futures"
          ? "derivatives"
          : "equities",
  };

  if (inst.engine === "futures") {
    if (inst.ticker === "MX") spec.futuresAssetCode = "MX";
    else if (inst.ticker === "Si" || inst.ticker === "SI") spec.futuresAssetCode = "Si";
    else if (inst.ticker === "CNY") spec.futuresAssetCode = "CNY";
  } else {
    spec.secid = inst.ticker;
  }

  if (inst.role === "usd_fut" && !nearestCurrencyFut) {
    spec.currencyKey = "usd_rub";
  }
  if (inst.role === "cny_fut" && !nearestCurrencyFut) {
    spec.currencyKey = "cny_rub";
  }

  spec.allowDemoFallback = false;

  return spec;
}

export function instrumentConfigsToMoexSpecs(
  instruments: CbrRateInstrumentConfig[],
): CbrMoexInstrumentSpec[] {
  return instruments
    .map(instrumentToMoexSpec)
    .filter((s): s is CbrMoexInstrumentSpec => s != null);
}

export function resolveInstrumentSpecsFromEvent(
  event: CbrRateEvent,
  mode: CbrReplayMarketMode = "equities",
): CbrMoexInstrumentSpec[] {
  void event;
  return resolveCbrReplayInstrumentSpecs(mode);
}
