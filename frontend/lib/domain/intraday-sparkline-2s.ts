import type { StockSparklineSeries } from "@/lib/domain/stock-sparkline";

export type IntradaySparkline2sPoint = {
  t: number;
  p: number;
};

export type IntradaySparkline2sResponse = {
  ticker: string;
  points: IntradaySparkline2sPoint[];
  prevClose: number | null;
  high: number;
  low: number;
  cachedAt: string;
};

/** Преобразовать hover API → формат tooltip sparkline. */
export function intradaySparkline2sToSeries(
  payload: IntradaySparkline2sResponse | undefined,
): StockSparklineSeries | null {
  if (!payload?.points?.length) return null;
  const sessionKeys = [
    ...new Set(
      payload.points.map((pt) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Moscow",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(pt.t)),
      ),
    ),
  ];

  return {
    secid: payload.ticker,
    status: "ok",
    source: "intraday",
    interval: 10,
    scope: "twoSessions",
    sessionKeys,
    candles: payload.points.map((pt) => ({
      time: new Date(pt.t).toISOString(),
      close: pt.p,
      sessionKey: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(pt.t)),
    })),
    candleCount: payload.points.length,
  };
}
