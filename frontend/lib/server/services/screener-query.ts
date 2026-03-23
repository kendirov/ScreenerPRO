import type { AssetClass, InstrumentDetail, InstrumentHistoryBar, ScreenerMetricSet, ScreenerRow } from "@screenerpro/shared";
import { db } from "@/lib/server/db";

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
    intradayRangePct: metric?.intradayRangePct ?? null,
    gapPct: metric?.gapPct ?? null,
    relativeVolatility20d: metric?.relativeVolatility20 ?? null,
    inPlayScore: metric?.inPlayScore ?? null,
    isInPlay: metric?.isInPlay ?? false,
  };
}

export async function getScreenerRows(assetClass: "all" | AssetClass): Promise<ScreenerRow[]> {
  if (!process.env.DATABASE_URL) return [];
  const rows = await db.instrument.findMany({
    where: {
      isActive: true,
      ...(assetClass === "all" ? {} : { assetClass }),
    },
    include: {
      snapshots: { orderBy: { snapshotAt: "desc" }, take: 1 },
      screenerMetrics: { orderBy: { asOf: "desc" }, take: 1 },
    },
    take: 500,
  });

  return rows
    .map((item) => {
      const snap = item.snapshots[0];
      if (!snap) return null;
      return {
        ticker: item.ticker,
        shortName: item.shortName ?? item.ticker,
        assetClass: item.assetClass,
        lastPrice: snap.lastPrice,
        previousClose: snap.previousClose,
        absoluteChange: snap.absoluteChange,
        percentChange: snap.percentChange,
        volume: snap.volume,
        turnover: snap.turnover,
        open: snap.open,
        high: snap.high,
        low: snap.low,
        tradingStatus: toTradingStatus(snap.tradingStatus),
        lotSize: snap.lotSize,
        updatedAt: snap.createdAt.toISOString(),
        sourceUpdatedAt: snap.sourceUpdatedAt?.toISOString() ?? null,
        metrics: metricSet(item.screenerMetrics[0] ?? null),
      } satisfies ScreenerRow;
    })
    .filter((item): item is ScreenerRow => item !== null);
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
