import type { AssetClass } from "@screenerpro/shared";

type Query = Record<string, string | number | undefined>;

function withQuery(path: string, query: Query) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return `${path}?${search.toString()}`;
}

export function listSecuritiesUrl(assetClass: AssetClass, start = 0) {
  const market = assetClass === "stock" ? "shares" : "forts";
  return withQuery(`/engines/stock/markets/${market}/securities.json`, {
    "iss.meta": "off",
    start,
  });
}

export function marketDataUrl(assetClass: AssetClass) {
  const market = assetClass === "stock" ? "shares" : "forts";
  return withQuery(`/engines/stock/markets/${market}/securities.json`, {
    "iss.meta": "off",
    "iss.only": "securities,marketdata",
  });
}

export function historyUrl(assetClass: AssetClass, secid: string, from?: string, till?: string, start = 0) {
  const market = assetClass === "stock" ? "shares" : "forts";
  return withQuery(`/history/engines/stock/markets/${market}/securities/${secid}.json`, {
    "iss.meta": "off",
    from,
    till,
    start,
  });
}

/** Свечи FORTS — дневные и интрадей (OHLC/close). */
export function futuresCandlesUrl(secid: string, from: string, till: string, interval = 24) {
  return withQuery(`/engines/futures/markets/forts/securities/${secid}/candles.json`, {
    "iss.meta": "off",
    from,
    till,
    interval,
  });
}

/** Доступные интервалы и границы свечей по инструменту. */
export function futuresCandleBordersUrl(secid: string) {
  return withQuery(`/engines/futures/markets/forts/securities/${secid}/candleborders.json`, {
    "iss.meta": "off",
  });
}
