/**
 * Smoke tests for CBR replay consistency guard.
 * Run: pnpm -C frontend exec tsx scripts/verify-cbr-replay-consistency.ts
 */

import { getEventWindow } from "@/lib/domain/cbr-rate-event-window";
import type { CbrChartSlot } from "@/lib/domain/cbr-rate-chart-model";
import {
  CBR_EQUITY_DIVERGENCE_READ_ALL_REAL,
  CBR_EQUITY_DIVERGENCE_READ_DEMO,
  CBR_REPLAY_CONSISTENCY_STATUS_LINES,
  validateReplayConsistency,
  type CbrReplayChartSeries,
} from "@/lib/cbr/cbr-replay-consistency";
import type { CbrInstrumentReactionMetrics } from "@/lib/domain/cbr-rate-reaction-metrics";

const EVENT = { id: "2024-12-20", date: "2024-12-20" };
const WINDOW = getEventWindow(EVENT.date);

function slot(
  partial: Partial<CbrChartSlot> & Pick<CbrChartSlot, "id" | "ticker">,
): CbrChartSlot {
  return {
    title: partial.ticker,
    secid: partial.ticker,
    placeholder: false,
    dataStatus: "live",
    candles: [],
    ...partial,
  };
}

function candleAt(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return Math.floor(new Date(`2024-12-20T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+03:00`).getTime() / 1000);
}

function series(slots: CbrChartSlot[]): CbrReplayChartSeries {
  return {
    eventId: EVENT.id,
    eventDate: EVENT.date,
    replayMode: "equities",
    window: WINDOW,
    slots,
  };
}

