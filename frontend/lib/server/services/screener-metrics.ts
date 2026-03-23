import { db } from "@/lib/server/db";
import { computeDerivedMetrics } from "@/lib/server/metrics/engine";

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function computeAndPersistMetrics() {
  const instruments = await db.instrument.findMany({
    where: { isActive: true },
    include: {
      snapshots: { orderBy: { snapshotAt: "desc" }, take: 1 },
      dailyBars: { orderBy: { barDate: "desc" }, take: 25 },
    },
  });

  for (const instrument of instruments) {
    const snapshot = instrument.snapshots[0];
    if (!snapshot) continue;
    const bars = [...instrument.dailyBars].reverse();
    const returns = bars
      .map((bar, idx) => {
        if (idx === 0) return null;
        const prev = bars[idx - 1];
        if (!bar.close || !prev.close || prev.close === 0) return null;
        return ((bar.close - prev.close) / prev.close) * 100;
      })
      .filter((v): v is number => v !== null);

    const volumeBaseline = average(bars.map((b) => b.volume).filter((v): v is number => v !== null));
    const turnoverBaseline = average(bars.map((b) => b.turnover).filter((v): v is number => v !== null));
    const volatility20dBaseline = average(returns.map((v) => Math.abs(v)));

    const metrics = computeDerivedMetrics({
      lastPrice: snapshot.lastPrice,
      previousClose: snapshot.previousClose,
      open: snapshot.open,
      high: snapshot.high,
      low: snapshot.low,
      volume: snapshot.volume,
      turnover: snapshot.turnover,
      volumeBaseline,
      turnoverBaseline,
      volatility20dBaseline,
      dailyReturns20d: returns.slice(-20),
    });

    await db.screenerMetric.upsert({
      where: { instrumentId_asOf: { instrumentId: instrument.id, asOf: snapshot.snapshotAt } },
      update: {
        turnoverRatio: metrics.turnoverRatio,
        volumeRatio: metrics.volumeRatio,
        intradayRangePct: metrics.dayRangePct,
        gapPct: metrics.gapPct,
        relativeVolatility20: metrics.relativeVolatility20d,
        inPlayScore: metrics.inPlayScore,
        isInPlay: metrics.isInPlay,
        notes: "Computed by initial MOEX metrics engine.",
      },
      create: {
        instrumentId: instrument.id,
        asOf: snapshot.snapshotAt,
        turnoverRatio: metrics.turnoverRatio,
        volumeRatio: metrics.volumeRatio,
        intradayRangePct: metrics.dayRangePct,
        gapPct: metrics.gapPct,
        relativeVolatility20: metrics.relativeVolatility20d,
        inPlayScore: metrics.inPlayScore,
        isInPlay: metrics.isInPlay,
        notes: "Computed by initial MOEX metrics engine.",
      },
    });
  }
}
