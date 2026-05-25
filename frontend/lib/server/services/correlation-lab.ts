import type { ScreenerRow } from "@screenerpro/shared";
import { pickActiveContractForFamily } from "@/lib/domain/currency-correlation";
import {
  CORRELATION_BREAK_THRESHOLD,
  CORRELATION_INVERSE_THRESHOLD,
  CORRELATION_LAB_FACTORS,
  CORRELATION_SECTOR_GROUPS,
  CORRELATION_STRONG_THRESHOLD,
  buildBriefingThemes,
  type CorrelationFactorCardData,
  type CorrelationFactorId,
  type CorrelationInstrumentLink,
  type CorrelationLabDataStatus,
  type CorrelationLabOverviewResponse,
  type CorrelationLabOverviewStatus,
  type CorrelationLabSourcesResponse,
  type CorrelationSourceAdapter,
} from "@/lib/domain/correlation-lab";
import {
  alignCloseSeries,
  buildBasketCloses,
  computeStockFactorMetrics,
  seriesFromCloses,
  type DailyCloseSeries,
} from "@/lib/domain/correlation-lab-math";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";
import { historyUrl, indexHistoryUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapHistoryBars } from "@/lib/server/integrations/moex/mappers";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";
import { fetchFuturesDailyCandles } from "@/lib/server/services/moex-futures-candles";
import { getScreenerResponse } from "@/lib/server/services/moex-screener";

const HISTORY_DAYS = 70;
const STOCK_LIMIT = 42;
const CACHE_TTL_MS = 5 * 60 * 1000;

type ClosePoint = { date: string; close: number };

let overviewCache: { expiresAt: number; payload: CorrelationLabOverviewResponse } | null = null;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchStockHistoryCloses(secid: string): Promise<ClosePoint[]> {
  const key = secid.trim().toUpperCase();
  const till = new Date();
  const from = new Date(till.getTime() - (HISTORY_DAYS + 12) * 24 * 3600 * 1000);

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(historyUrl("stock", key, formatDate(from), formatDate(till)), 300),
    );
    const history = payload.history;
    if (!history?.data?.length) return [];

    return mapHistoryBars(history.columns, history.data)
      .filter((bar) => bar.close != null && Number.isFinite(bar.close))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-HISTORY_DAYS)
      .map((bar) => ({ date: formatDate(bar.date), close: bar.close! }));
  } catch {
    return [];
  }
}

async function fetchIndexHistoryCloses(secid: string): Promise<ClosePoint[]> {
  const key = secid.trim().toUpperCase();
  const till = new Date();
  const from = new Date(till.getTime() - (HISTORY_DAYS + 12) * 24 * 3600 * 1000);

  try {
    const payload = moexPayloadSchema.parse(
      await moexGetJson(indexHistoryUrl(key, formatDate(from), formatDate(till)), 300),
    );
    const history = payload.history;
    if (!history?.data?.length) return [];

    return mapHistoryBars(history.columns, history.data)
      .filter((bar) => bar.close != null && Number.isFinite(bar.close))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-HISTORY_DAYS)
      .map((bar) => ({ date: formatDate(bar.date), close: bar.close! }));
  } catch {
    return [];
  }
}

async function fetchFutureHistoryCloses(secid: string): Promise<ClosePoint[]> {
  const result = await fetchFuturesDailyCandles(secid, HISTORY_DAYS, 24);
  if (result.status !== "ok") return [];
  return result.points
    .filter((p) => Number.isFinite(p.close))
    .map((p) => ({ date: p.date, close: p.close }));
}

function pickLiquidStocks(rows: ScreenerRow[], limit: number): ScreenerRow[] {
  return [...rows]
    .filter((row) => row.assetClass === "stock")
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, limit);
}

function matchesAmerica(ticker: string, shortName: string): boolean {
  const t = ticker.toUpperCase();
  if (/^(SP|SF|SPY|NASD|NDX|HSI)/.test(t)) return true;
  if (/S&P|NASDAQ|SP500|Nasdaq|Standard/i.test(shortName)) return true;
  return false;
}

function resolveFutureByFamilyKey(futures: ScreenerRow[], familyKey: string): string | null {
  const families = buildFuturesFamilies(futures);
  const match = families.find((f) => f.familyKey === familyKey);
  return match?.activeContractTicker ?? null;
}

function resolveAmericaFuture(futures: ScreenerRow[]): string | null {
  const candidates = futures
    .filter((row) => row.assetClass === "future" && matchesAmerica(row.ticker, row.shortName ?? ""))
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0));
  return candidates[0]?.ticker ?? null;
}

