import type { CurrencyInstrumentKey } from "@/lib/domain/cbr-currency-instrument";
import type { CbrFuturesAssetCode } from "@/lib/domain/cbr-rate-instrument-config";
import { getEventWindow } from "@/lib/domain/cbr-rate-event-window";
import { fetchMoexCandles, type MoexCandleInterval } from "@/lib/moex/fetch-moex-candles";
import {
  resolveCurrencyInstrument,
  resolveCurrencyInstrumentNearestFallback,
  type ResolvedCurrencyInstrument,
} from "@/lib/server/services/cbr-currency-instrument-resolver";
import { resolveNearestFuturesContract } from "@/lib/server/services/cbr-rate-futures-resolver";

export type CbrCandleInterval = 1 | 5 | 15 | 60;

export type CbrNormalizedCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  value?: number;
};

export type CbrCandlesDataStatus = "live" | "fallback" | "error";

export type CbrRateCandlesRequest = {
  ticker: string;
  engine: "stock" | "futures";
  market: string;
  board?: string;
  date: string;
  interval: CbrCandleInterval;
  assetCode?: CbrFuturesAssetCode;
  currencyKey?: CurrencyInstrumentKey;
  allowFallback?: boolean;
};

export type CbrRateCandlesResponse = {
  ticker: string;
  resolvedTicker: string;
  engine: string;
  market: string;
  board: string | null;
  date: string;
  interval: CbrCandleInterval;
  from: string;
  till: string;
  dataStatus: CbrCandlesDataStatus;
  source: "moex-iss" | "mock" | "none";
  candles: CbrNormalizedCandle[];
  error?: string;
  contractSource?: "iss" | "manual" | "direct";
  diagnostics?: string[];
  currencyResolvedType?: ResolvedCurrencyInstrument["resolvedType"];
  currencyDisplayLabel?: string;
};

function toFetcherInterval(interval: CbrCandleInterval): MoexCandleInterval | null {
  if (interval === 1 || interval === 5 || interval === 15) return interval;
  return null;
}

export async function fetchMoexCandlesForEvent(
  request: CbrRateCandlesRequest,
): Promise<CbrRateCandlesResponse> {
  const date = request.date.slice(0, 10);
  const window = getEventWindow(date);
  const diagnostics: string[] = [];

  let resolvedTicker = request.ticker.trim().toUpperCase();
  let contractSource: CbrRateCandlesResponse["contractSource"] = "direct";
  let currencyResolved: ResolvedCurrencyInstrument | null = null;

  if (request.currencyKey) {
    currencyResolved = await resolveCurrencyInstrument(request.currencyKey, date);
    diagnostics.push(...currencyResolved.diagnostics);
    if (currencyResolved.secid === "—") {
      return buildNoDataResponse(request, date, window, diagnostics, currencyResolved);
    }
    resolvedTicker = currencyResolved.secid;
    contractSource = currencyResolved.source === "manual" ? "manual" : "iss";
  } else if (request.engine === "futures") {
    const asset = request.assetCode ?? inferFuturesAssetFromTicker(resolvedTicker);
    if (asset) {
      const resolved = await resolveNearestFuturesContract(asset, date);
      diagnostics.push(...resolved.diagnostics);
      if (resolved.secid === "—") {
        return buildErrorResponse(request, date, resolved.diagnostics.join("; "));
      }
      resolvedTicker = resolved.secid;
      contractSource = resolved.source === "manual" ? "manual" : "iss";
    }
  }

  const fetchInterval = toFetcherInterval(request.interval);
  if (!fetchInterval) {
    diagnostics.push(`Interval ${request.interval} не поддерживается fetchMoexCandles (1/5/15)`);
    return buildErrorResponse(request, date, diagnostics.join("; "));
  }

  const live = await tryFetchCandles(
    request,
    resolvedTicker,
    date,
    fetchInterval,
    window,
    diagnostics,
  );
  if (live) {
    return {
      ...live,
      contractSource,
      diagnostics: diagnostics.length ? diagnostics : undefined,
      currencyResolvedType: currencyResolved?.resolvedType,
      currencyDisplayLabel: currencyResolved?.displayLabel,
    };
  }

  if (request.currencyKey && currencyResolved?.resolvedType === "perpetual_futures") {
    const fallback = await resolveCurrencyInstrumentNearestFallback(request.currencyKey, date);
    diagnostics.push(...fallback.diagnostics);
    if (fallback.secid !== "—") {
      resolvedTicker = fallback.secid;
      currencyResolved = fallback;
      contractSource = fallback.source === "manual" ? "manual" : "iss";
      const retry = await tryFetchCandles(
        request,
        resolvedTicker,
        date,
        fetchInterval,
        window,
        diagnostics,
      );
      if (retry) {
        return {
          ...retry,
          contractSource,
          diagnostics,
          currencyResolvedType: currencyResolved.resolvedType,
          currencyDisplayLabel: currencyResolved.displayLabel,
        };
      }
    }
  }

  if (request.currencyKey) {
    return buildNoDataResponse(request, date, window, diagnostics, currencyResolved);
  }

  return {
    ticker: request.ticker,
    resolvedTicker,
    engine: request.engine,
    market: request.market,
    board: request.board ?? null,
    date,
    interval: request.interval,
    from: window.startMsk,
    till: window.endMsk,
    dataStatus: "error",
    source: "none",
    candles: [],
    error: diagnostics.at(-1) ?? "MOEX ISS вернул 0 свечей в окне 10:00–19:00 MSK",
    contractSource,
    diagnostics,
    currencyResolvedType: currencyResolved?.resolvedType,
    currencyDisplayLabel: currencyResolved?.displayLabel,
  };
}

