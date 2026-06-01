/** Торговый календарь (Europe/Moscow). Без MOEX holiday API — праздники проверяются на сервере по наличию history. */

export const MOSCOW_TZ = "Europe/Moscow";

export const TRADING_DATE_MESSAGES = {
  noData: "Нет данных за выбранную дату",
  nearestDay: "Ближайший торговый день",
  historyBadge: "HIST",
  liveBadge: "LIVE",
  sessionLive: "LIVE-сессия",
  sessionHistorical: "Исторический день",
  sessionNoData: "Нет данных",
  weekend: "Выходной",
  weekendNoTrade: "Выходной · торгов нет",
  updatedPrefix: "Обновлено",
} as const;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(value: string | null | undefined): value is string {
  if (!value || !DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

/** YYYY-MM-DD — «сегодня» по Москве. */
export function moscowTodayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isLiveTradingDate(dateKey: string, now = new Date()): boolean {
  return dateKey === moscowTodayKey(now);
}

export function parseDateKeyUtcMs(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function formatDateKeyFromUtcMs(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isWeekendDateKey(dateKey: string): boolean {
  const dow = new Date(parseDateKeyUtcMs(dateKey)).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Сдвиг календарных дней (UTC date math). */
export function shiftCalendarDaysKey(dateKey: string, deltaDays: number): string {
  return formatDateKeyFromUtcMs(parseDateKeyUtcMs(dateKey) + deltaDays * 86_400_000);
}

/**
 * Предыдущий торговый день (клиент): отступаем назад, пропуская сб/вс.
 * Праздники MOEX — на сервере при загрузке history.
 */
export function getPreviousTradingDayKey(fromDateKey = moscowTodayKey()): string {
  let cursor = shiftCalendarDaysKey(fromDateKey, -1);
  for (let i = 0; i < 8; i++) {
    if (!isWeekendDateKey(cursor)) return cursor;
    cursor = shiftCalendarDaysKey(cursor, -1);
  }
  return cursor;
}

export function formatTradingDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dt);
}

export function normalizeRequestedDateKey(raw: string | null | undefined, now = new Date()): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (!isValidDateKey(value)) return null;
  if (value > moscowTodayKey(now)) return null;
  return value;
}

export type TradingSessionModeLabel = "live" | "historical" | "noData";

export function resolveTradingSessionModeLabel(input: {
  isLive: boolean;
  dataEmpty?: boolean;
  isLoading?: boolean;
  selectedDateKey: string;
}): { key: TradingSessionModeLabel; label: string } {
  const isWeekend = isWeekendDateKey(input.selectedDateKey);

  if (input.isLoading) {
    if (input.isLive) return { key: "live", label: TRADING_DATE_MESSAGES.sessionLive };
    return { key: "historical", label: TRADING_DATE_MESSAGES.sessionHistorical };
  }

  if (input.dataEmpty) {
    if (isWeekend && !input.isLive) {
      return { key: "noData", label: TRADING_DATE_MESSAGES.weekendNoTrade };
    }
    return { key: "noData", label: TRADING_DATE_MESSAGES.sessionNoData };
  }

  if (input.isLive) {
    return { key: "live", label: TRADING_DATE_MESSAGES.sessionLive };
  }

  return { key: "historical", label: TRADING_DATE_MESSAGES.sessionHistorical };
}

/** «Обновлено: 14:38 МСК» из ISO или HH:MM(:SS). */
export function formatMoscowUpdatedLabel(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  let hours: number | null = null;
  let minutes: number | null = null;

  if (raw.includes("T")) {
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("ru-RU", {
      timeZone: MOSCOW_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    hours = Number(parts.find((p) => p.type === "hour")?.value);
    minutes = Number(parts.find((p) => p.type === "minute")?.value);
  } else {
    const match = raw.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    hours = Number(match[1]);
    minutes = Number(match[2]);
  }

  if (hours == null || minutes == null || !Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${TRADING_DATE_MESSAGES.updatedPrefix}: ${hh}:${mm} МСК`;
}

export function formatCompactDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}