async function resolveFactorProxy(
  factorId: CorrelationFactorId,
  futures: ScreenerRow[],
): Promise<{ ticker: string | null; label: string | null; closes: ClosePoint[]; status: CorrelationLabDataStatus }> {
  if (factorId === "index") {
    for (const secid of ["IMOEX2", "IMOEX"]) {
      const closes = await fetchIndexHistoryCloses(secid);
      if (closes.length >= 25) {
        return { ticker: secid, label: secid, closes, status: closes.length >= 55 ? "live" : "partial" };
      }
    }
    const imoexFuture = resolveFutureByFamilyKey(futures, "imoex");
    if (imoexFuture) {
      const closes = await fetchFutureHistoryCloses(imoexFuture);
      if (closes.length >= 25) {
        return {
          ticker: imoexFuture,
          label: `фьючерс ${imoexFuture}`,
          closes,
          status: closes.length >= 55 ? "live" : "partial",
        };
      }
    }
    return { ticker: null, label: null, closes: [], status: "no-history" };
  }

  if (factorId === "ruble") {
    const si = pickActiveContractForFamily(futures, "SI");
    if (si?.ticker && si.ticker !== "—") {
      const closes = await fetchFutureHistoryCloses(si.ticker);
      if (closes.length >= 25) {
        return {
          ticker: si.ticker,
          label: `Si ${si.ticker}`,
          closes,
          status: closes.length >= 55 ? "live" : "partial",
        };
      }
    }
    return { ticker: si?.ticker ?? null, label: si?.ticker ?? null, closes: [], status: "no-history" };
  }

  if (factorId === "oil") {
    const br = resolveFutureByFamilyKey(futures, "brent");
    if (br) {
      const closes = await fetchFutureHistoryCloses(br);
      if (closes.length >= 25) {
        return { ticker: br, label: `Brent ${br}`, closes, status: closes.length >= 55 ? "live" : "partial" };
      }
    }
    return { ticker: br, label: br ? `Brent ${br}` : null, closes: [], status: "no-history" };
  }

  if (factorId === "gold") {
    const gold = resolveFutureByFamilyKey(futures, "gold");
    if (gold) {
      const closes = await fetchFutureHistoryCloses(gold);
      if (closes.length >= 25) {
        return { ticker: gold, label: `Gold ${gold}`, closes, status: closes.length >= 55 ? "live" : "partial" };
      }
    }
    return { ticker: gold, label: gold ? `Gold ${gold}` : null, closes: [], status: "no-history" };
  }

  if (factorId === "america") {
    const us = resolveAmericaFuture(futures);
    if (!us) {
      return { ticker: null, label: null, closes: [], status: "no-proxy" };
    }
    const closes = await fetchFutureHistoryCloses(us);
    if (closes.length >= 25) {
      return {
        ticker: us,
        label: `US ${us}`,
        closes,
        status: closes.length >= 55 ? "live" : "partial",
      };
    }
    return { ticker: us, label: us, closes: [], status: "no-history" };
  }

  return { ticker: null, label: "секторные корзины", closes: [], status: "live" };
}

function classifyLink(
  corr60: number | null,
  breakScore: number | null,
): CorrelationInstrumentLink["linkKind"] {
  if (breakScore != null && breakScore >= CORRELATION_BREAK_THRESHOLD) return "break";
  if (corr60 != null && corr60 >= CORRELATION_STRONG_THRESHOLD) return "strong";
  if (corr60 != null && corr60 <= CORRELATION_INVERSE_THRESHOLD) return "inverse";
  return "neutral";
}

