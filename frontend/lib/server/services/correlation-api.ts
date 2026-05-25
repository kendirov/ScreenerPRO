import type { ScreenerRow } from "@screenerpro/shared";
import { pickActiveContractForFamily } from "@/lib/domain/currency-correlation";
import {
  calcDailyReturns,
  normalizeToBase100,
  pearsonCorrelation,
  rollingCorrelation,
} from "@/lib/domain/currency-correlation-series";
import {
  CORRELATION_API_FACTORS,
  type CorrelationApiFactorId,
  type CorrelationApiInterval,
  type CorrelationApiPeriod,
  type CorrelationDataStatus,
  type CorrelationFactor,
  type CorrelationFactorDetailResponse,
  type CorrelationFactorSummary,
  type CorrelationOverviewResponse,
  type CorrelationPairResponse,
  type CorrelationSignal,
} from "@/lib/domain/correlation-api";
import {
  CORRELATION_BREAK_THRESHOLD,
  CORRELATION_INVERSE_THRESHOLD,
  CORRELATION_SECTOR_GROUPS,
  CORRELATION_STRONG_THRESHOLD,
} from "@/lib/domain/correlation-lab";
import {
  buildBasketCloses,
  computeBeta,
  computeBreakScore,
  type DailyCloseSeries,
} from "@/lib/domain/correlation-lab-math";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";
import {
  getAvailableFactorCandidate,
  getSecurityCandles,
  type FactorCandidate,
  type MoexCandlePoint,
} from "@/lib/moex/moex-candles";
import { getScreenerResponse } from "@/lib/server/services/moex-screener";

const STOCK_LIMIT = 60;
const FETCH_CONCURRENCY = 12;
const OVERVIEW_CACHE_TTL_MS = 120_000;

type CloseSeries = { times: string[]; closes: number[] };

type FactorRun = {
  factor: CorrelationFactor;
  proxyTicker: string | null;
  factorSeries: CloseSeries | null;
  dataStatus: CorrelationDataStatus;
  sectorBaskets?: Map<string, CloseSeries>;
};

type RunContext = {
  updatedAt: string;
  interval: CorrelationApiInterval;
  period: CorrelationApiPeriod;
  from: string;
  till: string;
  stockSeries: Map<string, CloseSeries>;
  instrumentsAnalyzed: number;
  warnings: string[];
};

let overviewCache: {
  key: string;
  expiresAt: number;
  summaries: CorrelationFactorSummary[];
  factorRuns: Map<CorrelationApiFactorId, FactorRun>;
  signalsByFactor: Map<CorrelationApiFactorId, CorrelationSignal[]>;
  ctx: RunContext;
} | null = null;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateRange(period: CorrelationApiPeriod): { from: string; till: string } {
  const till = new Date();
  const from = new Date(till.getTime() - (period + 8) * 24 * 3600 * 1000);
  return { from: formatDate(from), till: formatDate(till) };
}

function candlesToSeries(candles: MoexCandlePoint[]): CloseSeries {
  const sorted = [...candles].sort((a, b) => a.t.localeCompare(b.t));
  return {
    times: sorted.map((c) => c.t),
    closes: sorted.map((c) => c.close),
  };
}

function toDailyCloseSeries(series: CloseSeries): CloseSeries {
  const byDay = new Map<string, number>();
  for (let i = 0; i < series.times.length; i++) {
    const day = series.times[i]!.slice(0, 10);
    byDay.set(day, series.closes[i]!);
  }
  const days = [...byDay.keys()].sort();
  return { times: days, closes: days.map((d) => byDay.get(d)!) };
}

function alignSeries(a: CloseSeries, b: CloseSeries): { times: string[]; aCloses: number[]; bCloses: number[] } {
  const bMap = new Map(b.times.map((t, i) => [t, b.closes[i]!]));
  const times: string[] = [];
  const aCloses: number[] = [];
  const bCloses: number[] = [];
  for (let i = 0; i < a.times.length; i++) {
    const t = a.times[i]!;
    const bv = bMap.get(t);
    const av = a.closes[i]!;
    if (bv != null && Number.isFinite(av) && Number.isFinite(bv)) {
      times.push(t);
      aCloses.push(av);
      bCloses.push(bv);
    }
  }
  return { times, aCloses, bCloses };
}

