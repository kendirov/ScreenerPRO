import { CURRENCY_FAMILY_META, pickActiveContractForFamily } from "@/lib/domain/currency-correlation";
import type { ResolvedFuturesContract } from "@/lib/domain/futures-contract-resolver";
import { resolveQuadHedgeCandleDateRange } from "@/lib/domain/quad-hedge/candle-fetch";
import type { QuadHedgePipelineDebug, QuadHedgeLegDebug } from "@/lib/domain/quad-hedge/debug";
import { buildPipelineSummary } from "@/lib/domain/quad-hedge/debug";
import type { QuadHedgeIntradayResponse } from "@/lib/domain/quad-hedge/analytics";
import type { SpreadLabHistoryDepth, SpreadLabHistoryMode } from "@/lib/domain/quad-hedge/spread-lab-config";
import type { QuadHedgeLegId } from "@/lib/domain/quad-hedge/types";
import type { QuadHedgeWindowScope } from "@/lib/domain/quad-hedge/window";
import { resolveQuadHedgePrimaryContracts } from "@/lib/server/services/futures-contract-resolver";
import {
  fetchFuturesIntradayCandles,
  spreadLabMaxHistoryRequestedRange,
  type FetchFuturesIntradayResult,
} from "@/lib/server/services/moex-futures-candles";
import { getScreenerResponse } from "@/lib/server/services/moex-screener";

function legToBase(legId: QuadHedgeLegId): "SI" | "EU" | "CN" | null {
  if (legId === "SI" || legId === "EU" || legId === "CN") return legId;
  return null;
}

function legDebugStatus(
  fetched: FetchFuturesIntradayResult,
  resolved?: ResolvedFuturesContract,
): QuadHedgeLegDebug["status"] {
  if (!resolved?.secid || resolved.secid === "—") return "not-resolved";
  if (fetched.status === "error") return "request-error";
  if (fetched.points.length > 0) return "ok";
  return "no-candles";
}

function buildLegDebug(
  legId: QuadHedgeLegId,
  ticker: string,
  fetched: FetchFuturesIntradayResult,
  resolved?: ResolvedFuturesContract,
): QuadHedgeLegDebug | null {
  const base = legToBase(legId);
  if (!base) return null;

  const dbg = fetched.debug;
  return {
    base,
    secid: ticker !== "—" ? ticker : (resolved?.secid ?? "—"),
    boardId: "RFUD",
    engine: dbg?.engine ?? "futures",
    market: dbg?.market ?? "forts",
    candlesUrl: dbg?.candlesUrl,
    interval: fetched.requestedInterval,
    usedInterval: fetched.usedInterval,
    requestedFrom: dbg?.requestedFrom ?? dbg?.from,
    requestedTill: dbg?.requestedTill ?? dbg?.till,
    from: dbg?.from,
    till: dbg?.till,
    rawCandlesCount: dbg?.rawCount ?? fetched.points.length,
    moexPages: dbg?.moexPages,
    moexChunks: dbg?.moexChunks,
    moexLimitNotice: dbg?.moexLimitNotice,
    firstCandleTime: dbg?.firstTime ?? fetched.points[0]?.timestamp,
    lastCandleTime: dbg?.lastTime ?? fetched.points.at(-1)?.timestamp,
    normalizedPointsCount: fetched.points.length,
    error: fetched.error ?? resolved?.diagnostics.at(-1),
    status: legDebugStatus(fetched, resolved),
  };
}

function legFromFetch(
  legId: QuadHedgeLegId,
  ticker: string,
  label: string,
  fetched: FetchFuturesIntradayResult,
  resolvedContract?: ResolvedFuturesContract,
): QuadHedgeIntradayResponse["legs"][number] {
  return {
    legId,
    ticker,
    label,
    points: fetched.points.map((p) => ({ timestamp: p.timestamp, close: p.close })),
    status: fetched.status === "ok" && fetched.points.length > 0 ? "ok" : fetched.status,
    error:
      fetched.status === "ok" && fetched.points.length > 0
        ? undefined
        : fetched.error ??
          resolvedContract?.diagnostics.at(-1) ??
          `${label}: контракт найден, но свечей за выбранный период нет.`,
    resolvedContract,
  };
}

async function fetchLegIntraday(
  legId: QuadHedgeLegId,
  ticker: string,
  label: string,
  days: number,
  interval: number,
  dateRange: { from: string; till: string },
  resolvedContract?: ResolvedFuturesContract,
  prefetched?: FetchFuturesIntradayResult,
  historyMode: SpreadLabHistoryMode = "days",
): Promise<{
  leg: QuadHedgeIntradayResponse["legs"][number];
  usedInterval: number;
  intervalNotice?: string;
  fetched: FetchFuturesIntradayResult;
}> {
  if (!ticker || ticker === "—") {
    const empty: FetchFuturesIntradayResult = {
      points: [],
      status: "empty",
      error: resolvedContract?.diagnostics.at(-1) ?? `${label}: контракт не найден`,
      requestedInterval: interval,
      usedInterval: interval,
    };
    return {
      leg: {
        legId,
        ticker: "—",
        label,
        points: [],
        status: "empty",
        error: empty.error,
        resolvedContract,
      },
      usedInterval: interval,
      fetched: empty,
    };
  }

  const fetched =
    prefetched ??
    (await fetchFuturesIntradayCandles(ticker, days, interval, dateRange, { historyMode }));

  return {
    leg: legFromFetch(legId, ticker, label, fetched, resolvedContract),
    usedInterval: fetched.usedInterval,
    intervalNotice: fetched.intervalNotice,
    fetched,
  };
}

