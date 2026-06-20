/**
 * Smoke tests for getReplayDataQuality guard.
 * Run: pnpm -C frontend verify:cbr-replay-data-quality
 */

import {
  getReplayDataQuality,
  type CbrReplayQualityInstrument,
} from "@/lib/cbr/cbr-replay-data-quality";

const EVENT_DATE = "2024-12-20";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

function candleAt(date: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const time = Math.floor(
    new Date(
      `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`,
    ).getTime() / 1000,
  );
  return { time, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 };
}

function candlesAroundDecision(date: string): ReturnType<typeof candleAt>[] {
  return ["10:00", "13:00", "13:30", "14:00", "16:00"].map((t) => candleAt(date, t));
}

function inst(
  partial: Partial<CbrReplayQualityInstrument> &
    Pick<CbrReplayQualityInstrument, "slotId" | "ticker">,
): CbrReplayQualityInstrument {
  return {
    dataStatus: "live",
    candles: candlesAroundDecision(EVENT_DATE),
    ...partial,
  };
}

// no_data — нет свечей ни по одному инструменту
{
  const q = getReplayDataQuality(
    { date: EVENT_DATE },
    [
      inst({ slotId: "equity-index", ticker: "IMOEX", candles: [], dataStatus: "mock" }),
      inst({ slotId: "sber", ticker: "SBER", candles: [] }),
    ],
    "equities",
  );
  assert(q.quality === "no_data", "no_data when zero live instruments");
  assert(q.showEmptyState, "no_data → empty state");
}

// insufficient — нет benchmark
{
  const q = getReplayDataQuality(
    { date: EVENT_DATE },
    [inst({ slotId: "sber", ticker: "SBER" }), inst({ slotId: "gazp", ticker: "GAZP" })],
    "equities",
  );
  assert(q.quality === "insufficient", "insufficient without benchmark");
  assert(!q.canBuildConclusions, "insufficient blocks conclusions");
}

// insufficient — нет свечей около 13:30
{
  const earlyOnly = ["10:00", "10:05", "10:10"].map((t) => candleAt(EVENT_DATE, t));
  const q = getReplayDataQuality(
    { date: EVENT_DATE },
    [
      inst({ slotId: "equity-index", ticker: "IMOEX", candles: earlyOnly }),
      inst({ slotId: "sber", ticker: "SBER", candles: earlyOnly }),
    ],
    "equities",
  );
  assert(q.quality === "insufficient", "insufficient without 13:30 coverage");
}

// insufficient — live < 2
{
  const q = getReplayDataQuality(
    { date: EVENT_DATE },
    [inst({ slotId: "equity-index", ticker: "IMOEX" })],
    "equities",
  );
  assert(q.quality === "insufficient", "insufficient with only benchmark");
}

// partial_moex — benchmark + 2 инструмента
{
  const q = getReplayDataQuality(
    { date: EVENT_DATE },
    [
      inst({ slotId: "equity-index", ticker: "IMOEX" }),
      inst({ slotId: "sber", ticker: "SBER" }),
    ],
    "equities",
  );
  assert(q.quality === "partial_moex", "partial with benchmark + 1 peer (2 live)");
  assert(q.canBuildLimitedReplay, "partial allows limited replay");
  assert(q.canBuildConclusions, "partial allows limited conclusions");
}

// full_moex — benchmark + ≥3
{
  const q = getReplayDataQuality(
    { date: EVENT_DATE },
    [
      inst({ slotId: "equity-index", ticker: "IMOEX" }),
      inst({ slotId: "sber", ticker: "SBER" }),
      inst({ slotId: "gazp", ticker: "GAZP" }),
    ],
    "equities",
  );
  assert(q.quality === "full_moex", "full with benchmark + 3 live");
  assert(q.canBuildFullReplay, "full allows normal replay");
}

// demo/mock не считаются
{
  const q = getReplayDataQuality(
    { date: EVENT_DATE },
    [
      inst({ slotId: "equity-index", ticker: "IMOEX", dataStatus: "fallback" }),
      inst({ slotId: "sber", ticker: "SBER", dataStatus: "live" }),
      inst({ slotId: "gazp", ticker: "GAZP", dataStatus: "live" }),
    ],
    "equities",
  );
  assert(q.quality === "insufficient", "fallback benchmark → insufficient (no benchmark)");
}

// currency mode — full при 2 live
{
  const q = getReplayDataQuality(
    { date: EVENT_DATE },
    [
      inst({ slotId: "usd-rub", ticker: "Si" }),
      inst({ slotId: "cny-rub", ticker: "CNY" }),
    ],
    "currency",
  );
  assert(q.quality === "full_moex", "currency full with 2 live legs");
}

console.log("\nAll getReplayDataQuality checks passed.");