function computeMetrics(stockCloses: number[], factorCloses: number[]) {
  const rStock = calcDailyReturns(stockCloses);
  const rFactor = calcDailyReturns(factorCloses);
  const n = Math.min(rStock.length, rFactor.length);
  const candleCount = stockCloses.length;
  if (n < 8) {
    return {
      corr20: null,
      corr60: null,
      corr120: null,
      beta20: null,
      beta60: null,
      beta120: null,
      breakScore: null,
      candleCount,
    };
  }
  const rs = rStock.slice(-n);
  const rf = rFactor.slice(-n);
  const corr20 = n >= 21 ? pearsonCorrelation(rs.slice(-20), rf.slice(-20)) : pearsonCorrelation(rs, rf);
  const corr60 = n >= 61 ? pearsonCorrelation(rs.slice(-60), rf.slice(-60)) : pearsonCorrelation(rs, rf);
  const corr120 = n >= 121 ? pearsonCorrelation(rs.slice(-120), rf.slice(-120)) : null;
  const beta20 = n >= 20 ? computeBeta(rs.slice(-20), rf.slice(-20)) : computeBeta(rs, rf);
  const beta60 = n >= 60 ? computeBeta(rs.slice(-60), rf.slice(-60)) : computeBeta(rs, rf);
  const beta120 = n >= 120 ? computeBeta(rs.slice(-120), rf.slice(-120)) : null;
  return { corr20, corr60, corr120, beta20, beta60, beta120, breakScore: computeBreakScore(corr20, corr60), candleCount };
}

function classifySignal(metrics: ReturnType<typeof computeMetrics>): CorrelationSignal["kind"] {
  if (metrics.breakScore != null && metrics.breakScore >= CORRELATION_BREAK_THRESHOLD) return "break";
  if (metrics.corr60 != null && metrics.corr60 >= CORRELATION_STRONG_THRESHOLD) return "strong";
  if (metrics.corr60 != null && metrics.corr60 <= CORRELATION_INVERSE_THRESHOLD) return "inverse";
  if (metrics.corr60 != null && Math.abs(metrics.corr60) < 0.25) return "weak";
  return "neutral";
}

function buildSignal(ticker: string, stock: CloseSeries, factor: CloseSeries): CorrelationSignal | null {
  const aligned = alignSeries(stock, factor);
  if (aligned.aCloses.length < 10) return null;
  const metrics = computeMetrics(aligned.aCloses, aligned.bCloses);
  return { ticker, ...metrics, kind: classifySignal(metrics) };
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function pickLiquidStocks(rows: ScreenerRow[], limit: number): ScreenerRow[] {
  return [...rows]
    .filter((r) => r.assetClass === "stock")
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, limit);
}

function matchesAmerica(ticker: string, shortName: string): boolean {
  const t = ticker.toUpperCase();
  if (/^(SP|SF|SPY|NASD|NDX)/.test(t)) return true;
  if (/S&P|NASDAQ|SP500|Nasdaq/i.test(shortName)) return true;
  return false;
}

function resolveFutureTicker(futures: ScreenerRow[], familyKey: string): string | null {
  return buildFuturesFamilies(futures).find((f) => f.familyKey === familyKey)?.activeContractTicker ?? null;
}

function resolveAmericaTicker(futures: ScreenerRow[]): string | null {
  return (
    futures
      .filter((r) => r.assetClass === "future" && matchesAmerica(r.ticker, r.shortName ?? ""))
      .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))[0]?.ticker ?? null
  );
}

function factorCandidates(factorId: CorrelationApiFactorId, futures: ScreenerRow[]): FactorCandidate[] {
  if (factorId === "index") {
    return [
      { secid: "IMOEX2", engine: "stock", market: "index", label: "IMOEX2" },
      { secid: "IMOEX", engine: "stock", market: "index", label: "IMOEX" },
    ];
  }
  if (factorId === "ruble") {
    const si = pickActiveContractForFamily(futures, "SI");
    if (si?.ticker && si.ticker !== "—") {
      return [{ secid: si.ticker, engine: "futures", market: "forts", label: `Si ${si.ticker}` }];
    }
    return [];
  }
  if (factorId === "oil") {
    const br = resolveFutureTicker(futures, "brent");
    return br ? [{ secid: br, engine: "futures", market: "forts", label: `Brent ${br}` }] : [];
  }
  if (factorId === "gold") {
    const gd = resolveFutureTicker(futures, "gold");
    return gd ? [{ secid: gd, engine: "futures", market: "forts", label: `Gold ${gd}` }] : [];
  }
  if (factorId === "us") {
    const us = resolveAmericaTicker(futures);
    return us ? [{ secid: us, engine: "futures", market: "forts", label: `US ${us}` }] : [];
  }
  return [];
}