/** Intraday для primary SI / EU / CN + optional ED. */
export async function buildQuadHedgeIntradayResponse(options: {
  days: number;
  interval: number;
  windowScope?: QuadHedgeWindowScope;
  historyMode?: SpreadLabHistoryMode;
  historyDepth?: SpreadLabHistoryDepth;
}): Promise<QuadHedgeIntradayResponse> {
  const {
    days,
    interval: requestedInterval,
    windowScope = "today",
    historyMode = "days",
    historyDepth = "7S",
  } = options;
  const dateRange =
    historyMode === "max"
      ? spreadLabMaxHistoryRequestedRange()
      : resolveQuadHedgeCandleDateRange(days);

  const screener = await getScreenerResponse("future");
  const rows = screener.rows ?? [];

  const resolved = await resolveQuadHedgePrimaryContracts({
    screenerRows: rows,
    days,
    interval: requestedInterval,
    dateRange,
    historyMode,
  });

  const contractByBase = new Map(resolved.map((r) => [r.contract.base, r]));
  const contracts = resolved.map((r) => r.contract);

  const ed = pickActiveContractForFamily(rows, "ED");

  const targets: Array<{
    legId: QuadHedgeLegId;
    ticker: string;
    label: string;
    resolvedContract?: ResolvedFuturesContract;
    prefetched?: FetchFuturesIntradayResult;
  }> = [
    {
      legId: "SI",
      ticker: contractByBase.get("SI")?.contract.secid ?? "—",
      label: CURRENCY_FAMILY_META.SI.label,
      resolvedContract: contractByBase.get("SI")?.contract,
      prefetched: contractByBase.get("SI")?.intraday,
    },
    {
      legId: "CN",
      ticker: contractByBase.get("CN")?.contract.secid ?? "—",
      label: "CNY/RUB",
      resolvedContract: contractByBase.get("CN")?.contract,
      prefetched: contractByBase.get("CN")?.intraday,
    },
    {
      legId: "EU",
      ticker: contractByBase.get("EU")?.contract.secid ?? "—",
      label: contractByBase.get("EU")?.contract.shortName ?? "EUR/RUB",
      resolvedContract: contractByBase.get("EU")?.contract,
      prefetched: contractByBase.get("EU")?.intraday,
    },
    {
      legId: "ED",
      ticker: ed?.ticker ?? "—",
      label: CURRENCY_FAMILY_META.ED.label,
    },
  ];

  const results = await Promise.all(
    targets.map((t) =>
      fetchLegIntraday(
        t.legId,
        t.ticker,
        t.label,
        days,
        requestedInterval,
        dateRange,
        t.resolvedContract,
        t.prefetched,
        historyMode,
      ),
    ),
  );

  const usedInterval = results.find((r) => r.leg.points.length)?.usedInterval ?? requestedInterval;
  const intervalNotice = results.map((r) => r.intervalNotice).find(Boolean);

  const legDebugs = results
    .map((r) => buildLegDebug(r.leg.legId, r.leg.ticker, r.fetched, r.leg.resolvedContract))
    .filter((d): d is QuadHedgeLegDebug => d != null);

  const okLegs = legDebugs.filter((l) => l.status === "ok").length;
  const mergeNote =
    okLegs >= 2
      ? undefined
      : okLegs === 0
        ? "MOEX вернул 0 свечей по всем контрактам за выбранный диапазон."
        : `Только ${okLegs} нога с свечами — для графика нужно минимум 2.`;

  const moexLimitNotice = legDebugs.map((l) => l.moexLimitNotice).find(Boolean);

  const debug: QuadHedgePipelineDebug = {
    legs: legDebugs,
    mergedPointsCount: 0,
    alignedLegsCount: okLegs,
    windowScope,
    calendarDays: days,
    historyMode,
    historyDepth,
    requestedFrom: dateRange.from,
    requestedTill: dateRange.till,
    usedInterval,
    moexLimitNotice,
    missingLegs: legDebugs.filter((l) => l.status !== "ok").map((l) => l.base),
    mergeNote,
  };
  debug.summary = buildPipelineSummary(debug);

  return {
    source: "MOEX ISS",
    updatedAt: new Date().toISOString(),
    requestedInterval,
    usedInterval,
    intervalNotice,
    days,
    dateRange,
    windowScope,
    contracts,
    debug,
    legs: results.map((r) => r.leg),
  };
}