async function tryFetchCandles(
  request: CbrRateCandlesRequest,
  resolvedTicker: string,
  date: string,
  interval: MoexCandleInterval,
  window: ReturnType<typeof getEventWindow>,
  diagnostics: string[],
): Promise<Omit<CbrRateCandlesResponse, "contractSource" | "currencyResolvedType" | "currencyDisplayLabel"> | null> {
  const fetched = await fetchMoexCandles({
    engine: request.engine,
    market: request.market,
    board: request.board,
    security: resolvedTicker,
    date,
    interval,
  });

  if (fetched.sourceUrl) {
    diagnostics.push(`ISS: ${fetched.sourceUrl}`);
  }
  if (fetched.errorMessage) {
    diagnostics.push(fetched.errorMessage);
  }

  if (fetched.status !== "moex" || !fetched.candles.length) {
    return null;
  }

  return {
    ticker: request.ticker,
    resolvedTicker,
    engine: request.engine,
    market: request.market,
    board: request.board ?? null,
    date,
    interval: request.interval,
    from: window.startMsk,
    till: window.endMsk,
    dataStatus: "live",
    source: "moex-iss",
    candles: fetched.candles,
    diagnostics: diagnostics.length ? diagnostics : undefined,
  };
}

function buildNoDataResponse(
  request: CbrRateCandlesRequest,
  date: string,
  window: ReturnType<typeof getEventWindow>,
  diagnostics: string[],
  currencyResolved: ResolvedCurrencyInstrument | null,
): CbrRateCandlesResponse {
  return {
    ticker: request.ticker,
    resolvedTicker: currencyResolved?.secid ?? request.ticker,
    engine: request.engine,
    market: request.market,
    board: request.board ?? null,
    date,
    interval: request.interval,
    from: window.startMsk,
    till: window.endMsk,
    dataStatus: "error",
    source: "none",
    candles: [],
    error: diagnostics.at(-1) ?? "Нет MOEX-свечей по валютному инструменту на дату заседания",
    diagnostics,
    currencyResolvedType: currencyResolved?.resolvedType ?? "unresolved",
    currencyDisplayLabel: currencyResolved?.displayLabel ?? "нет данных MOEX",
  };
}

function inferFuturesAssetFromTicker(ticker: string): CbrFuturesAssetCode | undefined {
  const t = ticker.toUpperCase();
  if (t === "SI" || t.startsWith("SI")) return "Si";
  if (t === "CNY" || t.startsWith("CR")) return "CNY";
  if (t === "MX" || t.startsWith("MX")) return "MX";
  if (t === "MXI" || t.startsWith("MXI")) return "MXI";
  return undefined;
}

function buildErrorResponse(
  request: CbrRateCandlesRequest,
  date: string,
  error: string,
): CbrRateCandlesResponse {
  const window = getEventWindow(date);
  return {
    ticker: request.ticker,
    resolvedTicker: request.ticker,
    engine: request.engine,
    market: request.market,
    board: request.board ?? null,
    date,
    interval: request.interval,
    from: window.startMsk,
    till: window.endMsk,
    dataStatus: "error",
    source: "none",
    candles: [],
    error,
  };
}