async function loadStockSeries(
  tickers: string[],
  interval: CorrelationApiInterval,
  from: string,
  till: string,
): Promise<Map<string, CloseSeries>> {
  const map = new Map<string, CloseSeries>();

  await mapPool(tickers, FETCH_CONCURRENCY, async (ticker) => {
    const result = await getSecurityCandles(ticker, "stock", "shares", "TQBR", interval, from, till);
    if (result.candles.length >= 8) {
      const raw = candlesToSeries(result.candles);
      map.set(ticker, interval >= 24 ? raw : toDailyCloseSeries(raw));
    }
  });

  return map;
}

async function resolveFactorRun(
  factorId: CorrelationApiFactorId,
  futures: ScreenerRow[],
  interval: CorrelationApiInterval,
  from: string,
  till: string,
  stockSeries: Map<string, CloseSeries>,
): Promise<FactorRun> {
  const base = CORRELATION_API_FACTORS.find((f) => f.id === factorId)!;
  const factor: CorrelationFactor = { ...base, proxyTicker: null, proxyLabel: null };

  if (factorId === "sector") {
    const sectorBaskets = new Map<string, CloseSeries>();
    for (const group of CORRELATION_SECTOR_GROUPS) {
      const members = new Map<string, DailyCloseSeries>();
      for (const ticker of group.tickers) {
        const s = stockSeries.get(ticker);
        if (s) members.set(ticker, { dates: s.times, closes: s.closes });
      }
      const basket = buildBasketCloses(members);
      if (basket) sectorBaskets.set(group.id, { times: basket.dates, closes: basket.closes });
    }
    return {
      factor: { ...factor, proxyLabel: "секторные корзины" },
      proxyTicker: null,
      factorSeries: null,
      dataStatus: sectorBaskets.size ? "live" : "no-history",
      sectorBaskets,
    };
  }

  const candidates = factorCandidates(factorId, futures);
  if (!candidates.length) {
    return {
      factor,
      proxyTicker: null,
      factorSeries: null,
      dataStatus: factorId === "us" ? "no-proxy" : "no-history",
    };
  }

  const { candidate, candles, dataStatus } = await getAvailableFactorCandidate(candidates, interval, from, till, 10);
  if (!candidate || !candles.length) {
    return { factor, proxyTicker: null, factorSeries: null, dataStatus: "no-history" };
  }

  const raw = candlesToSeries(candles);
  const series = interval >= 24 ? raw : toDailyCloseSeries(raw);
  return {
    factor: { ...factor, proxyTicker: candidate.secid, proxyLabel: candidate.label },
    proxyTicker: candidate.secid,
    factorSeries: series,
    dataStatus: dataStatus === "live" ? "live" : "partial",
  };
}

function computeFactorSignals(run: FactorRun, stockSeries: Map<string, CloseSeries>): CorrelationSignal[] {
  const signals: CorrelationSignal[] = [];

  if (run.factor.id === "sector" && run.sectorBaskets) {
    const sectorByTicker = new Map<string, string>();
    for (const g of CORRELATION_SECTOR_GROUPS) {
      for (const t of g.tickers) sectorByTicker.set(t, g.id);
    }
    for (const [ticker, stock] of stockSeries) {
      const sid = sectorByTicker.get(ticker);
      if (!sid) continue;
      const basket = run.sectorBaskets.get(sid);
      if (!basket) continue;
      const sig = buildSignal(ticker, stock, basket);
      if (sig) signals.push(sig);
    }
    return signals;
  }

  if (!run.factorSeries) return signals;

  for (const [ticker, stock] of stockSeries) {
    const sig = buildSignal(ticker, stock, run.factorSeries);
    if (sig) signals.push(sig);
  }
  return signals;
}

function summarizeFactor(id: CorrelationApiFactorId, run: FactorRun, signals: CorrelationSignal[]): CorrelationFactorSummary {
  const strong = signals.filter((s) => s.kind === "strong");
  const inverse = signals.filter((s) => s.kind === "inverse");
  const breaks = signals.filter((s) => s.kind === "break");
  const weak = signals.filter((s) => s.kind === "weak");

  return {
    id,
    title: run.factor.title,
    dataStatus: run.dataStatus,
    proxyTicker: run.proxyTicker,
    strongCount: strong.length,
    inverseCount: inverse.length,
    breakCount: breaks.length,
    weakCount: weak.length,
    strongSamples: strong.sort((a, b) => (b.corr60 ?? 0) - (a.corr60 ?? 0)).slice(0, 3).map((s) => s.ticker),
    inverseSamples: inverse.sort((a, b) => (a.corr60 ?? 0) - (b.corr60 ?? 0)).slice(0, 3).map((s) => s.ticker),
    breakSamples: breaks.sort((a, b) => (b.breakScore ?? 0) - (a.breakScore ?? 0)).slice(0, 3).map((s) => s.ticker),
  };
}

