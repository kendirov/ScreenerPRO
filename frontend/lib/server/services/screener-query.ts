import type { AssetClass, InstrumentDetail, InstrumentHistoryBar, ScreenerMetricSet, ScreenerRow } from "@screenerpro/shared";
import { db } from "@/lib/server/db";
import { classifyStockLiquidity } from "@/lib/server/domain/liquidity";

const screenerRowsCache: { rows: ScreenerRow[]; updatedAt: string | null } = {
  rows: [],
  updatedAt: null,
};

function isDatabaseLockError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("database is locked") || message.includes("socket timeout");
}

function toTradingStatus(value: string | null): "open" | "halted" | "auction" | "closed" | "unknown" {
  if (!value) return "unknown";
  const normalized = value.toLowerCase();
  if (normalized.includes("open")) return "open";
  if (normalized.includes("halt")) return "halted";
  if (normalized.includes("auction")) return "auction";
  if (normalized.includes("close")) return "closed";
  return "unknown";
}

function metricSet(metric: {
  turnoverRatio: number | null;
  volumeRatio: number | null;
  intradayRangePct: number | null;
  gapPct: number | null;
  relativeVolatility20: number | null;
  inPlayScore: number | null;
  isInPlay: boolean;
} | null): ScreenerMetricSet {
  return {
    turnoverRatio: metric?.turnoverRatio ?? null,
    volumeRatio: metric?.volumeRatio ?? null,
    turnoverVsAverage: metric?.turnoverRatio ?? null,
    rangeVsAverage: null,
    tradesVsAverage: null,
    dayRangePct: metric?.intradayRangePct ?? null,
    gapPct: metric?.gapPct ?? null,
    relativeVolatility20d: metric?.relativeVolatility20 ?? null,
    inPlayScore: metric?.inPlayScore ?? null,
    isInPlay: metric?.isInPlay ?? false,
  };
}

export async function getScreenerRows(assetClass: "all" | AssetClass): Promise<ScreenerRow[]> {
  if (!process.env.DATABASE_URL) return screenerRowsCache.rows;
  try {
    const rows = await db.instrument.findMany({
      where: {
        isActive: true,
        ...(assetClass === "all" ? {} : { assetClass }),
      },
      include: {
        snapshots: { orderBy: { snapshotAt: "desc" }, take: 1 },
        screenerMetrics: { orderBy: { asOf: "desc" }, take: 1 },
        dailyBars: { orderBy: { barDate: "desc" }, take: 1 },
      },
      take: 500,
    });

    const normalized = rows
      .map((item) => {
        const snap = item.snapshots[0];
        const lastBar = item.dailyBars[0];
        const lastPrice = snap?.lastPrice ?? lastBar?.close ?? null;
        const previousClose = snap?.previousClose ?? lastBar?.close ?? null;
        return {
          ticker: item.ticker,
          shortName: item.shortName ?? item.ticker,
          assetClass: item.assetClass,
          lastPrice,
          previousClose,
          absoluteChange: snap?.absoluteChange ?? (lastPrice !== null && previousClose !== null ? lastPrice - previousClose : null),
          percentChange: snap?.percentChange ?? null,
          volume: snap?.volume ?? lastBar?.volume ?? null,
          turnover: snap?.turnover ?? lastBar?.turnover ?? null,
          open: snap?.open ?? lastBar?.open ?? null,
          high: snap?.high ?? lastBar?.high ?? null,
          low: snap?.low ?? lastBar?.low ?? null,
          liquidityClass:
            item.assetClass === "stock"
              ? classifyStockLiquidity({ ticker: item.ticker, turnover: snap?.turnover ?? lastBar?.turnover ?? null, tradesCount: null })
              : "unknown",
          tradingStatus: toTradingStatus(snap?.tradingStatus ?? null),
          lotSize: snap?.lotSize ?? item.lotSize,
          updatedAt: (snap?.createdAt ?? lastBar?.barDate ?? new Date()).toISOString(),
          sourceUpdatedAt: snap?.sourceUpdatedAt?.toISOString() ?? null,
          metrics: metricSet(item.screenerMetrics[0] ?? null),
        } satisfies ScreenerRow;
      })
      .filter((item): item is ScreenerRow => item.lastPrice !== null || item.volume !== null || item.turnover !== null);

    if (normalized.length > 0) {
      screenerRowsCache.rows = normalized;
      screenerRowsCache.updatedAt = new Date().toISOString();
      return normalized;
    }
    return screenerRowsCache.rows.length > 0 ? screenerRowsCache.rows : normalized;
  } catch (error) {
    if (isDatabaseLockError(error) && screenerRowsCache.rows.length > 0) {
      return screenerRowsCache.rows;
    }
    return [];
  }
}

export async function getInstrumentDetail(ticker: string): Promise<InstrumentDetail | null> {
  if (!process.env.DATABASE_URL) return null;
  const instrument = await db.instrument.findFirst({
    where: { ticker: ticker.toUpperCase() },
    include: {
      snapshots: { orderBy: { snapshotAt: "desc" }, take: 1 },
      screenerMetrics: { orderBy: { asOf: "desc" }, take: 1 },
    },
  });
  if (!instrument) return null;
  const snap = instrument.snapshots[0] ?? null;
  return {
    ticker: instrument.ticker,
    shortName: instrument.shortName ?? instrument.ticker,
    assetClass: instrument.assetClass,
    board: instrument.board,
    engine: instrument.engine,
    market: instrument.market,
    lotSize: instrument.lotSize,
    tradingStatus: toTradingStatus(snap?.tradingStatus ?? null),
    snapshot: snap
      ? {
          ticker: instrument.ticker,
          shortName: instrument.shortName ?? instrument.ticker,
          assetClass: instrument.assetClass,
          lastPrice: snap.lastPrice,
          previousClose: snap.previousClose,
          absoluteChange: snap.absoluteChange,
          percentChange: snap.percentChange,
          volume: snap.volume,
          turnover: snap.turnover,
          open: snap.open,
          high: snap.high,
          low: snap.low,
          liquidityClass:
            instrument.assetClass === "stock"
              ? classifyStockLiquidity({ ticker: instrument.ticker, turnover: snap.turnover, tradesCount: null })
              : "unknown",
          tradingStatus: toTradingStatus(snap.tradingStatus),
          lotSize: snap.lotSize,
          updatedAt: snap.createdAt.toISOString(),
          sourceUpdatedAt: snap.sourceUpdatedAt?.toISOString() ?? null,
        }
      : null,
    metrics: instrument.screenerMetrics[0] ? metricSet(instrument.screenerMetrics[0]) : null,
  };
}

