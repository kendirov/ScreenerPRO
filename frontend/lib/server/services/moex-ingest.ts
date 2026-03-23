import { AssetClass } from "@prisma/client";
import { db } from "@/lib/server/db";
import { logError, logInfo } from "@/lib/server/logging";
import { moexGetJson } from "@/lib/server/integrations/moex/client";
import { historyUrl, listSecuritiesUrl, marketDataUrl } from "@/lib/server/integrations/moex/endpoints";
import { mapHistoryBars, mapSnapshots, mapUniverseRows } from "@/lib/server/integrations/moex/mappers";
import { moexPayloadSchema } from "@/lib/server/integrations/moex/validators";
import { computeAndPersistMetrics } from "@/lib/server/services/screener-metrics";
import { failIngestRun, finishIngestRun, startIngestRun } from "@/lib/server/services/ingest-runs";

const CLASSES: ("stock" | "future")[] = ["stock", "future"];

export async function syncUniverse() {
  const run = await startIngestRun("universe");
  try {
    let upserted = 0;
    for (const assetClass of CLASSES) {
      const payload = moexPayloadSchema.parse(await moexGetJson(listSecuritiesUrl(assetClass), 30));
      const securities = payload.securities;
      if (!securities) continue;
      const normalized = mapUniverseRows(assetClass, securities.columns, securities.data);
      for (const row of normalized) {
        const instrument = await db.instrument.upsert({
          where: { stableKey: row.stableKey },
          update: {
            ticker: row.ticker,
            shortName: row.shortName,
            secid: row.secid,
            board: row.board,
            engine: row.engine,
            market: row.market,
            lotSize: row.lotSize ? Math.trunc(row.lotSize) : null,
            isActive: row.isActive,
            lastSeenAt: new Date(),
          },
          create: {
            stableKey: row.stableKey,
            ticker: row.ticker,
            shortName: row.shortName,
            assetClass: row.assetClass as AssetClass,
            secid: row.secid,
            board: row.board,
            engine: row.engine,
            market: row.market,
            lotSize: row.lotSize ? Math.trunc(row.lotSize) : null,
            isActive: row.isActive,
          },
        });

        await db.instrumentSource.upsert({
          where: { source_sourceEntityId: { source: "moex", sourceEntityId: row.sourceEntityId } },
          update: { rawMetadata: row.rawMetadata },
          create: {
            instrumentId: instrument.id,
            source: "moex",
            sourceEntityId: row.sourceEntityId,
            rawMetadata: row.rawMetadata,
          },
        });
        upserted++;
      }
    }
    await finishIngestRun(run.id, { upserted });
    logInfo("Universe sync completed", { upserted });
    return { upserted };
  } catch (error) {
    await failIngestRun(run.id, error);
    logError("Universe sync failed", error);
    throw error;
  }
}

export async function ingestSnapshots() {
  const run = await startIngestRun("snapshots");
  try {
    let inserted = 0;
    for (const assetClass of CLASSES) {
      const payload = moexPayloadSchema.parse(await moexGetJson(marketDataUrl(assetClass), 5));
      const securities = payload.securities;
      const marketdata = payload.marketdata;
      if (!securities || !marketdata) continue;
      const snapshots = mapSnapshots(securities.columns, securities.data, marketdata.columns, marketdata.data);
      for (const snapshot of snapshots) {
        const instrument = await db.instrument.findFirst({ where: { ticker: snapshot.ticker } });
        if (!instrument) continue;
        const now = new Date();
        await db.marketSnapshot.upsert({
          where: { instrumentId_snapshotAt: { instrumentId: instrument.id, snapshotAt: now } },
          update: {},
          create: {
            instrumentId: instrument.id,
            source: "moex",
            snapshotAt: now,
            sourceUpdatedAt: snapshot.sourceUpdatedAt,
            lastPrice: snapshot.lastPrice,
            previousClose: snapshot.previousClose,
            absoluteChange: snapshot.absoluteChange,
            percentChange: snapshot.percentChange,
            volume: snapshot.volume,
            turnover: snapshot.turnover,
            open: snapshot.open,
            high: snapshot.high,
            low: snapshot.low,
            tradingStatus: snapshot.tradingStatus,
            lotSize: snapshot.lotSize ? Math.trunc(snapshot.lotSize) : null,
            rawPayload: snapshot.rawPayload,
          },
        });
        inserted++;
      }
    }
    await computeAndPersistMetrics();
    await finishIngestRun(run.id, { inserted });
    return { inserted };
  } catch (error) {
    await failIngestRun(run.id, error);
    throw error;
  }
}

export async function ingestDailyBars(days = 120) {
  const run = await startIngestRun("daily-bars");
  try {
    const instruments = await db.instrument.findMany({
      where: { isActive: true },
      select: { id: true, ticker: true },
      take: 80,
    });
    const from = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
    let bars = 0;
    for (const instrument of instruments) {
      const payload = moexPayloadSchema.parse(await moexGetJson(historyUrl(instrument.ticker, from)));
      const history = payload.history;
      if (!history) continue;
      const normalized = mapHistoryBars(history.columns, history.data);
      for (const bar of normalized) {
        await db.dailyBar.upsert({
          where: { instrumentId_timeframe_barDate: { instrumentId: instrument.id, timeframe: "1d", barDate: bar.date } },
          update: {
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            turnover: bar.turnover,
            rawPayload: bar.rawPayload,
          },
          create: {
            instrumentId: instrument.id,
            timeframe: "1d",
            barDate: bar.date,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            turnover: bar.turnover,
            source: "moex",
            rawPayload: bar.rawPayload,
          },
        });
        bars++;
      }
    }
    await computeAndPersistMetrics();
    await finishIngestRun(run.id, { bars });
    return { bars };
  } catch (error) {
    await failIngestRun(run.id, error);
    throw error;
  }
}