async function buildRunContext(
  period: CorrelationApiPeriod,
  interval: CorrelationApiInterval,
  screenerRows: ScreenerRow[] | undefined,
): Promise<RunContext> {
  const { from, till } = dateRange(period);
  const warnings: string[] = [];

  if (period >= 20 && interval < 24) {
    warnings.push("Для периода 20/60д используются дневные свечи (interval=24) — меньше запросов к MOEX");
  }

  const effectiveInterval: CorrelationApiInterval = period >= 20 ? 24 : interval;
  const stocks = pickLiquidStocks(screenerRows ?? [], STOCK_LIMIT);

  if (!stocks.length) warnings.push("Скринер не вернул ликвидные акции");

  const stockSeries = await loadStockSeries(
    stocks.map((s) => s.ticker),
    effectiveInterval,
    from,
    till,
  );

  if (stockSeries.size < stocks.length * 0.5) {
    warnings.push(`История есть только для ${stockSeries.size} из ${stocks.length} бумаг`);
  }

  return {
    updatedAt: new Date().toISOString(),
    interval: effectiveInterval,
    period,
    from,
    till,
    stockSeries,
    instrumentsAnalyzed: stockSeries.size,
    warnings,
  };
}

async function ensureOverviewData(period: CorrelationApiPeriod, interval: CorrelationApiInterval) {
  const cacheKey = `${period}|${interval}`;
  if (overviewCache && overviewCache.key === cacheKey && overviewCache.expiresAt > Date.now()) {
    return overviewCache;
  }

  const screener = await getScreenerResponse("all");
  const rows = screener.rows ?? [];
  const futures = rows.filter((r) => r.assetClass === "future");
  const ctx = await buildRunContext(period, interval, rows);

  const factorRuns = new Map<CorrelationApiFactorId, FactorRun>();
  const signalsByFactor = new Map<CorrelationApiFactorId, CorrelationSignal[]>();
  const summaries: CorrelationFactorSummary[] = [];

  for (const meta of CORRELATION_API_FACTORS) {
    const run = await resolveFactorRun(meta.id, futures, ctx.interval, ctx.from, ctx.till, ctx.stockSeries);
    const signals = computeFactorSignals(run, ctx.stockSeries);
    factorRuns.set(meta.id, run);
    signalsByFactor.set(meta.id, signals);
    summaries.push(summarizeFactor(meta.id, run, signals));
  }

  overviewCache = {
    key: cacheKey,
    expiresAt: Date.now() + OVERVIEW_CACHE_TTL_MS,
    summaries,
    factorRuns,
    signalsByFactor,
    ctx,
  };

  return overviewCache;
}

export async function buildCorrelationOverview(
  period: CorrelationApiPeriod,
  interval: CorrelationApiInterval,
): Promise<CorrelationOverviewResponse> {
  const data = await ensureOverviewData(period, interval);
  return {
    updatedAt: data.ctx.updatedAt,
    interval: data.ctx.interval,
    period: data.ctx.period,
    instrumentsAnalyzed: data.ctx.instrumentsAnalyzed,
    factors: data.summaries,
    warnings: data.ctx.warnings,
  };
}

export async function buildCorrelationFactorDetail(
  factorId: CorrelationApiFactorId,
  period: CorrelationApiPeriod,
  interval: CorrelationApiInterval,
): Promise<CorrelationFactorDetailResponse> {
  const data = await ensureOverviewData(period, interval);
  const run = data.factorRuns.get(factorId);
  const signals = data.signalsByFactor.get(factorId) ?? [];

  if (!run) throw new Error("Неизвестный фактор");

  return {
    factor: run.factor,
    signals,
    topPositive: [...signals].filter((s) => (s.corr60 ?? 0) > 0).sort((a, b) => (b.corr60 ?? 0) - (a.corr60 ?? 0)).slice(0, 12),
    topNegative: [...signals].filter((s) => (s.corr60 ?? 0) < 0).sort((a, b) => (a.corr60 ?? 0) - (b.corr60 ?? 0)).slice(0, 12),
    brokenLinks: signals.filter((s) => s.kind === "break").slice(0, 12),
    weakLinks: signals.filter((s) => s.kind === "weak" || s.kind === "neutral").slice(0, 12),
    meta: {
      interval: `${data.ctx.interval}м`,
      period: `${data.ctx.period}д`,
      instrumentsAnalyzed: data.ctx.instrumentsAnalyzed,
      dataStatus: run.dataStatus,
      proxyTicker: run.proxyTicker,
      updatedAt: data.ctx.updatedAt,
    },
  };
}