function buildFactorCard(
  factorId: CorrelationFactorId,
  meta: (typeof CORRELATION_LAB_FACTORS)[number],
  proxy: Awaited<ReturnType<typeof resolveFactorProxy>>,
  stockSeries: Map<string, DailyCloseSeries>,
  sectorBaskets?: Map<string, DailyCloseSeries>,
): CorrelationFactorCardData {
  const instruments: CorrelationInstrumentLink[] = [];

  if (factorId === "sector" && sectorBaskets) {
    const sectorByTicker = new Map<string, string>();
    for (const group of CORRELATION_SECTOR_GROUPS) {
      for (const ticker of group.tickers) sectorByTicker.set(ticker, group.id);
    }

    for (const [ticker, stock] of stockSeries) {
      const sectorId = sectorByTicker.get(ticker);
      if (!sectorId) continue;
      const basket = sectorBaskets.get(sectorId);
      if (!basket) continue;

      const aligned = alignCloseSeries(stock, basket);
      if (aligned.dates.length < 15) continue;

      const metrics = computeStockFactorMetrics(aligned.aCloses, aligned.bCloses);
      instruments.push({
        ticker,
        corr20: metrics.corr20,
        corr60: metrics.corr60,
        beta: metrics.beta,
        breakScore: metrics.breakScore,
        linkKind: classifyLink(metrics.corr60, metrics.breakScore),
      });
    }
  } else if (proxy.closes.length >= 15) {
    const factorSeries = seriesFromCloses(proxy.closes);

    for (const [ticker, stock] of stockSeries) {
      const aligned = alignCloseSeries(stock, factorSeries);
      if (aligned.dates.length < 15) continue;

      const metrics = computeStockFactorMetrics(aligned.aCloses, aligned.bCloses);
      instruments.push({
        ticker,
        corr20: metrics.corr20,
        corr60: metrics.corr60,
        beta: metrics.beta,
        breakScore: metrics.breakScore,
        linkKind: classifyLink(metrics.corr60, metrics.breakScore),
      });
    }
  }

  const strong = instruments.filter((i) => i.linkKind === "strong").sort((a, b) => (b.corr60 ?? 0) - (a.corr60 ?? 0));
  const inverse = instruments.filter((i) => i.linkKind === "inverse").sort((a, b) => (a.corr60 ?? 0) - (b.corr60 ?? 0));
  const breaks = instruments.filter((i) => i.linkKind === "break").sort((a, b) => (b.breakScore ?? 0) - (a.breakScore ?? 0));

  let dataStatus = proxy.status;
  if (instruments.length === 0 && dataStatus === "live") dataStatus = "no-history";
  if (instruments.length > 0 && instruments.length < 8 && dataStatus === "live") dataStatus = "partial";

  const alignedDays =
    factorId === "sector"
      ? [...(sectorBaskets?.values() ?? [])].reduce((max, s) => Math.max(max, s.dates.length), 0) || null
      : proxy.closes.length || null;

  return {
    id: factorId,
    title: meta.title,
    meaning: meta.meaning,
    dataStatus,
    proxyLabel: proxy.label,
    proxyTicker: proxy.ticker,
    sessionDays: alignedDays,
    strongCount: strong.length,
    inverseCount: inverse.length,
    breakCount: breaks.length,
    strongSamples: strong.slice(0, 3).map((i) => i.ticker),
    inverseSamples: inverse.slice(0, 3).map((i) => i.ticker),
    breakSamples: breaks.slice(0, 3).map((i) => i.ticker),
    instruments: [...strong, ...inverse, ...breaks].slice(0, 24),
  };
}

