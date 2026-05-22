import {
  CURRENCY_FAMILY_META,
  pickActiveContractForFamily,
  resolveCurrencyFamily,
  type CurrencyCorrelationFamily,
} from "@/lib/domain/currency-correlation";
import type {
  IntradayCurrencyInstrument,
  IntradayCurrencyResponse,
} from "@/lib/domain/currency-correlation-intraday";
import { fetchFuturesIntradayCandles } from "@/lib/server/services/moex-futures-candles";
import { getScreenerResponse } from "@/lib/server/services/moex-screener";

const VALID_FAMILIES: CurrencyCorrelationFamily[] = ["SI", "CNY", "ED"];

function formatInstrument(
  family: CurrencyCorrelationFamily,
  ticker: string,
  fetched: Awaited<ReturnType<typeof fetchFuturesIntradayCandles>>,
): IntradayCurrencyInstrument {
  const meta = CURRENCY_FAMILY_META[family];
  return {
    family,
    ticker,
    label: meta.label,
    points: fetched.points,
    status: fetched.status,
    error: fetched.error,
  };
}

async function fetchFamilyIntraday(
  ticker: string,
  family: CurrencyCorrelationFamily,
  days: number,
  interval: number,
): Promise<{ instrument: IntradayCurrencyInstrument; requestedInterval: number; usedInterval: number; intervalNotice?: string }> {
  const fetched = await fetchFuturesIntradayCandles(ticker, days, interval);
  return {
    instrument: formatInstrument(family, ticker, fetched),
    requestedInterval: fetched.requestedInterval,
    usedInterval: fetched.usedInterval,
    intervalNotice: fetched.intervalNotice,
  };
}

export async function buildCurrencyIntradayResponse(options: {
  days: number;
  interval: number;
  tickers?: string[];
  coverageSelect?: boolean;
}): Promise<IntradayCurrencyResponse> {
  const { days, interval: requestedInterval } = options;
  let instruments: IntradayCurrencyInstrument[] = [];
  let usedInterval = requestedInterval;
  let intervalNotice: string | undefined;

  if (options.coverageSelect !== false) {
    const screener = await getScreenerResponse("future");
    const rows = screener.rows ?? [];
    const results = await Promise.all(
      VALID_FAMILIES.map(async (family) => {
        const active = pickActiveContractForFamily(rows, family);
        if (!active?.ticker || active.ticker === "—") {
          return {
            instrument: {
              family,
              ticker: "—",
              label: CURRENCY_FAMILY_META[family].label,
              points: [],
              status: "empty" as const,
              error: CURRENCY_FAMILY_META[family].emptyHint,
            },
            requestedInterval,
            usedInterval: requestedInterval,
          };
        }
        return fetchFamilyIntraday(active.ticker, family, days, requestedInterval);
      }),
    );

    instruments = results.map((r) => r.instrument);
    usedInterval = results.find((r) => r.instrument.points.length)?.usedInterval ?? requestedInterval;
    intervalNotice = results.map((r) => r.intervalNotice).find(Boolean);
  } else {
    const tickers = options.tickers ?? [];
    const byFamily = new Map<CurrencyCorrelationFamily, IntradayCurrencyInstrument>();

    const results = await Promise.all(
      tickers.map(async (ticker) => {
        const family = resolveCurrencyFamily(ticker);
        if (!family || !VALID_FAMILIES.includes(family)) return null;
        const fetched = await fetchFuturesIntradayCandles(ticker, days, requestedInterval);
        usedInterval = fetched.usedInterval;
        if (fetched.intervalNotice) intervalNotice = fetched.intervalNotice;
        return formatInstrument(family, ticker, fetched);
      }),
    );

    for (const inst of results) {
      if (!inst) continue;
      const existing = byFamily.get(inst.family);
      if (!existing || inst.points.length > existing.points.length) {
        byFamily.set(inst.family, inst);
      }
    }

    instruments = VALID_FAMILIES.map((family) => {
      const hit = byFamily.get(family);
      if (hit) return hit;
      return {
        family,
        ticker: "—",
        label: CURRENCY_FAMILY_META[family].label,
        points: [],
        status: "empty" as const,
        error: CURRENCY_FAMILY_META[family].emptyHint,
      };
    });
  }

  return {
    source: "MOEX ISS",
    updatedAt: new Date().toISOString(),
    requestedInterval,
    usedInterval,
    intervalNotice,
    days,
    instruments,
  };
}