function metric(
  partial: Partial<CbrInstrumentReactionMetrics> &
    Pick<CbrInstrumentReactionMetrics, "ticker" | "role">,
): CbrInstrumentReactionMetrics {
  return {
    title: partial.ticker,
    dataStatus: "live",
    reactionStatus: "ok",
    reactionReason: null,
    reaction5mPct: null,
    reaction30mPct: null,
    reactionPostPressPct: null,
    reactionDayPct: null,
    dayRangePct: null,
    volumeRatio: null,
    windowReturns: {},
    windowVolumes: {},
    pattern: null,
    patternLabel: null,
    traderRead: null,
    ...partial,
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

// 1. Same date + aligned windows → consistent
{
  const candles = [
    { time: candleAt("10:00"), open: 1, high: 1, low: 1, close: 1 },
    { time: candleAt("18:45"), open: 1, high: 1, low: 1, close: 1 },
  ];
  const slots = [
    slot({ id: "equity-index", ticker: "IMOEX", candles, dataStatus: "live" }),
    slot({ id: "sber", ticker: "SBER", candles, dataStatus: "live" }),
    slot({ id: "gazp", ticker: "GAZP", candles, dataStatus: "live" }),
  ];
  const metrics = [
    metric({ ticker: "IMOEX", role: "index", reactionDayPct: 0.2 }),
    metric({ ticker: "SBER", role: "bank", reactionDayPct: 0.1 }),
    metric({ ticker: "GAZP", role: "heavy", reactionDayPct: 0.1 }),
  ];
  const r = validateReplayConsistency(EVENT, series(slots), metrics);
  assert(r.status === "consistent_moex", "aligned MOEX → consistent");
  assert(r.checks.sameEventDate, "same event date");
  assert(r.checks.windowsAligned, "windows aligned");
}

// 2. MOEX + DEMO mixed
{
  const candles = [
    { time: candleAt("10:00"), open: 1, high: 1, low: 1, close: 1 },
    { time: candleAt("18:45"), open: 1, high: 1, low: 1, close: 1 },
  ];
  const slots = [
    slot({ id: "equity-index", ticker: "IMOEX", candles, dataStatus: "live" }),
    slot({ id: "sber", ticker: "SBER", candles, dataStatus: "fallback" }),
    slot({ id: "gazp", ticker: "GAZP", candles, dataStatus: "live" }),
  ];
  const metrics = [
    metric({ ticker: "IMOEX", role: "index", reactionDayPct: 0.2, dataStatus: "live" }),
    metric({ ticker: "SBER", role: "bank", reactionDayPct: 0.1, dataStatus: "fallback" }),
    metric({ ticker: "GAZP", role: "heavy", reactionDayPct: 0.1, dataStatus: "live" }),
  ];
  const r = validateReplayConsistency(EVENT, series(slots), metrics);
  assert(r.status === "partial_moex", "index live + mixed stocks live/demo → partial");
  assert(
    r.statusLine === CBR_REPLAY_CONSISTENCY_STATUS_LINES.partial_moex,
    "partial status line",
  );
}

// 2b. True MOEX+DEMO block — нет безопасного partial-read
{
  const candles = [
    { time: candleAt("10:00"), open: 1, high: 1, low: 1, close: 1 },
    { time: candleAt("18:45"), open: 1, high: 1, low: 1, close: 1 },
  ];
  const slots = [
    slot({ id: "usd-rub", ticker: "USDRUBF", candles, dataStatus: "fallback" }),
    slot({ id: "cny-rub", ticker: "CNYRUBF", candles, dataStatus: "fallback" }),
    slot({ id: "mx-futures", ticker: "MXH5", candles, dataStatus: "live" }),
  ];
  const metrics = [
    metric({ ticker: "USDRUBF", role: "currency", dataStatus: "fallback" }),
    metric({ ticker: "CNYRUBF", role: "currency", dataStatus: "fallback" }),
    metric({ ticker: "MXH5", role: "index", reactionDayPct: 0.2, dataStatus: "live" }),
  ];
  const seriesDeriv = {
    eventId: EVENT.id,
    eventDate: EVENT.date,
    replayMode: "derivatives" as const,
    window: WINDOW,
    slots,
  };
  const r = validateReplayConsistency(EVENT, seriesDeriv, metrics);
  assert(r.status === "demo_mixed", "mx live + currency demo without partial path → demo_mixed");
}

// 3. Index real, stocks demo → no compare
{
  const candles = [
    { time: candleAt("10:00"), open: 1, high: 1, low: 1, close: 1 },
    { time: candleAt("18:45"), open: 1, high: 1, low: 1, close: 1 },
  ];
  const slots = [
    slot({ id: "equity-index", ticker: "IMOEX", candles, dataStatus: "live" }),
    slot({ id: "sber", ticker: "SBER", candles, dataStatus: "fallback" }),
    slot({ id: "gazp", ticker: "GAZP", candles, dataStatus: "fallback" }),
  ];
  const metrics = [
    metric({ ticker: "IMOEX", role: "index", reactionDayPct: -0.3, dataStatus: "live" }),
    metric({ ticker: "SBER", role: "bank", reactionDayPct: 0.2, dataStatus: "fallback" }),
    metric({ ticker: "GAZP", role: "heavy", reactionDayPct: 0.15, dataStatus: "fallback" }),
  ];
  const r = validateReplayConsistency(EVENT, series(slots), metrics);
  assert(!r.constraints.canCompareStocksToIndex, "index real + stocks demo blocks compare");
}

// 4. SBER/GAZP up, IMOEX down — all real
{
  const metrics = [
    metric({ ticker: "IMOEX", role: "index", reactionDayPct: -0.2 }),
    metric({ ticker: "SBER", role: "bank", reactionDayPct: 0.3 }),
    metric({ ticker: "GAZP", role: "heavy", reactionDayPct: 0.25 }),
  ];
  const r = validateReplayConsistency(EVENT, null, metrics);
  assert(
    r.equityDivergenceRead === CBR_EQUITY_DIVERGENCE_READ_ALL_REAL,
    "divergence all real read",
  );
}

// 5. SBER/GAZP up, IMOEX down — with demo
{
  const metrics = [
    metric({ ticker: "IMOEX", role: "index", reactionDayPct: -0.2, dataStatus: "live" }),
    metric({ ticker: "SBER", role: "bank", reactionDayPct: 0.3, dataStatus: "fallback" }),
    metric({ ticker: "GAZP", role: "heavy", reactionDayPct: 0.25, dataStatus: "live" }),
  ];
  const r = validateReplayConsistency(EVENT, null, metrics);
  assert(
    r.equityDivergenceRead === CBR_EQUITY_DIVERGENCE_READ_DEMO,
    "divergence with demo read",
  );
}

// 6. MX futures label
{
  const r = validateReplayConsistency(
    EVENT,
    {
      eventId: EVENT.id,
      eventDate: EVENT.date,
      replayMode: "derivatives",
      window: WINDOW,
      slots: [slot({ id: "mx-futures", ticker: "MXH5" })],
    },
    [],
  );
  assert(r.constraints.indexLabel === "фьючерс на индекс", "derivatives index label");
}

console.log("\nAll CBR replay consistency checks passed.");