export async function buildCorrelationLabOverviewResponse(): Promise<CorrelationLabOverviewResponse> {
  const now = Date.now();
  if (overviewCache && overviewCache.expiresAt > now) {
    return overviewCache.payload;
  }

  const fetchedAt = new Date().toISOString();
  const warnings: string[] = [];

  try {
    const screener = await getScreenerResponse("all");
    const stocks = pickLiquidStocks(screener.rows ?? [], STOCK_LIMIT);
    const futures = (screener.rows ?? []).filter((row) => row.assetClass === "future");

    if (!stocks.length) {
      return {
        fetchedAt,
        status: "no-data",
        stockCount: 0,
        alignedDays: null,
        factors: CORRELATION_LAB_FACTORS.map((meta) => ({
          id: meta.id,
          title: meta.title,
          meaning: meta.meaning,
          dataStatus: "no-history" as const,
          proxyLabel: null,
          proxyTicker: null,
          sessionDays: null,
          strongCount: 0,
          inverseCount: 0,
          breakCount: 0,
          strongSamples: [],
          inverseSamples: [],
          breakSamples: [],
          instruments: [],
        })),
        briefingThemes: ["Нет ликвидных акций в ленте MOEX — проверьте /api/screener"],
        warnings: ["Скринер вернул пустой список акций"],
      };
    }

    const stockCloseResults = await Promise.all(
      stocks.map(async (row) => {
        const closes = await fetchStockHistoryCloses(row.ticker);
        return { ticker: row.ticker, closes };
      }),
    );

    const stockSeries = new Map<string, DailyCloseSeries>();
    for (const item of stockCloseResults) {
      if (item.closes.length >= 15) {
        stockSeries.set(item.ticker, seriesFromCloses(item.closes));
      }
    }

    if (stockSeries.size < 8) {
      warnings.push(`История свечей доступна только для ${stockSeries.size} из ${stocks.length} бумаг`);
    }

    const sectorBaskets = new Map<string, DailyCloseSeries>();
    for (const group of CORRELATION_SECTOR_GROUPS) {
      const members = new Map<string, DailyCloseSeries>();
      for (const ticker of group.tickers) {
        const series = stockSeries.get(ticker);
        if (series) members.set(ticker, series);
      }
      const basket = buildBasketCloses(members);
      if (basket && basket.dates.length >= 15) {
        sectorBaskets.set(group.id, basket);
      }
    }

    const factorCards: CorrelationFactorCardData[] = [];
    for (const meta of CORRELATION_LAB_FACTORS) {
      const proxy = await resolveFactorProxy(meta.id, futures);
      if (meta.id === "america" && proxy.status === "no-proxy") {
        warnings.push("Фьючерсы США на MOEX не найдены в текущей ленте — блок «Америка» без прокси");
      }
      factorCards.push(
        buildFactorCard(meta.id, meta, proxy, stockSeries, meta.id === "sector" ? sectorBaskets : undefined),
      );
    }

    const liveFactors = factorCards.filter((f) => f.dataStatus === "live" || f.dataStatus === "partial").length;
    let status: CorrelationLabOverviewStatus = "ok";
    if (liveFactors === 0) status = "no-data";
    else if (liveFactors < CORRELATION_LAB_FACTORS.length || stockSeries.size < stocks.length * 0.6) {
      status = "partial";
    }

    const alignedDays = [...stockSeries.values()].reduce((max, s) => Math.max(max, s.dates.length), 0) || null;

    const payload: CorrelationLabOverviewResponse = {
      fetchedAt,
      status,
      stockCount: stockSeries.size,
      alignedDays,
      factors: factorCards,
      briefingThemes: buildBriefingThemes(factorCards),
      warnings,
    };

    overviewCache = { expiresAt: now + CACHE_TTL_MS, payload };
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      fetchedAt,
      status: "error",
      stockCount: 0,
      alignedDays: null,
      factors: CORRELATION_LAB_FACTORS.map((meta) => ({
        id: meta.id,
        title: meta.title,
        meaning: meta.meaning,
        dataStatus: "no-history" as const,
        proxyLabel: null,
        proxyTicker: null,
        sessionDays: null,
        strongCount: 0,
        inverseCount: 0,
        breakCount: 0,
        strongSamples: [],
        inverseSamples: [],
        breakSamples: [],
        instruments: [],
      })),
      briefingThemes: ["Ошибка загрузки — повторите позже"],
      warnings: [message],
    };
  }
}

export function buildCorrelationLabSourcesResponse(): CorrelationLabSourcesResponse {
  const adapters: CorrelationSourceAdapter[] = [
    {
      id: "moex-candles",
      title: "MOEX ISS · свечи",
      role: "candles",
      status: "connected",
      description: "Дневные close акций TQBR и фьючерсов FORTS для расчёта доходностей.",
      limitation: "Нужно ≥20–60 торговых дней; контракты перекатываются — прокси может меняться.",
    },
    {
      id: "moex-correlations",
      title: "MOEX ISS · correlations",
      role: "correlations",
      status: "planned",
      description: "Проверен публичный ISS — отдельного endpoint корреляций нет; считаем локально по свечам.",
      limitation: "При появлении официального API — сверка, не замена без валидации.",
    },
    {
      id: "cbr-rates",
      title: "CBR / MOEX currency stats",
      role: "reference",
      status: "planned",
      description: "Справочный контекст для рублёвого фактора — ставка, курс, не для corr-матрицы v1.",
      limitation: "Пока не подключено; рубль через Si на MOEX.",
    },
    {
      id: "us-external",
      title: "Внешние источники США",
      role: "external",
      status: "planned",
      description: "S&P / Nasdaq spot — planned/manual; v1 только фьючерсы MOEX если есть в ленте.",
      limitation: "Не подставляем синтетику — честный empty state.",
    },
  ];

  return {
    fetchedAt: new Date().toISOString(),
    adapters,
    warnings: [
      "Корреляции v1 — Pearson по дневным доходностям, окна corr20/corr60.",
      "beta и breakScore — учебные метрики черновика, не торговые сигналы.",
    ],
  };
}
