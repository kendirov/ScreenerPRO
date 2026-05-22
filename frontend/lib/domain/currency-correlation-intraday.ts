import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import { CURRENCY_PAIR_CONFIGS } from "@/lib/domain/currency-pair-config";
import { alignIntradayByTimestamp, findSpreadEvents } from "@/lib/domain/currency-intraday-series";

export type IntradayCandlePoint = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  value?: number | null;
};

export type IntradayInstrumentStatus = "ok" | "empty" | "error";

export type IntradayCurrencyInstrument = {
  family: CurrencyCorrelationFamily;
  ticker: string;
  label: string;
  points: IntradayCandlePoint[];
  status: IntradayInstrumentStatus;
  error?: string;
};

export type IntradayCurrencyResponse = {
  source: "MOEX ISS";
  updatedAt: string;
  requestedInterval: number;
  usedInterval: number;
  intervalNotice?: string;
  days: number;
  instruments: IntradayCurrencyInstrument[];
};

export const INTRADAY_INTERVAL_OPTIONS = [1, 5, 10, 15, 60] as const;
export type IntradayIntervalOption = (typeof INTRADAY_INTERVAL_OPTIONS)[number];
export const DEFAULT_INTRADAY_INTERVAL: IntradayIntervalOption = 5;

export const INTRADAY_DAY_OPTIONS = [1, 2, 5] as const;
export type IntradayDayOption = (typeof INTRADAY_DAY_OPTIONS)[number];
export const DEFAULT_INTRADAY_DAYS: IntradayDayOption = 2;

/** Минимум общих свечей для статуса «готово». */
export const MIN_INTRADAY_COMMON_POINTS = 5;

export type IntradayDiagnosticsStatus = "готово" | "мало точек" | "нет интрадей-свечей";

export type InstrumentDiagnosticsDetail = {
  family: CurrencyCorrelationFamily;
  ticker: string;
  pointCount: number;
  status: IntradayInstrumentStatus;
  error?: string;
  firstPrice: number | null;
  lastPrice: number | null;
  lastTimestamp: string | null;
  statusMessage: string;
};

export type IntradayLabDiagnostics = {
  status: IntradayDiagnosticsStatus;
  requestedInterval: number;
  usedInterval: number;
  intervalNotice?: string;
  pointsSi: number;
  pointsCny: number;
  pointsEd: number;
  commonTimestamps: number;
  tickers: Record<CurrencyCorrelationFamily, string>;
  spreadEventsCount: number;
  instruments: Record<CurrencyCorrelationFamily, InstrumentDiagnosticsDetail>;
  edSummary: string;
};

export function buildIntradayLabDiagnostics(
  response: IntradayCurrencyResponse,
): IntradayLabDiagnostics {
  const byFamily = Object.fromEntries(
    response.instruments.map((i) => [i.family, i]),
  ) as Record<CurrencyCorrelationFamily, IntradayCurrencyInstrument | undefined>;

  const pointsSi = byFamily.SI?.points.length ?? 0;
  const pointsCny = byFamily.CNY?.points.length ?? 0;
  const pointsEd = byFamily.ED?.points.length ?? 0;

  const series: Record<string, IntradayCandlePoint[]> = {};
  for (const inst of response.instruments) {
    if (inst.status === "ok" && inst.points.length) {
      series[inst.family] = inst.points;
    }
  }

  const aligned = alignIntradayByTimestamp(series, response.usedInterval);
  const commonTimestamps = aligned.length;

  let spreadEventsCount = 0;
  for (const config of CURRENCY_PAIR_CONFIGS) {
    if (series[config.leftInstrument] && series[config.rightInstrument]) {
      spreadEventsCount += findSpreadEvents(aligned, config.pairKey).length;
    }
  }

  const instrumentDetails = (["SI", "CNY", "ED"] as const).map((family) => {
    const inst = byFamily[family];
    const points = inst?.points ?? [];
    const first = points[0];
    const last = points[points.length - 1];
    let statusMessage = "данные есть";
    if (!inst || inst.status === "error") {
      statusMessage = inst?.error ?? "ошибка ISS / контракт не найден";
    } else if (inst.status === "empty" || points.length === 0) {
      statusMessage = "нет данных";
    } else if (points.length < 2) {
      statusMessage = "мало точек (<2)";
    }
    return {
      family,
      ticker: inst?.ticker ?? "—",
      pointCount: points.length,
      status: inst?.status ?? "empty",
      error: inst?.error,
      firstPrice: first?.close ?? null,
      lastPrice: last?.close ?? null,
      lastTimestamp: last?.timestamp ?? null,
      statusMessage,
    } satisfies InstrumentDiagnosticsDetail;
  });

  const edDetail = instrumentDetails.find((d) => d.family === "ED")!;
  const edSummary =
    edDetail.pointCount < 2
      ? `ED: ${edDetail.statusMessage} · ${edDetail.ticker}`
      : `ED: ${edDetail.pointCount} точек · ${edDetail.ticker} · ${edDetail.firstPrice} → ${edDetail.lastPrice}`;

  const anyPoints = pointsSi + pointsCny + pointsEd > 0;
  let status: IntradayDiagnosticsStatus = "готово";
  if (!anyPoints) status = "нет интрадей-свечей";
  else if (commonTimestamps < MIN_INTRADAY_COMMON_POINTS) status = "мало точек";

  return {
    status,
    requestedInterval: response.requestedInterval,
    usedInterval: response.usedInterval,
    intervalNotice: response.intervalNotice,
    pointsSi,
    pointsCny,
    pointsEd,
    commonTimestamps,
    tickers: {
      SI: byFamily.SI?.ticker ?? "—",
      CNY: byFamily.CNY?.ticker ?? "—",
      ED: byFamily.ED?.ticker ?? "—",
    },
    spreadEventsCount,
    instruments: Object.fromEntries(
      instrumentDetails.map((d) => [d.family, d]),
    ) as Record<CurrencyCorrelationFamily, InstrumentDiagnosticsDetail>,
    edSummary,
  };
}