export async function buildCorrelationPair(
  stock: string,
  factorId: CorrelationApiFactorId,
  period: CorrelationApiPeriod,
  interval: CorrelationApiInterval,
): Promise<CorrelationPairResponse> {
  const ticker = stock.trim().toUpperCase();
  const { from, till } = dateRange(period);
  const effectiveInterval: CorrelationApiInterval = period >= 20 ? 24 : interval;

  const screener = await getScreenerResponse("all");
  const futures = (screener.rows ?? []).filter((r) => r.assetClass === "future");

  const stockResult = await getSecurityCandles(ticker, "stock", "shares", "TQBR", effectiveInterval, from, till);
  const stockRaw = candlesToSeries(stockResult.candles);
  const stockSeries = effectiveInterval >= 24 ? stockRaw : toDailyCloseSeries(stockRaw);

  let factorSeries: CloseSeries | null = null;
  let proxyTicker: string | null = null;
  let dataStatus: CorrelationDataStatus = "no-history";

  if (factorId === "sector") {
    const group = CORRELATION_SECTOR_GROUPS.find((g) => g.tickers.includes(ticker));
    if (group) {
      const members = new Map<string, DailyCloseSeries>();
      for (const t of group.tickers) {
        if (t === ticker) continue;
        const r = await getSecurityCandles(t, "stock", "shares", "TQBR", effectiveInterval, from, till);
        if (r.candles.length >= 8) {
          const raw = candlesToSeries(r.candles);
          const s = effectiveInterval >= 24 ? raw : toDailyCloseSeries(raw);
          members.set(t, { dates: s.times, closes: s.closes });
        }
      }
      const basket = buildBasketCloses(members);
      if (basket) {
        factorSeries = { times: basket.dates, closes: basket.closes };
        proxyTicker = group.id;
        dataStatus = "live";
      }
    }
  } else {
    const candidates = factorCandidates(factorId, futures);
    const resolved = await getAvailableFactorCandidate(candidates, effectiveInterval, from, till, 8);
    if (resolved.candidate && resolved.candles.length) {
      proxyTicker = resolved.candidate.secid;
      const raw = candlesToSeries(resolved.candles);
      factorSeries = effectiveInterval >= 24 ? raw : toDailyCloseSeries(raw);
      dataStatus = resolved.dataStatus === "live" ? "live" : "partial";
    } else if (factorId === "us") {
      dataStatus = "no-proxy";
    }
  }

  const emptyStats = { corr20: null, corr60: null, beta20: null, beta60: null, breakScore: null };

  if (!factorSeries || stockSeries.closes.length < 8) {
    return {
      stock: ticker,
      factor: factorId,
      normalizedStock: [],
      normalizedFactor: [],
      rollingCorr: [],
      stats: emptyStats,
      meta: { interval: `${effectiveInterval}м`, period: `${period}д`, dataStatus, proxyTicker },
    };
  }

  const aligned = alignSeries(stockSeries, factorSeries);
  const stats = computeMetrics(aligned.aCloses, aligned.bCloses);

  const normStock = normalizeToBase100(aligned.aCloses).map((value, i) => ({ t: aligned.times[i]!, value }));
  const normFactor = normalizeToBase100(aligned.bCloses).map((value, i) => ({ t: aligned.times[i]!, value }));

  const rStock = calcDailyReturns(aligned.aCloses);
  const rFactor = calcDailyReturns(aligned.bCloses);
  const roll = rollingCorrelation(rStock, rFactor, 20);
  const rollingCorr = roll.values
    .map((value, i) => ({ t: aligned.times[i + 1] ?? aligned.times.at(-1)!, value: value ?? 0 }))
    .filter((p) => Number.isFinite(p.value));

  return {
    stock: ticker,
    factor: factorId,
    normalizedStock: normStock.filter((p) => Number.isFinite(p.value)),
    normalizedFactor: normFactor.filter((p) => Number.isFinite(p.value)),
    rollingCorr,
    stats,
    meta: { interval: `${effectiveInterval}м`, period: `${period}д`, dataStatus, proxyTicker },
  };
}
