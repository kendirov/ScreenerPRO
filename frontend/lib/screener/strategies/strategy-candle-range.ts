import type { StrategyTimeframeMinutes } from "@/lib/screener/strategies/strategy-candles";
import type { StrategyCandle } from "@/lib/strategies/strategy-candles-normalizer";

/** Hard safety cap for Strategy Lab v0. */
export const STRATEGY_MAX_CANDLES = 5000;

export type StrategyCandlePeriodId = "today" | "3d" | "10d" | "20d" | "60d";

export type StrategyCandleDateRange = {
  from: string;
  till: string;
  periodId: StrategyCandlePeriodId;
  calendarDays: number;
};

export const STRATEGY_CANDLE_PERIOD_OPTIONS: {
  id: StrategyCandlePeriodId;
  label: string;
  toolbarLabel: string;
}[] = [
  { id: "today", label: "Сегодня", toolbarLabel: "сегодня" },
  { id: "3d", label: "3д", toolbarLabel: "3д" },
  { id: "10d", label: "10д", toolbarLabel: "10д" },
  { id: "20d", label: "20д", toolbarLabel: "20д" },
  { id: "60d", label: "60д", toolbarLabel: "60д" },
];

const PERIOD_CALENDAR_DAYS: Record<StrategyCandlePeriodId, number> = {
  today: 1,
  "3d": 3,
  "10d": 10,
  "20d": 20,
  "60d": 60,
};

export function isStrategyCandlePeriodId(value: string | null | undefined): value is StrategyCandlePeriodId {
  return (
    value === "today" ||
    value === "3d" ||
    value === "10d" ||
    value === "20d" ||
    value === "60d"
  );
}

export function defaultPeriodForTimeframe(_timeframe: StrategyTimeframeMinutes): StrategyCandlePeriodId {
  return "20d";
}

export function formatStrategyPeriodToolbar(periodId: StrategyCandlePeriodId): string {
  return STRATEGY_CANDLE_PERIOD_OPTIONS.find((option) => option.id === periodId)?.toolbarLabel ?? periodId;
}

export function formatStrategyCandlesSummary(candleCount: number, periodId: StrategyCandlePeriodId): string {
  return `Свечей: ${candleCount} · период ${formatStrategyPeriodToolbar(periodId)}`;
}

/** Moscow calendar date YYYY-MM-DD. */
export function moscowDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function shiftMoscowDateKey(dateKey: string, deltaDays: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utcMs = Date.UTC(year!, month! - 1, day!);
  const shifted = new Date(utcMs + deltaDays * 24 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function resolveStrategyCandleDateRange(options: {
  periodId: StrategyCandlePeriodId;
  now?: Date;
}): StrategyCandleDateRange {
  const till = moscowDateKey(options.now);
  const calendarDays = PERIOD_CALENDAR_DAYS[options.periodId];
  const from = shiftMoscowDateKey(till, -(calendarDays - 1));

  return {
    from,
    till,
    periodId: options.periodId,
    calendarDays,
  };
}

export function resolveStrategyCandleDateRangeFromParams(options: {
  period?: string | null;
  from?: string | null;
  till?: string | null;
  now?: Date;
}): StrategyCandleDateRange {
  const tillDefault = moscowDateKey(options.now);

  if (options.from?.trim() && options.till?.trim()) {
    const from = options.from.trim().slice(0, 10);
    const till = options.till.trim().slice(0, 10);
    const periodId = isStrategyCandlePeriodId(options.period) ? options.period : "3d";
    const calendarDays = Math.max(1, daysBetweenInclusive(from, till));
    return { from, till, periodId, calendarDays };
  }

  const periodId = isStrategyCandlePeriodId(options.period) ? options.period : "3d";
  return resolveStrategyCandleDateRange({ periodId, now: options.now });
}

function daysBetweenInclusive(from: string, till: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const tillMs = Date.parse(`${till}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(tillMs)) return 1;
  return Math.floor((tillMs - fromMs) / (24 * 3600 * 1000)) + 1;
}

export function parseStrategyCandleLimit(raw: string | null | undefined, fallback = STRATEGY_MAX_CANDLES): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(STRATEGY_MAX_CANDLES, Math.max(1, Math.trunc(n)));
}

/** Compact fingerprint for memoizing analytics over candle batches. */
export function hashStrategyCandles(candles: StrategyCandle[]): string {
  if (candles.length === 0) return "0";
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  return `${candles.length}:${first.time}:${first.open}:${first.close}:${last.time}:${last.close}`;
}

export function capStrategyCandles<T>(
  candles: T[],
  max = STRATEGY_MAX_CANDLES,
): { candles: T[]; capped: boolean } {
  if (candles.length <= max) return { candles, capped: false };
  return { candles: candles.slice(candles.length - max), capped: true };
}

export function strategyCandlesNoDataMessage(secid: string, periodId: StrategyCandlePeriodId): string {
  return `За выбранный период (${formatStrategyPeriodToolbar(periodId)}) нет свечей для ${secid}`;
}
