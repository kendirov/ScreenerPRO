import type { StrategyCandle } from "@/lib/screener/strategies/strategy-candles";

export type SessionPreset = "moex_stocks" | "extended_msk" | "utc_day";

export type SessionBox = {
  id: string;
  date: string;
  startTime: number;
  endTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  rangeAbs: number;
  rangePct: number;
  candleStartIndex: number;
  candleEndIndex: number;
};

type SessionBounds = {
  date: string;
  timezone: "Europe/Moscow" | "UTC";
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

function toUnixSeconds(value: number | string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Math.floor(new Date(value).getTime() / 1000);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getDateParts(
  unixSeconds: number | string,
  timeZone: "Europe/Moscow" | "UTC",
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const seconds = toUnixSeconds(unixSeconds);
  if (seconds == null) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(seconds * 1000));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return { year, month, day, hour, minute };
}

function sessionDateKey(
  unixSeconds: number | string,
  timeZone: "Europe/Moscow" | "UTC",
): string | null {
  const parts = getDateParts(unixSeconds, timeZone);
  if (!parts) return null;
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function sessionMinuteOfDay(
  unixSeconds: number | string,
  timeZone: "Europe/Moscow" | "UTC",
): number | null {
  const parts = getDateParts(unixSeconds, timeZone);
  if (!parts) return null;
  return parts.hour * 60 + parts.minute;
}

function mskDateTimeToUnix(date: string, hh: number, mm: number): number {
  const iso = `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+03:00`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

function utcDateTimeToUnix(date: string, hh: number, mm: number): number {
  const iso = `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

function sessionBoundsFor(date: string, preset: SessionPreset): SessionBounds {
  if (preset === "moex_stocks") {
    return {
      date,
      timezone: "Europe/Moscow",
      startHour: 9,
      startMinute: 50,
      endHour: 18,
      endMinute: 50,
    };
  }
  if (preset === "extended_msk") {
    return {
      date,
      timezone: "Europe/Moscow",
      startHour: 7,
      startMinute: 0,
      endHour: 23,
      endMinute: 50,
    };
  }
  return {
    date,
    timezone: "UTC",
    startHour: 0,
    startMinute: 0,
    endHour: 23,
    endMinute: 59,
  };
}

function sessionWindowUnix(bounds: SessionBounds): { startTime: number; endTime: number } {
  if (bounds.timezone === "UTC") {
    return {
      startTime: utcDateTimeToUnix(bounds.date, bounds.startHour, bounds.startMinute),
      endTime: utcDateTimeToUnix(bounds.date, bounds.endHour, bounds.endMinute),
    };
  }
  return {
    startTime: mskDateTimeToUnix(bounds.date, bounds.startHour, bounds.startMinute),
    endTime: mskDateTimeToUnix(bounds.date, bounds.endHour, bounds.endMinute),
  };
}

function candleBelongsToPreset(candle: StrategyCandle, preset: SessionPreset): boolean {
  const bounds = sessionBoundsFor(
    sessionDateKey(candle.time, preset === "utc_day" ? "UTC" : "Europe/Moscow") ?? "",
    preset,
  );
  if (!bounds.date) return false;
  const minuteOfDay = sessionMinuteOfDay(candle.time, bounds.timezone);
  if (minuteOfDay == null) return false;
  const startMinute = bounds.startHour * 60 + bounds.startMinute;
  const endMinute = bounds.endHour * 60 + bounds.endMinute;
  return minuteOfDay >= startMinute && minuteOfDay <= endMinute;
}

export function computeSessionBoxes(
  candles: StrategyCandle[],
  preset: SessionPreset,
): SessionBox[] {
  if (candles.length === 0) return [];

  const boxes: SessionBox[] = [];
  let active:
    | (Omit<SessionBox, "id" | "rangeAbs" | "rangePct"> & {
        rangeAbs: number;
        rangePct: number;
      })
    | null = null;
  let activeDate: string | null = null;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const candleTime = toUnixSeconds(candle.time);
    if (
      ![candleTime, candle.open, candle.high, candle.low, candle.close].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    ) {
      continue;
    }

    if (!candleBelongsToPreset({ ...candle, time: candleTime! }, preset)) continue;

    const timeZone = preset === "utc_day" ? "UTC" : "Europe/Moscow";
    const date = sessionDateKey(candleTime!, timeZone);
    if (!date) continue;

    const bounds = sessionBoundsFor(date, preset);
    const { startTime, endTime } = sessionWindowUnix(bounds);

    if (!active || activeDate !== date) {
      if (active) {
        active.rangeAbs = active.high - active.low;
        active.rangePct = active.open > 0 ? (active.rangeAbs / active.open) * 100 : 0;
        boxes.push({
          ...active,
          id: `${preset}-${active.date}`,
        });
      }
      activeDate = date;
      active = {
        date,
        startTime,
        endTime,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        rangeAbs: 0,
        rangePct: 0,
        candleStartIndex: index,
        candleEndIndex: index,
      };
      continue;
    }

    active.high = Math.max(active.high, candle.high);
    active.low = Math.min(active.low, candle.low);
    active.close = candle.close;
    active.candleEndIndex = index;
  }

  if (active) {
    active.rangeAbs = active.high - active.low;
    active.rangePct = active.open > 0 ? (active.rangeAbs / active.open) * 100 : 0;
    boxes.push({
      ...active,
      id: `${preset}-${active.date}`,
    });
  }

  return boxes.filter(
    (box) =>
      Number.isFinite(box.open) &&
      Number.isFinite(box.high) &&
      Number.isFinite(box.low) &&
      Number.isFinite(box.close) &&
      Number.isFinite(box.rangeAbs) &&
      Number.isFinite(box.rangePct) &&
      box.high >= box.low,
  );
}