export async function getInstrumentHistory(ticker: string, limit = 120): Promise<InstrumentHistoryBar[]> {
  if (!process.env.DATABASE_URL) return [];
  const instrument = await db.instrument.findFirst({ where: { ticker: ticker.toUpperCase() }, select: { id: true } });
  if (!instrument) return [];
  const bars = await db.dailyBar.findMany({
    where: { instrumentId: instrument.id, timeframe: "1d" },
    orderBy: { barDate: "desc" },
    take: limit,
  });
  return bars
    .reverse()
    .map((bar) => ({
      date: bar.barDate.toISOString().slice(0, 10),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      turnover: bar.turnover,
    }));
}

export interface ScreenerDiagnostics {
  databaseConfigured: boolean;
  databaseReachable: boolean;
  instrumentsCount: number;
  marketSnapshotsCount: number;
  dailyBarsCount: number;
  screenerMetricsCount: number;
  screenerRowsCount: number;
  lastIngestRun: {
    runType: string;
    status: string;
    finishedAt: string | null;
  } | null;
  fallbackWouldBeUsed: boolean;
  likelyFailureReason: string | null;
  ingestInProgress: boolean;
  dataState: "no_data_initialized" | "ingest_in_progress" | "partial_data_available" | "database_locked" | "real_data_active";
}

export async function getScreenerDiagnostics(): Promise<ScreenerDiagnostics> {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  if (!databaseConfigured) {
    return {
      databaseConfigured: false,
      databaseReachable: false,
      instrumentsCount: 0,
      marketSnapshotsCount: 0,
      dailyBarsCount: 0,
      screenerMetricsCount: 0,
      screenerRowsCount: 0,
      lastIngestRun: null,
      fallbackWouldBeUsed: true,
      likelyFailureReason: "DATABASE_URL missing",
      ingestInProgress: false,
      dataState: "no_data_initialized",
    };
  }

  try {
    const [instrumentsCount, marketSnapshotsCount, dailyBarsCount, screenerMetricsCount, screenerRowsCount, lastRun, runningRuns] = await Promise.all([
      db.instrument.count(),
      db.marketSnapshot.count(),
      db.dailyBar.count(),
      db.screenerMetric.count(),
      db.instrument.count({ where: { isActive: true, OR: [{ snapshots: { some: {} } }, { dailyBars: { some: {} } }] } }),
      db.ingestRun.findFirst({ orderBy: { startedAt: "desc" }, select: { runType: true, status: true, finishedAt: true } }),
      db.ingestRun.count({ where: { status: "running" } }),
    ]);

    const ingestInProgress = runningRuns > 0 || lastRun?.status === "running";
    const fallbackWouldBeUsed = screenerRowsCount === 0 && screenerRowsCache.rows.length === 0;
    let likelyFailureReason: string | null = null;
    if (marketSnapshotsCount === 0 && instrumentsCount > 0) likelyFailureReason = "Universe loaded, but market snapshots are empty";
    if (instrumentsCount === 0) likelyFailureReason = "Instruments are empty, ingest not completed";
    if (lastRun?.status === "failed") likelyFailureReason = "Last ingest run failed";
    if (fallbackWouldBeUsed && !likelyFailureReason) likelyFailureReason = "No active rows for screener";
    if (ingestInProgress && !likelyFailureReason) likelyFailureReason = "Ingest is currently running";

    const dataState: ScreenerDiagnostics["dataState"] =
      screenerRowsCount > 0 ? (ingestInProgress ? "ingest_in_progress" : "real_data_active") : instrumentsCount > 0 || dailyBarsCount > 0 ? "partial_data_available" : "no_data_initialized";

    return {
      databaseConfigured: true,
      databaseReachable: true,
      instrumentsCount,
      marketSnapshotsCount,
      dailyBarsCount,
      screenerMetricsCount,
      screenerRowsCount,
      lastIngestRun: lastRun
        ? {
            runType: lastRun.runType,
            status: lastRun.status,
            finishedAt: lastRun.finishedAt?.toISOString() ?? null,
          }
        : null,
      fallbackWouldBeUsed,
      likelyFailureReason,
      ingestInProgress,
      dataState,
    };
  } catch (error) {
    const dbLocked = isDatabaseLockError(error);
    return {
      databaseConfigured: true,
      databaseReachable: !dbLocked,
      instrumentsCount: 0,
      marketSnapshotsCount: 0,
      dailyBarsCount: 0,
      screenerMetricsCount: 0,
      screenerRowsCount: 0,
      lastIngestRun: null,
      fallbackWouldBeUsed: screenerRowsCache.rows.length === 0,
      likelyFailureReason: error instanceof Error ? error.message : "Database unreachable",
      ingestInProgress: false,
      dataState: dbLocked ? "database_locked" : "no_data_initialized",
    };
  }
}
