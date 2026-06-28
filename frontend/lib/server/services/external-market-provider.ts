import type { ExternalAssetDef } from "@/lib/server/services/external-assets-registry";
import type {
  ExternalAssetDiagnostic,
  ExternalAssetQuote,
  ExternalSeriesPoint,
} from "@/lib/preparation/preparation-types";

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT = "Mozilla/5.0 (compatible; ScreenerPRO/1.0; preparation-external)";
const MAX_RETRIES = 2;

type YahooChartResult = {
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
    }>;
  };
};

function formatDateFromUnix(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

function computeRangePct(values: number[]): number | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;
  if (mid === 0) return null;
  return ((max - min) / mid) * 100;
}

function computeVolatility(values: number[]): number | null {
  if (values.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!;
    const curr = values[i]!;
    if (prev !== 0) returns.push(((curr - prev) / prev) * 100);
  }
  if (!returns.length) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

async function fetchYahooChart(symbol: string, attempt = 0): Promise<YahooChartResult | null> {
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      if (attempt < MAX_RETRIES && (response.status === 429 || response.status >= 500)) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        return fetchYahooChart(symbol, attempt + 1);
      }
      return null;
    }
    const json = (await response.json()) as { chart?: { result?: YahooChartResult[] } };
    return json.chart?.result?.[0] ?? null;
  } catch {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return fetchYahooChart(symbol, attempt + 1);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseYahooResult(
  asset: ExternalAssetDef,
  result: YahooChartResult,
  symbolUsed: string,
): { quote: Omit<ExternalAssetQuote, "critical" | "tags" | "isMover">; diagnostic: ExternalAssetDiagnostic } | null {
  const timestamps = result.timestamp ?? [];
  const quoteRow = result.indicators?.quote?.[0];
  const closes = quoteRow?.close ?? [];
  const highs = quoteRow?.high ?? [];
  const lows = quoteRow?.low ?? [];
  const points: ExternalSeriesPoint[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null || !Number.isFinite(close)) continue;
    points.push({
      date: formatDateFromUnix(timestamps[i]!),
      value: close,
      high: highs[i] ?? undefined,
      low: lows[i] ?? undefined,
    });
  }

  if (points.length < 2) return null;

  const series5d = points.slice(-5);
  const values = series5d.map((p) => p.value);
  const last = values[values.length - 1]!;
  const prev1d = values.length >= 2 ? values[values.length - 2]! : null;
  const first5d = values[0]!;

  const quote: Omit<ExternalAssetQuote, "critical" | "tags" | "isMover"> = {
    id: asset.id,
    name: asset.name,
    group: asset.group,
    symbol: symbolUsed,
    last,
    change1dPct: prev1d != null ? pctChange(prev1d, last) : null,
    change5dPct: pctChange(first5d, last),
    range5dPct: computeRangePct(values),
    volatility5d: computeVolatility(values),
    series5d,
    source: "yahoo-finance",
    updatedAt: new Date().toISOString(),
  };

  return {
    quote,
    diagnostic: buildDiagnostic(asset, symbolUsed, "ok", series5d),
  };
}

function buildDiagnostic(
  asset: ExternalAssetDef,
  symbol: string,
  status: ExternalAssetDiagnostic["status"],
  points: ExternalSeriesPoint[],
  error?: string,
): ExternalAssetDiagnostic {
  const values = points.map((p) => p.value);
  return {
    id: asset.id,
    name: asset.name,
    group: asset.group,
    symbol,
    provider: asset.provider,
    status,
    points: points.length,
    firstDate: points[0]?.date ?? null,
    lastDate: points[points.length - 1]?.date ?? null,
    firstValue: values[0] ?? null,
    lastValue: values[values.length - 1] ?? null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    error,
  };
}

function buildErrorQuote(
  asset: ExternalAssetDef,
  symbol: string,
  error: string,
): Omit<ExternalAssetQuote, "critical" | "tags" | "isMover"> {
  return {
    id: asset.id,
    name: asset.name,
    group: asset.group,
    symbol,
    last: null,
    change1dPct: null,
    change5dPct: null,
    range5dPct: null,
    volatility5d: null,
    series5d: [],
    source: "yahoo-finance",
    updatedAt: new Date().toISOString(),
    error,
  };
}

export async function fetchExternalAssetQuote(
  asset: ExternalAssetDef,
): Promise<{ quote: ExternalAssetQuote; diagnostic: ExternalAssetDiagnostic }> {
  if (!asset.active) {
    return {
      quote: {
        ...buildErrorQuote(asset, asset.symbol, asset.disabledReason ?? "disabled"),
        critical: asset.critical,
        tags: [],
        isMover: false,
      },
      diagnostic: buildDiagnostic(asset, asset.symbol, "disabled", [], asset.disabledReason),
    };
  }

  const symbols = [asset.symbol, ...(asset.fallbackSymbols ?? [])];

  for (const symbol of symbols) {
    const result = await fetchYahooChart(symbol);
    if (!result) continue;
    const parsed = parseYahooResult(asset, result, symbol);
    if (parsed && parsed.diagnostic.status === "ok") {
      return {
        quote: { ...parsed.quote, critical: asset.critical, tags: [], isMover: false },
        diagnostic: parsed.diagnostic,
      };
    }
  }

  return {
    quote: {
      ...buildErrorQuote(asset, asset.symbol, "Нет данных Yahoo"),
      critical: asset.critical,
      tags: [],
      isMover: false,
    },
    diagnostic: buildDiagnostic(asset, asset.symbol, "error", [], "Нет данных Yahoo"),
  };
}

const CONCURRENCY = 4;
const BATCH_DELAY_MS = 150;

export async function fetchAllExternalQuotes(
  assets: ExternalAssetDef[],
): Promise<{ quotes: ExternalAssetQuote[]; diagnostics: ExternalAssetDiagnostic[] }> {
  const quotes: ExternalAssetQuote[] = [];
  const diagnostics: ExternalAssetDiagnostic[] = [];

  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    if (i > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    const batch = assets.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((asset) => fetchExternalAssetQuote(asset)));
    for (const result of batchResults) {
      quotes.push(result.quote);
      diagnostics.push(result.diagnostic);
    }
  }

  return { quotes, diagnostics };
}
