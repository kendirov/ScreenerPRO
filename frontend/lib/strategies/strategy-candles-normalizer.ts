export type StrategyCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  begin?: string;
};

export type StrategyCandlesDiagnostics = {
  rawCount: number;
  normalizedCount: number;
  invalidCount: number;
  duplicateTimeCount: number;
  firstTime?: number;
  lastTime?: number;
  firstBegin?: string;
  lastBegin?: string;
  fetch?: {
    periodId?: string;
    from?: string;
    till?: string;
    board?: string;
    daysLoaded?: number;
    fetchRequestCount?: number;
    capped?: boolean;
  };
};

type RawCandleRecord = Record<string, unknown>;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Parse MOEX-style naive Moscow datetime to UNIX seconds. */
export function parseStrategyCandleBegin(begin: string): number | null {
  const trimmed = begin.trim();
  const mskMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (mskMatch) {
    const [, day, hh, mm, ss = "00"] = mskMatch;
    const iso = `${day}T${hh}:${mm}:${ss}+03:00`;
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  const isoLike = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(isoLike) ? isoLike : `${isoLike}+03:00`;
  const ms = new Date(withTz).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function resolveRawTime(record: RawCandleRecord): { time: number; begin?: string } | null {
  const beginRaw = record.begin;
  if (typeof beginRaw === "string" && beginRaw.trim()) {
    const time = parseStrategyCandleBegin(beginRaw);
    return time != null ? { time, begin: beginRaw.trim() } : null;
  }

  const timeRaw = record.time;
  if (typeof timeRaw === "number" && Number.isFinite(timeRaw)) {
    const begin = typeof record.begin === "string" ? record.begin : undefined;
    return { time: Math.floor(timeRaw), begin };
  }

  if (typeof timeRaw === "string" && timeRaw.trim()) {
    const time = parseStrategyCandleBegin(timeRaw);
    return time != null ? { time, begin: timeRaw.trim() } : null;
  }

  return null;
}

function isValidOhlc(open: number, high: number, low: number, close: number): boolean {
  if (![open, high, low, close].every(Number.isFinite)) return false;
  if (high < low) return false;
  if (high < open || high < close) return false;
  if (low > open || low > close) return false;
  return true;
}

function squashDuplicateTimes(candles: StrategyCandle[]): {
  candles: StrategyCandle[];
  duplicateTimeCount: number;
} {
  if (candles.length === 0) return { candles, duplicateTimeCount: 0 };

  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const squashed: StrategyCandle[] = [];
  let duplicateTimeCount = 0;

  for (const candle of sorted) {
    const last = squashed[squashed.length - 1];
    if (last && last.time === candle.time) {
      duplicateTimeCount += 1;
      squashed[squashed.length - 1] = candle;
      continue;
    }
    squashed.push(candle);
  }

  return { candles: squashed, duplicateTimeCount };
}

export function normalizeStrategyCandles(raw: unknown[]): {
  candles: StrategyCandle[];
  diagnostics: StrategyCandlesDiagnostics;
} {
  const rawCount = raw.length;
  let invalidCount = 0;
  const parsed: StrategyCandle[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      invalidCount += 1;
      continue;
    }

    const record = item as RawCandleRecord;
    const resolvedTime = resolveRawTime(record);
    const open = toFiniteNumber(record.open);
    const high = toFiniteNumber(record.high);
    const low = toFiniteNumber(record.low);
    const close = toFiniteNumber(record.close);

    if (
      resolvedTime == null ||
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      !isValidOhlc(open, high, low, close)
    ) {
      invalidCount += 1;
      continue;
    }

    const volume = toFiniteNumber(record.volume);
    parsed.push({
      time: resolvedTime.time,
      open,
      high,
      low,
      close,
      ...(volume != null && volume >= 0 ? { volume } : {}),
      ...(resolvedTime.begin ? { begin: resolvedTime.begin } : {}),
    });
  }

  const { candles, duplicateTimeCount } = squashDuplicateTimes(parsed);
  const first = candles[0];
  const last = candles[candles.length - 1];

  return {
    candles,
    diagnostics: {
      rawCount,
      normalizedCount: candles.length,
      invalidCount,
      duplicateTimeCount,
      firstTime: first?.time,
      lastTime: last?.time,
      firstBegin: first?.begin,
      lastBegin: last?.begin,
    },
  };
}

export function formatStrategyCandleTimeMsk(unixSeconds: number): string {
  if (!Number.isFinite(unixSeconds)) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}
