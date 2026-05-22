/** Календарная торговая неделя (Europe/Moscow): понедельник → воскресенье. */

export type TradingWeekRange = {
  /** ISO UTC — понедельник 00:00:00.000 по Москве */
  from: string;
  /** ISO UTC — воскресенье 23:59:59.999 по Москве */
  till: string;
  /** YYYY-MM-DD понедельника (Москва) */
  weekStart: string;
  /** YYYY-MM-DD воскресенья (Москва) */
  weekEnd: string;
};

export type TradingWeekDescriptor = TradingWeekRange & {
  /** 0 = текущая, 1 = прошлая, … */
  offsetFromCurrent: number;
  weekLabel: string;
};

const MOSCOW_TZ = "Europe/Moscow";

function parseTs(ts: string): number {
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : NaN;
}

function moscowParts(ms: number): { year: number; month: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: MOSCOW_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ms))) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekdayMap[map.weekday!] ?? 0,
  };
}

function moscowDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: MOSCOW_TZ });
}

/** Понедельник календарной недели, содержащей date (по Москве). */
function mondayMsForDate(date: Date): number {
  const ms = date.getTime();
  const wd = moscowParts(ms).weekday;
  const daysBack = (wd + 6) % 7;
  return ms - daysBack * 86_400_000;
}

/**
 * Московская полночь понедельника weekStart (YYYY-MM-DD) → UTC ms.
 * Приближение: UTC+3 (DST в РФ отменён с 2014).
 */
function moscowMidnightUtcMs(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00+03:00`);
}

/**
 * Диапазон календарной недели: пн 00:00 — вс 23:59:59.999 (Москва).
 * Вечерние/выходные свечи MOEX не отбрасываются — фильтрация на уровне данных.
 */
export function getTradingWeekRange(date: Date = new Date()): TradingWeekRange {
  const mondayMs = mondayMsForDate(date);
  const weekStart = moscowDateKey(mondayMs);
  const sundayMs = mondayMs + 6 * 86_400_000;
  const weekEnd = moscowDateKey(sundayMs);

  const fromMs = moscowMidnightUtcMs(weekStart);
  const tillMs = moscowMidnightUtcMs(weekEnd) + 24 * 60 * 60 * 1000 - 1;

  return {
    from: new Date(fromMs).toISOString(),
    till: new Date(tillMs).toISOString(),
    weekStart,
    weekEnd,
  };
}

export function getWeekLabel(weekStart: string, offsetFromCurrent: number): string {
  if (offsetFromCurrent === 0) return "Текущая";
  if (offsetFromCurrent === 1) return "Прошлая";
  if (offsetFromCurrent === 2) return "2 недели назад";
  return `Неделя ${weekStart}`;
}

/**
 * Последние N календарных недель: offset 0 = текущая, 1 = прошлая, …
 */
export function getPreviousTradingWeeks(
  count: number,
  refDate: Date = new Date(),
): TradingWeekDescriptor[] {
  const n = Math.max(1, Math.min(count, 12));
  const out: TradingWeekDescriptor[] = [];
  for (let offset = 0; offset < n; offset++) {
    const d = new Date(refDate.getTime() - offset * 7 * 86_400_000);
    const range = getTradingWeekRange(d);
    out.push({
      ...range,
      offsetFromCurrent: offset,
      weekLabel: getWeekLabel(range.weekStart, offset),
    });
  }
  return out;
}

export function isTimestampInWeek(ts: string, range: TradingWeekRange): boolean {
  const ms = parseTs(ts);
  const from = parseTs(range.from);
  const till = parseTs(range.till);
  if (!Number.isFinite(ms) || !Number.isFinite(from) || !Number.isFinite(till)) return false;
  return ms >= from && ms <= till;
}

/** Минуты от понедельника 00:00 (Москва) до timestamp. */
export function minuteOfWeekFromTimestamp(ts: string, weekStart: string): number {
  const base = moscowMidnightUtcMs(weekStart);
  const ms = parseTs(ts);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round((ms - base) / 60_000));
}
