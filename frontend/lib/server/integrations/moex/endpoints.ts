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

/** Дневная история индексов MOEX (IMOEX, RTSI, …). */
export function indexHistoryUrl(secid: string, from?: string, till?: string, start = 0) {
  return withQuery(`/history/engines/stock/markets/index/securities/${secid}.json`, {
    "iss.meta": "off",
    from,
    till,
    start,
  });
}

/** Свечи FORTS — дневные и интрадей (OHLC/close). `start` — пагинация ISS (500 строк/страница). */
export function futuresCandlesUrl(
  secid: string,
  from: string,
  till: string,
  interval = 24,
  start = 0,
) {
  return withQuery(`/engines/futures/markets/forts/securities/${secid}/candles.json`, {
    "iss.meta": "off",
    from,
    till,
    interval,
    start,
  });
}

/** Доступные интервалы и границы свечей по инструменту. */
export function futuresCandleBordersUrl(secid: string) {
  return withQuery(`/engines/futures/markets/forts/securities/${secid}/candleborders.json`, {
    "iss.meta": "off",
  });
}

/** История всех бумаг TQBR за торговый день (MOEX ISS bulk). */
export function stockBoardHistoryByDateUrl(board: string, date: string, start = 0, limit = 100) {
  return withQuery(`/history/engines/stock/markets/shares/boards/${board}/securities.json`, {
    "iss.meta": "off",
    "iss.only": "history",
    date,
    "history.start": start,
    "history.limit": limit,
  });
}

/** Интрадей-свечи акций TQBR. */
export function stockCandlesUrl(secid: string, from: string, till: string, interval = 10) {
  return withQuery(`/engines/stock/markets/shares/boards/TQBR/securities/${secid}/candles.json`, {
    "iss.meta": "off",
    from,
    till,
    interval,
  });
}

/** Интрадей-свечи индексов MOEX (IMOEX, RTSI, …). */
export function indexCandlesUrl(secid: string, from: string, till: string, interval = 10) {
  return withQuery(`/engines/stock/markets/index/securities/${secid}/candles.json`, {
    "iss.meta": "off",
    from,
    till,
    interval,
  });
}

/** Универсальный candles endpoint (engine / market / optional board). */
export function moexCandlesUrl(params: {
  engine: string;
  market: string;
  secid: string;
  board?: string;
  from: string;
  till: string;
  interval: number;
  start?: number;
}) {
  const path = params.board
    ? `/engines/${params.engine}/markets/${params.market}/boards/${params.board}/securities/${params.secid}/candles.json`
    : `/engines/${params.engine}/markets/${params.market}/securities/${params.secid}/candles.json`;
  return withQuery(path, {
    "iss.meta": "off",
    from: params.from,
    till: params.till,
    interval: params.interval,
    start: params.start,
  });
}
