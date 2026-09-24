import type { IntradayCandlePoint } from "@/lib/domain/currency-correlation-intraday";
import type { FuturesActivityResponse, FuturesActivitySeries } from "@/lib/domain/trading-futures";
import { fetchFuturesIntradayCandles } from "@/lib/server/services/moex-futures-candles";

const LOOKBACK_DAYS = 9;
const MAX_POINTS = 48;

type MoscowPoint = IntradayCandlePoint & { dateKey: string; minute: number; timeLabel: string };

function moscowParts(timestamp: string): { dateKey: string; minute: number; timeLabel: string } | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  return { dateKey, minute: hour * 60 + minute, timeLabel: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

function downsample<T>(values: T[], max = MAX_POINTS): T[] {
  if (values.length <= max) return values;
  const result: T[] = [];
  const step = values.length / max;
  for (let index = 0; index < max; index += 1) {
    result.push(values[Math.min(values.length - 1, Math.floor(index * step))]!);
  }
  return result;
}

function summarize(secid: string, points: IntradayCandlePoint[], usedInterval: number): FuturesActivitySeries {
  const normalized: MoscowPoint[] = points.flatMap((point) => {
    const parts = moscowParts(point.timestamp);
    return parts ? [{ ...point, ...parts }] : [];
  }).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const dateKeys = [...new Set(normalized.map((point) => point.dateKey))];
  const currentDate = dateKeys.at(-1);
  if (!currentDate) {
    return { secid, status: "no-data", usedInterval, sameTimeVolumeRatio: null, baselineSessions: 0, timeMsk: null, currentVolume: null, currentPath: [] };
  }

  const current = normalized.filter((point) => point.dateKey === currentDate);
  const last = current.at(-1);
  const first = current[0];
  if (!last || !first || !Number.isFinite(first.close) || first.close === 0) {
    return { secid, status: "no-data", usedInterval, sameTimeVolumeRatio: null, baselineSessions: 0, timeMsk: null, currentVolume: null, currentPath: [] };
  }

  const currentVolume = current.reduce((sum, point) => sum + (Number.isFinite(point.volume ?? NaN) ? point.volume ?? 0 : 0), 0);
  const previousTotals = dateKeys.slice(0, -1).map((dateKey) => normalized
    .filter((point) => point.dateKey === dateKey && point.minute <= last.minute)
    .reduce((sum, point) => sum + (Number.isFinite(point.volume ?? NaN) ? point.volume ?? 0 : 0), 0))
    .filter((value) => value > 0)
    .slice(-5);
  const baseline = previousTotals.length >= 3
    ? previousTotals.reduce((sum, value) => sum + value, 0) / previousTotals.length
    : null;
  const ratio = baseline && baseline > 0 && currentVolume > 0 ? currentVolume / baseline : null;
  const currentPath = downsample(current).map((point) => ({
    time: point.timeLabel,
    value: ((point.close - first.close) / first.close) * 100,
  }));

  return {
    secid,
    status: "ok",
    usedInterval,
    sameTimeVolumeRatio: ratio,
    baselineSessions: previousTotals.length,
    timeMsk: last.timeLabel,
    currentVolume: currentVolume || null,
    currentPath,
  };
}

async function buildOne(secid: string): Promise<FuturesActivitySeries> {
  try {
    const fetched = await fetchFuturesIntradayCandles(secid, LOOKBACK_DAYS, 10);
    if (fetched.status !== "ok" || !fetched.points.length) {
      return {
        secid,
        status: fetched.status === "error" ? "error" : "no-data",
        usedInterval: fetched.usedInterval,
        sameTimeVolumeRatio: null,
        baselineSessions: 0,
        timeMsk: null,
        currentVolume: null,
        currentPath: [],
        error: fetched.error,
      };
    }
    return summarize(secid, fetched.points, fetched.usedInterval);
  } catch (error) {
    return {
      secid,
      status: "error",
      usedInterval: 10,
      sameTimeVolumeRatio: null,
      baselineSessions: 0,
      timeMsk: null,
      currentVolume: null,
      currentPath: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function buildTradingFuturesActivity(secids: string[]): Promise<FuturesActivityResponse> {
  const unique = [...new Set(secids.map((secid) => secid.trim().toUpperCase()).filter(Boolean))].slice(0, 12);
  const series = await Promise.all(unique.map(buildOne));
  return { fetchedAt: new Date().toISOString(), source: "MOEX ISS", series };
}
