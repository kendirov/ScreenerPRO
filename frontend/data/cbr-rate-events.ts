/**
 * Ручная база заседаний ЦБ — единственный источник дат и ставок для replay.
 * Не выдумывать значения: только official / needs_verification / manual.
 */

export type CbrRateEventSourceStatus = "official" | "manual" | "needs_verification";

export type CbrRateEventExpectationStatus = "manual" | "unknown";

export type CbrRateEventDecisionType = "cut" | "hold" | "hike" | "upcoming";

export type CbrRateEventManualRecord = {
  id: string;
  date: string;
  year: number;
  decisionTime: "13:30";
  pressConferenceTime?: "15:00";
  previousRate: number | null;
  actualRate: number | null;
  expectedRate: number | null;
  changeBps: number | null;
  surpriseBps: number | null;
  decisionType: CbrRateEventDecisionType;
  officialUrl?: string;
  statementUrl?: string;
  sourceStatus: CbrRateEventSourceStatus;
  expectationStatus: CbrRateEventExpectationStatus;
  summary: string;
};

const KEY_RATE_URL = "https://www.cbr.ru/hd_base/KeyRate/";

/** Подтверждённые и перенесённые из каталога записи (без выдуманных ожиданий). */
export const CBR_RATE_EVENTS_MANUAL: readonly CbrRateEventManualRecord[] = [
  // —— 2026 ——
  {
    id: "2026-06-19",
    date: "2026-06-19",
    year: 2026,
    decisionTime: "13:30",
    pressConferenceTime: "15:00",
    previousRate: 14.5,
    actualRate: null,
    expectedRate: null,
    changeBps: null,
    surpriseBps: null,
    decisionType: "upcoming",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "official",
    expectationStatus: "unknown",
    summary: "Предстоящее опорное заседание. Ставка 14,5% с апреля 2026.",
  },
  {
    id: "2026-04-24",
    date: "2026-04-24",
    year: 2026,
    decisionTime: "13:30",
    pressConferenceTime: "15:00",
    previousRate: 15.0,
    actualRate: 14.5,
    expectedRate: null,
    changeBps: -50,
    surpriseBps: null,
    decisionType: "cut",
    officialUrl: "https://www.cbr.ru/press/PR/?file=24042026_133000key.htm",
    statementUrl: "https://www.cbr.ru/rbr/dir_decisions/rsd_2026-04-24_20_02/",
    sourceStatus: "official",
    expectationStatus: "unknown",
    summary: "Снижение ключевой ставки на 50 б.п., до 14,5% годовых.",
  },
  {
    id: "2026-03-20",
    date: "2026-03-20",
    year: 2026,
    decisionTime: "13:30",
    previousRate: 15.5,
    actualRate: 15.0,
    expectedRate: null,
    changeBps: -50,
    surpriseBps: null,
    decisionType: "cut",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Снижение ключевой ставки на 50 б.п., до 15,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2026-02-13",
    date: "2026-02-13",
    year: 2026,
    decisionTime: "13:30",
    pressConferenceTime: "15:00",
    previousRate: 16.0,
    actualRate: 15.5,
    expectedRate: null,
    changeBps: -50,
    surpriseBps: null,
    decisionType: "cut",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Снижение ключевой ставки на 50 б.п., до 15,5% годовых — сверить по cbr.ru.",
  },

  // —— 2025 (каталог, без верификации пресс-релизов) ——
  {
    id: "2025-12-19",
    date: "2025-12-19",
    year: 2025,
    decisionTime: "13:30",
    previousRate: 16.5,
    actualRate: 16.0,
    expectedRate: null,
    changeBps: -50,
    surpriseBps: null,
    decisionType: "cut",
    officialUrl: KEY_RATE_URL,
    statementUrl: "https://cbr.ru/rbr/dir_decisions/rsd_2025-12-19_20_01/",
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Снижение ключевой ставки на 50 б.п., до 16,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2025-10-24",
    date: "2025-10-24",
    year: 2025,
    decisionTime: "13:30",
    pressConferenceTime: "15:00",
    previousRate: 17.0,
    actualRate: 16.5,
    expectedRate: null,
    changeBps: -50,
    surpriseBps: null,
    decisionType: "cut",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Снижение ключевой ставки на 50 б.п., до 16,5% годовых — сверить по cbr.ru.",
  },
  {
    id: "2025-09-12",
    date: "2025-09-12",
    year: 2025,
    decisionTime: "13:30",
    previousRate: 18.0,
    actualRate: 17.0,
    expectedRate: null,
    changeBps: -100,
    surpriseBps: null,
    decisionType: "cut",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Снижение ключевой ставки на 100 б.п., до 17,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2025-07-25",
    date: "2025-07-25",
    year: 2025,
    decisionTime: "13:30",
    pressConferenceTime: "15:00",
    previousRate: 20.0,
    actualRate: 18.0,
    expectedRate: null,
    changeBps: -200,
    surpriseBps: null,
    decisionType: "cut",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Снижение ключевой ставки на 200 б.п., до 18,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2025-06-06",
    date: "2025-06-06",
    year: 2025,
    decisionTime: "13:30",
    previousRate: 21.0,
    actualRate: 20.0,
    expectedRate: null,
    changeBps: -100,
    surpriseBps: null,
    decisionType: "cut",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Снижение ключевой ставки на 100 б.п., до 20,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2025-04-25",
    date: "2025-04-25",
    year: 2025,
    decisionTime: "13:30",
    pressConferenceTime: "15:00",
    previousRate: 21.0,
    actualRate: 21.0,
    expectedRate: null,
    changeBps: 0,
    surpriseBps: null,
    decisionType: "hold",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Ключевая ставка сохранена на уровне 21,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2025-03-21",
    date: "2025-03-21",
    year: 2025,
    decisionTime: "13:30",
    previousRate: 21.0,
    actualRate: 21.0,
    expectedRate: null,
    changeBps: 0,
    surpriseBps: null,
    decisionType: "hold",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Ключевая ставка сохранена на уровне 21,0% годовых (промежуточное) — сверить по cbr.ru.",
  },
  {
    id: "2025-02-14",
    date: "2025-02-14",
    year: 2025,
    decisionTime: "13:30",
    pressConferenceTime: "15:00",
    previousRate: 21.0,
    actualRate: 21.0,
    expectedRate: null,
    changeBps: 0,
    surpriseBps: null,
    decisionType: "hold",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Ключевая ставка сохранена на уровне 21,0% годовых — сверить по cbr.ru.",
  },

  // —— 2024 ——
  {
    id: "2024-12-20",
    date: "2024-12-20",
    year: 2024,
    decisionTime: "13:30",
    previousRate: 21.0,
    actualRate: 21.0,
    expectedRate: null,
    changeBps: 0,
    surpriseBps: null,
    decisionType: "hold",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Ключевая ставка сохранена на уровне 21,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2024-10-25",
    date: "2024-10-25",
    year: 2024,
    decisionTime: "13:30",
    pressConferenceTime: "15:00",
    previousRate: 19.0,
    actualRate: 21.0,
    expectedRate: null,
    changeBps: 200,
    surpriseBps: null,
    decisionType: "hike",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Повышение ключевой ставки на 200 б.п., до 21,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2024-09-13",
    date: "2024-09-13",
    year: 2024,
    decisionTime: "13:30",
    previousRate: 18.0,
    actualRate: 19.0,
    expectedRate: null,
    changeBps: 100,
    surpriseBps: null,
    decisionType: "hike",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Повышение ключевой ставки на 100 б.п., до 19,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2024-07-26",
    date: "2024-07-26",
    year: 2024,
    decisionTime: "13:30",
    pressConferenceTime: "15:00",
    previousRate: 16.0,
    actualRate: 18.0,
    expectedRate: null,
    changeBps: 200,
    surpriseBps: null,
    decisionType: "hike",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Повышение ключевой ставки на 200 б.п., до 18,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2024-06-07",
    date: "2024-06-07",
    year: 2024,
    decisionTime: "13:30",
    previousRate: 16.0,
    actualRate: 16.0,
    expectedRate: null,
    changeBps: 0,
    surpriseBps: null,
    decisionType: "hold",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Ключевая ставка сохранена на уровне 16,0% годовых — сверить по cbr.ru.",
  },
  {
    id: "2024-03-22",
    date: "2024-03-22",
    year: 2024,
    decisionTime: "13:30",
    previousRate: 16.0,
    actualRate: 16.0,
    expectedRate: null,
    changeBps: 0,
    surpriseBps: null,
    decisionType: "hold",
    officialUrl: KEY_RATE_URL,
    sourceStatus: "needs_verification",
    expectationStatus: "unknown",
    summary: "Ключевая ставка сохранена на уровне 16,0% годовых — сверить по cbr.ru.",
  },
] as const;

export function groupCbrRateEventsManualByYear(): Record<string, CbrRateEventManualRecord[]> {
  const map: Record<string, CbrRateEventManualRecord[]> = {};
  for (const record of CBR_RATE_EVENTS_MANUAL) {
    const y = String(record.year);
    if (!map[y]) map[y] = [];
    map[y]!.push(record);
  }
  for (const year of Object.keys(map)) {
    map[year]!.sort((a, b) => b.date.localeCompare(a.date));
  }
  return map;
}
