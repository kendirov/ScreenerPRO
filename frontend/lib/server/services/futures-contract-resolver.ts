import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildResolvedContract,
  collectCandidatesFromScreener,
  rankFuturesContractCandidates,
  type FuturesContractBase,
  type FuturesContractCandidate,
  type ResolvedFuturesContract,
} from "@/lib/domain/futures-contract-resolver";
import { fetchIssJson } from "@/lib/server/moex-iss/http";
import { fetchFuturesIntradayCandles, type FetchFuturesIntradayResult, type FetchFuturesIntradayOptions } from "@/lib/server/services/moex-futures-candles";

const ISS_FORTS_URL =
  "/engines/futures/markets/forts/securities.json?iss.meta=off&iss.only=securities,marketdata&securities.columns=SECID,SHORTNAME,ASSETCODE,LASTDELDATE,BOARDID&marketdata.columns=SECID,VALTODAY,LAST,NUMTRADES";

const MAX_CANDIDATES_TO_PROBE = 4;

type IssRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowToObject(columns: string[], row: unknown[]): IssRow {
  return Object.fromEntries(columns.map((column, idx) => [column, row[idx]]));
}

let issCandidatesCache: { expiresAt: number; candidates: FuturesContractCandidate[] } | null = null;

/** Список FORTS из MOEX ISS — fallback, если скринер пуст. */
export async function fetchMoexFortsContractCandidates(): Promise<FuturesContractCandidate[]> {
  const now = Date.now();
  if (issCandidatesCache && issCandidatesCache.expiresAt > now) {
    return issCandidatesCache.candidates;
  }

  try {
    const payload = (await fetchIssJson(ISS_FORTS_URL)) as {
      securities?: { columns: string[]; data: unknown[][] };
      marketdata?: { columns: string[]; data: unknown[][] };
    };

    const mdBySecid = new Map<string, IssRow>();
    const md = payload.marketdata;
    if (md?.columns?.length && md.data?.length) {
      for (const row of md.data) {
        const item = rowToObject(md.columns, row);
        const secid = asString(item.SECID);
        if (secid) mdBySecid.set(secid, item);
      }
    }

    const sec = payload.securities;
    if (!sec?.columns?.length || !sec.data?.length) return [];

    const candidates: FuturesContractCandidate[] = [];
    for (const row of sec.data) {
      const item = rowToObject(sec.columns, row);
      const secid = asString(item.SECID);
      if (!secid) continue;
      const mdRow = mdBySecid.get(secid);
      candidates.push({
        secid,
        shortName: asString(item.SHORTNAME) ?? secid,
        assetCode: asString(item.ASSETCODE),
        expiryDate: asString(item.LASTDELDATE),
        turnover: mdRow ? asNumber(mdRow.VALTODAY) : null,
        lastPrice: mdRow ? asNumber(mdRow.LAST) : null,
        tradesCount: mdRow ? asNumber(mdRow.NUMTRADES) : null,
      });
    }

    issCandidatesCache = { expiresAt: now + 5 * 60_000, candidates };
    return candidates;
  } catch {
    return [];
  }
}

async function mergeCandidatePools(screenerRows: ScreenerRow[]): Promise<FuturesContractCandidate[]> {
  const fromScreener = collectCandidatesFromScreener(screenerRows);
  if (fromScreener.length >= 20) return fromScreener;

  const fromIss = await fetchMoexFortsContractCandidates();
  const bySecid = new Map<string, FuturesContractCandidate>();

  for (const c of fromIss) bySecid.set(c.secid.toUpperCase(), c);
  for (const c of fromScreener) {
    const key = c.secid.toUpperCase();
    const prev = bySecid.get(key);
    bySecid.set(key, prev ? { ...prev, ...c, assetCode: c.assetCode ?? prev.assetCode } : c);
  }

  return [...bySecid.values()];
}

export type ResolvedFuturesContractWithIntraday = {
  contract: ResolvedFuturesContract;
  intraday?: FetchFuturesIntradayResult;
};

export async function resolveFuturesContractWithCandles(
  base: FuturesContractBase,
  candidates: FuturesContractCandidate[],
  options: { days: number; interval: number; dateRange?: { from: string; till: string } } & FetchFuturesIntradayOptions,
): Promise<ResolvedFuturesContractWithIntraday> {
  const ranked = rankFuturesContractCandidates(candidates, base);
  if (!ranked.length) {
    return {
      contract: buildResolvedContract(base, null, { hasCandles: false }),
    };
  }

  const toProbe = ranked.slice(0, MAX_CANDIDATES_TO_PROBE);
  let lastTried: FuturesContractCandidate | null = null;
  let lastFetch: FetchFuturesIntradayResult | undefined;

  for (let i = 0; i < toProbe.length; i++) {
    const candidate = toProbe[i]!;
    lastTried = candidate;
    const fetched = await fetchFuturesIntradayCandles(
      candidate.secid,
      options.days,
      options.interval,
      options.dateRange,
      { historyMode: options.historyMode },
    );
    lastFetch = fetched;

    if (fetched.status === "ok" && fetched.points.length > 0) {
      const diagnostics: string[] = [
        `Выбран ${candidate.secid}${candidate.expiryDate ? ` (эксп. ${candidate.expiryDate})` : ""}.`,
      ];
      if (fetched.intervalNotice) diagnostics.push(fetched.intervalNotice);
      if (i > 0) diagnostics.push(`Fallback: предыдущие контракты без свечей.`);

      return {
        contract: buildResolvedContract(base, candidate, {
          hasCandles: true,
          fallbackUsed: i > 0,
          diagnostics,
          isActive: true,
        }),
        intraday: fetched,
      };
    }
  }

  return {
    contract: buildResolvedContract(base, lastTried ?? ranked[0] ?? null, {
      hasCandles: false,
      fallbackUsed: toProbe.length > 1,
      diagnostics: lastTried
        ? [`Проверено контрактов: ${toProbe.map((c) => c.secid).join(", ")}.`]
        : undefined,
    }),
    intraday: lastFetch,
  };
}

export async function resolveQuadHedgePrimaryContracts(options: {
  screenerRows: ScreenerRow[];
  days: number;
  interval: number;
  dateRange?: { from: string; till: string };
  bases?: FuturesContractBase[];
} & FetchFuturesIntradayOptions): Promise<ResolvedFuturesContractWithIntraday[]> {
  const bases = options.bases ?? (["SI", "EU", "CN"] as FuturesContractBase[]);
  const candidates = await mergeCandidatePools(options.screenerRows);

  return Promise.all(
    bases.map((base) =>
      resolveFuturesContractWithCandles(base, candidates, {
        days: options.days,
        interval: options.interval,
        dateRange: options.dateRange,
        historyMode: options.historyMode,
      }),
    ),
  );
}

export async function resolveFuturesContractForBase(
  base: FuturesContractBase,
  screenerRows: ScreenerRow[],
): Promise<ResolvedFuturesContract> {
  const candidates = await mergeCandidatePools(screenerRows);
  const ranked = rankFuturesContractCandidates(candidates, base);
  return buildResolvedContract(base, ranked[0] ?? null, {
    isActive: Boolean(ranked[0]),
  });
}
