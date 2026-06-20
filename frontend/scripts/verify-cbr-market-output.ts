/**
 * Smoke tests for constrained CBR market output phrases.
 * Run: pnpm -C frontend verify:cbr-market-output
 */

import {
  buildConstrainedMarketReaction,
  analyzeReplayLiveCoverage,
} from "@/lib/cbr/cbr-replay-market-output";
import {
  CBR_FORBIDDEN_NON_LIVE_PHRASES,
  isForbiddenMarketPhrase,
} from "@/lib/cbr/cbr-replay-market-integrity";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import type { CbrInstrumentReactionMetrics } from "@/lib/domain/cbr-rate-reaction-metrics";

const EVENT = {
  id: "2024-12-20",
  date: "2024-12-20",
  status: "past",
  actualRate: 21,
  previousRate: 21,
  decisionType: "hold",
} as CbrRateEvent;

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

function assertNoForbidden(text: string, msg: string) {
  for (const phrase of CBR_FORBIDDEN_NON_LIVE_PHRASES) {
    assert(!text.toLowerCase().includes(phrase), `${msg} — forbidden «${phrase}»`);
  }
}

// Currency mode: two live currency instruments
{
  const all = [
    metric({ ticker: "USDRUBF", role: "currency", reactionDayPct: 0.35 }),
    metric({ ticker: "CNYRUBF", role: "currency", reactionDayPct: 0.28 }),
  ];
  const coverage = analyzeReplayLiveCoverage(all, "currency");
  assert(coverage.scope === "currency_market", "currency mode currency_market scope");
  const text = buildConstrainedMarketReaction(EVENT, all, all, "currency", null);
  assert(/валют/i.test(text), "currency market read mentions currency");
  assertNoForbidden(text, "currency market output");
}

// Derivatives: only currency live
{
  const all = [
    metric({ ticker: "USDRUBF", role: "currency", reactionDayPct: 0.4 }),
    metric({ ticker: "CNYRUBF", role: "currency", reactionDayPct: 0.3 }),
    metric({ ticker: "MXH5", role: "index", reactionDayPct: 0.1, dataStatus: "fallback" }),
  ];
  const live = all.filter((m) => m.dataStatus === "live");
  const coverage = analyzeReplayLiveCoverage(all, "derivatives");
  assert(coverage.scope === "currency_only", "derivatives currency_only scope");
  const text = buildConstrainedMarketReaction(EVENT, all, live, "derivatives", null);
  assert(text.includes("USDRUBF"), "currency-only mentions USDRUBF");
  assert(text.includes("валютная часть"), "currency-only phrasing");
  assertNoForbidden(text, "currency-only output");
}

// Equities: index live, stocks without MOEX — only 1 live instrument
{
  const all = [
    metric({ ticker: "IMOEX", role: "index", reactionDayPct: -0.2 }),
    metric({ ticker: "SBER", role: "bank", reactionDayPct: 0.2, dataStatus: "fallback" }),
    metric({ ticker: "GAZP", role: "heavy", reactionDayPct: 0.1, dataStatus: "fallback" }),
  ];
  const live = all.filter((m) => m.dataStatus === "live");
  const text = buildConstrainedMarketReaction(EVENT, all, live, "equities", null);
  assert(text.includes("≥ 2"), "single live instrument blocks market read");
  assertNoForbidden(text, "equities partial");
}

// Min 2 live instruments required
{
  const all = [metric({ ticker: "IMOEX", role: "index", reactionDayPct: -0.2 })];
  const text = buildConstrainedMarketReaction(EVENT, all, all, "equities", null);
  assert(text.includes("≥ 2"), "one instrument blocks conclusion");
}

// Equities: bank beat index all live
{
  const all = [
    metric({ ticker: "IMOEX", role: "index", reactionDayPct: -0.25 }),
    metric({ ticker: "SBER", role: "bank", reactionDayPct: 0.15 }),
    metric({ ticker: "GAZP", role: "heavy", reactionDayPct: 0.05 }),
  ];
  const text = buildConstrainedMarketReaction(EVENT, all, all, "equities", null);
  assert(text.includes("IMOEX снизился"), "bank beat index narrative");
  assert(text.includes("SBER держался лучше индекса"), "bank beat index narrative");
  assertNoForbidden(text, "bank beat all live");
}

assert(!isForbiddenMarketPhrase("IMOEX снизился"), "neutral phrase allowed");

console.log("\nAll CBR market output checks passed.");
