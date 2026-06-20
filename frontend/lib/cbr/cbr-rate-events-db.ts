/**
 * Загрузка ручной базы заседаний ЦБ из frontend/data/cbr-rate-events.ts
 */

import {
  CBR_RATE_EVENTS_MANUAL,
  groupCbrRateEventsManualByYear,
  type CbrRateEventManualRecord,
} from "@/data/cbr-rate-events";
import { buildDefaultCbrInstruments } from "@/lib/cbr/cbr-instruments";
import type {
  CbrDecisionType,
  CbrEventDataStatus,
  CbrRateEvent,
  CbrSourceStatus,
  CbrTone,
} from "@/lib/cbr/cbr-rate-events";

export type { CbrRateEventManualRecord } from "@/data/cbr-rate-events";

export type CbrRateEventDbRecord = CbrRateEventManualRecord;

export type CbrRateEventsByYear = Record<string, CbrRateEventDbRecord[]>;

export const CBR_RATE_EVENTS_DB_TODOS: readonly string[] = [
  "верификация 2025/2024 по пресс-релизам cbr.ru",
  "ожидания рынка — только вручную (expectationStatus: manual)",
  "импорт официальной истории ставок ЦБ",
];

const DEFAULT_TITLE = "Заседание Совета директоров Банка России";
const DEFAULT_KEY_RATE_URL = "https://www.cbr.ru/hd_base/KeyRate/";

export function mapSourceStatusToDataStatus(
  status: CbrSourceStatus,
  actualRate: number | null,
): CbrEventDataStatus {
  if (status === "official") {
    return actualRate != null ? "real" : "partial";
  }
  if (status === "manual") return "manual";
  return "manual";
}

function defaultTraderTakeaway(record: CbrRateEventDbRecord): string {
  if (record.sourceStatus === "needs_verification") {
    return "Запись каталога не верифицирована — сверить ставку и дату по cbr.ru перед торговым выводом.";
  }
  if (record.decisionType === "upcoming") {
    return "До 13:30 — позиционирование; факт ставки объявят на заседании.";
  }
  return "Смотреть первую ногу Si и MX в окне 13:30–15:00.";
}

function recordToCbrRateEvent(record: CbrRateEventDbRecord): CbrRateEvent {
  const tone: CbrTone = "unknown";

  return {
    id: record.id,
    date: record.date,
    year: record.year,
    title: DEFAULT_TITLE,
    decisionTime: record.decisionTime,
    pressConferenceTime: record.pressConferenceTime,
    previousRate: record.previousRate,
    expectedRate: record.expectedRate,
    actualRate: record.actualRate,
    changeBps: record.changeBps,
    surpriseBps: record.surpriseBps,
    decisionType: record.decisionType,
    expectationType:
      record.expectationStatus === "manual" && record.expectedRate != null
        ? "unknown"
        : "unknown",
    tone,
    officialUrl: record.officialUrl ?? DEFAULT_KEY_RATE_URL,
    statementUrl: record.statementUrl,
    summary: record.summary,
    traderTakeaway: defaultTraderTakeaway(record),
    dataStatus: mapSourceStatusToDataStatus(record.sourceStatus, record.actualRate),
    sourceStatus: record.sourceStatus,
    expectationStatus: record.expectationStatus,
    instruments: buildDefaultCbrInstruments({ reactionDemo: false }),
  };
}

export function loadCbrRateEventsDb(): CbrRateEventsByYear {
  return groupCbrRateEventsManualByYear();
}

export function flattenCbrRateEventsDb(byYear: CbrRateEventsByYear = loadCbrRateEventsDb()): CbrRateEvent[] {
  const records: CbrRateEventDbRecord[] = [];
  for (const year of Object.keys(byYear).sort((a, b) => Number(b) - Number(a))) {
    records.push(...(byYear[year] ?? []));
  }
  return records.map(recordToCbrRateEvent);
}

/** Сырые события до enrich — для getCbrRateEvents(). */
export function loadCbrRateEventsRaw(): CbrRateEvent[] {
  return CBR_RATE_EVENTS_MANUAL.map(recordToCbrRateEvent);
}
