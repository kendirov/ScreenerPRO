/**
 * QA Perpetual Leverage Lab calculator — pnpm -C frontend verify:perpetual-calculator
 */
import {
  buildLeverageImpactCards,
  computeLiquidationSimulator,
  computePerpetualCalculator,
  computeLiquidationMapMetrics,
  computePositionDiagnostics,
  computeRiskLadderPrices,
  computeTakeProfitPercent,
  DEFAULT_SIMULATOR_STOP_PERCENT,
  DEFAULT_SIMULATOR_TAKE_PROFIT_R,
  getLeverageChipInsight,
  getLeverageDynamicInsight,
  getLeverageLadderPhrase,
  getLeverageMetricsVisualTier,
  type PerpetualCalculatorInput,
} from "../lib/domain/perpetual-leverage";
import { buildPriceRiskScaleLayout } from "../lib/domain/price-risk-scale-layout";
import { buildRiskLadderLayout } from "../lib/domain/risk-ladder-layout";
import {
  buildEducationalRiskLadderLayout,
  buildTypographicRiskLadderLayout,
  educationalDangerIntensity,
} from "../lib/domain/typographic-risk-ladder-layout";
import {
  buildHonestAxisTicks,
  buildHonestLevelLines,
  buildHonestPriceScale,
  ENTRY_ANCHOR_Y_PCT,
  entryLiquidationVisualGapYPct,
  getRiskFocusSpans,
  priceToHonestYPct,
  resolveLevelLabelPlacements,
  labelMinGapPctForLeverage,
} from "../lib/domain/honest-price-ladder-scale";
import {
  getLeverage50xWarning,
  getLiquidationLineVisualTier,
  LEVERAGE_50X_WARNING,
} from "../lib/domain/leverage-micro-interaction";
import {
  buildLiquidationGhostLines,
  ghostMatchesLiquidationPrice,
  liquidationPercentFromEntry,
} from "../lib/domain/liquidation-ghost-lines";
import {
  computePositionAutoDiagnosis,
  POSITION_AUTO_DIAG,
} from "../lib/domain/position-auto-diagnosis";
import {
  buildLeverageSpaceCompressionItems,
  formatLeverageMoveInsightPhrase,
  getLeverageLiquidationMovePercent,
  snapLeverageSpaceCompressionStep,
} from "../lib/domain/leverage-space-compression";
import {
  buildPriceLadderAnchors,
  computePriceLadderPnL,
  getPriceMarkerStatus,
  priceToEducationalYPct,
} from "../lib/domain/price-ladder";
import { PERPETUAL_LEVERAGE_QUIZ, isQuizAnswerCorrect } from "../lib/domain/perpetual-leverage-quiz";

function assertClose(actual: number, expected: number, label: string, eps = 1e-6) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function runCase(name: string, input: PerpetualCalculatorInput, expected: Partial<ReturnType<typeof computePerpetualCalculator>>) {
  const result = computePerpetualCalculator(input);
  for (const [key, value] of Object.entries(expected)) {
    const actual = result[key as keyof typeof result];
    if (typeof value === "number" && typeof actual === "number") {
      assertClose(actual, value, `${name}.${key}`);
    }
  }
  console.log(`  ✓ ${name}`);
}

console.log("verify-perpetual-calculator");

runCase(
  "baseline long 10x",
  {
    deposit: 100,
    entryPrice: 100,
    leverage: 10,
    direction: "long",
    stopPercent: 1,
    takerFee: 0.055,
    makerFee: 0.055,
    fundingRate: 0.01,
    fundingPeriods: 1,
    marginMode: "isolated",
  },
  {
    positionSize: 1000,
    margin: 100,
    liquidationPrice: 90,
    stopPrice: 99,
    lossAtStop: 10,
    feeRoundTrip: 1.1,
    fundingCost: 0.1,
    totalEstimatedCost: 11.2,
    liquidationDistancePercent: 10,
  },
);

runCase(
  "short 5x",
  {
    deposit: 100,
    entryPrice: 100,
    leverage: 5,
    direction: "short",
    stopPercent: 2,
    takerFee: 0.055,
    makerFee: 0.055,
    fundingRate: 0.01,
    fundingPeriods: 2,
    marginMode: "isolated",
  },
  {
    positionSize: 500,
    liquidationPrice: 120,
    stopPrice: 102,
    lossAtStop: 10,
    liquidationDistancePercent: 20,
  },
);

const highLev = computePerpetualCalculator({
  deposit: 100,
  entryPrice: 100,
  leverage: 20,
  direction: "long",
  stopPercent: 1,
  takerFee: 0.055,
  makerFee: 0.02,
  fundingRate: 0.01,
  fundingPeriods: 1,
  marginMode: "isolated",
});
if (!highLev.warnings.some((w) => w.id === "high-leverage")) {
  throw new Error("expected high-leverage warning at 20x");
}
console.log("  ✓ high-leverage warning");

const nearStop = computePerpetualCalculator({
  deposit: 100,
  entryPrice: 100,
  leverage: 10,
  direction: "long",
  stopPercent: 8,
  takerFee: 0.055,
  makerFee: 0.02,
  fundingRate: 0.01,
  fundingPeriods: 1,
  marginMode: "isolated",
});
if (!nearStop.warnings.some((w) => w.id === "stop-near-liquidation")) {
  throw new Error("expected stop-near-liquidation warning (8% stop vs 10% liq)");
}
console.log("  ✓ stop-near-liquidation warning");

const longLayout = buildPriceRiskScaleLayout({
  entryPrice: 100,
  stopPrice: 99,
  liquidationPrice: 90,
  direction: "long",
  leverage: 10,
  liquidationDistancePercent: 10,
});
if (longLayout.liqPct >= longLayout.entryPct) {
  throw new Error("long: liquidation should be left of entry on scale");
}
if (longLayout.profitZone.leftPct < longLayout.entryPct) {
  throw new Error("long: profit zone should start at entry");
}
console.log("  ✓ price-risk-scale long layout");

const shortLayout = buildPriceRiskScaleLayout({
  entryPrice: 100,
  stopPrice: 102,
  liquidationPrice: 120,
  direction: "short",
  leverage: 5,
  liquidationDistancePercent: 20,
});
if (shortLayout.liqPct <= shortLayout.entryPct) {
  throw new Error("short: liquidation should be right of entry on scale");
}
console.log("  ✓ price-risk-scale short layout");

const tight50x = buildPriceRiskScaleLayout({
  entryPrice: 100,
  stopPrice: 99.5,
  liquidationPrice: 98,
  direction: "long",
  leverage: 50,
  liquidationDistancePercent: 2,
});
if (!tight50x.tightLiquidation || tight50x.liqGlowStrength <= 0) {
  throw new Error("expected tight liquidation glow at 50x");
}
console.log("  ✓ price-risk-scale tight 50x glow");

const ladderLong = computeRiskLadderPrices({ leverage: 10, direction: "long" });
const riskLadderLong = buildRiskLadderLayout({
  ...ladderLong,
  direction: "long",
});
const longIds = riskLadderLong.markers.map((m) => m.id);
if (longIds[0] !== "take" || longIds[longIds.length - 1] !== "liquidation") {
  throw new Error("long ladder order should be TP → Entry → Stop → Liq");
}
if (ladderLong.stopPrice <= ladderLong.liquidationPrice) {
  throw new Error("long: stop must be above liquidation");
}
if (ladderLong.takeProfitPrice <= ladderLong.entryPrice) {
  throw new Error("long: TP must be above entry");
}
const tpPct = computeTakeProfitPercent(DEFAULT_SIMULATOR_STOP_PERCENT, DEFAULT_SIMULATOR_TAKE_PROFIT_R);
if (tpPct !== 2) throw new Error("default 1% stop 2R should yield 2% TP");
const ladder2r = computeRiskLadderPrices({ leverage: 10, direction: "long", stopPercent: 1, takeProfitR: 2 });
if (Math.abs(ladder2r.takeProfitPrice - 102) > 1e-9) throw new Error("long 1% stop 2R TP should be 102");

const ladderShort = computeRiskLadderPrices({ leverage: 10, direction: "short" });
const riskLadderShort = buildRiskLadderLayout({
  ...ladderShort,
  direction: "short",
});
const shortIds = riskLadderShort.markers.map((m) => m.id);
if (shortIds[0] !== "liquidation" || shortIds[shortIds.length - 1] !== "take") {
  throw new Error("short ladder order should be Liq → Stop → Entry → TP");
}
if (ladderShort.liquidationPrice <= ladderShort.stopPrice) {
  throw new Error("short: liq must be above stop");
}
console.log("  ✓ vertical risk ladder long/short");

const eduLong = buildEducationalRiskLadderLayout({
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 97.5,
  direction: "long",
  liquidationInactive: false,
  riskPercent: 1,
  takeProfitR: 2,
  liquidationDistancePercent: 2.5,
  leverage: 40,
  airAfterStop: 1.5,
});
const eduLongIds = eduLong.slots.filter((s) => s.kind === "level").map((s) => s.id);
if (eduLongIds.join(",") !== "take,entry,stop,liquidation") {
  throw new Error(`educational long slot order: ${eduLongIds.join(",")}`);
}
const airSlot = eduLong.slots.find((s) => s.kind === "air");
if (!airSlot || airSlot.kind !== "air" || Math.abs(airSlot.airAfterStop - 1.5) > 0.01) {
  throw new Error("educational long: air segment 1.5%");
}
const eduShort = buildEducationalRiskLadderLayout({
  entryPrice: 100,
  takeProfitPrice: 98,
  stopPrice: 101,
  liquidationPrice: 102.5,
  direction: "short",
  liquidationInactive: false,
  riskPercent: 1,
  takeProfitR: 2,
  liquidationDistancePercent: 2.5,
  leverage: 40,
  airAfterStop: 1.5,
});
const eduShortIds = eduShort.slots.filter((s) => s.kind === "level").map((s) => s.id);
if (eduShortIds.join(",") !== "liquidation,stop,entry,take") {
  throw new Error(`educational short slot order: ${eduShortIds.join(",")}`);
}
const int10 = educationalDangerIntensity(10, 10);
const int40 = educationalDangerIntensity(40, 2.5);
if (int40 <= int10) throw new Error("40x should have higher danger intensity than 10x");
const typoCompat = buildTypographicRiskLadderLayout({
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 96,
  direction: "long",
  liquidationInactive: false,
  riskPercent: 1,
  takeProfitR: 2,
  liquidationDistancePercent: 4,
  leverage: 10,
  airAfterStop: 3,
});
if (typoCompat.levels.length < 4) throw new Error("typographic compat levels");
console.log("  ✓ educational risk ladder");

const scenario40 = computeLiquidationMapMetrics({
  deposit: 100,
  leverage: 40,
  direction: "long",
  stopPercent: 1,
  takeProfitR: 2,
});
if (Math.abs(scenario40.positionSize - 4000) > 1) throw new Error("40x position 4000");
if (Math.abs(scenario40.liquidationDistancePercent - 2.5) > 0.05) throw new Error("40x liq 2.5%");
if (Math.abs(scenario40.airAfterStop - 1.5) > 0.05) throw new Error("40x air 1.5%");
if (Math.abs(scenario40.takeProfitPercent - 2) > 0.05) throw new Error("40x tp 2%");
console.log("  ✓ scenario leverage 40 long");

const anchors40 = buildPriceLadderAnchors({
  direction: "long",
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 97.5,
  liquidationInactive: false,
});
const entryY = priceToEducationalYPct(100, anchors40);
if (Math.abs(entryY - 34) > 0.5) throw new Error("entry price should map to entry slot Y");
const pnl40 = computePriceLadderPnL({
  direction: "long",
  entryPrice: 100,
  currentPrice: 102,
  leverage: 40,
  deposit: 100,
});
if (Math.abs(pnl40.pnlPercent - 80) > 0.5) throw new Error("pnl at TP ~80%");
const liq = 97.5;
if (
  getPriceMarkerStatus({
    direction: "long",
    currentPrice: liq,
    entryPrice: 100,
    stopPrice: 99,
    liquidationPrice: liq,
    liquidationInactive: false,
  }) !== "liquidated"
) {
  throw new Error("at liq price status liquidated");
}
if (
  getPriceMarkerStatus({
    direction: "long",
    currentPrice: 97.6,
    entryPrice: 100,
    stopPrice: 99,
    liquidationPrice: liq,
    liquidationInactive: false,
  }) !== "danger_zone"
) {
  throw new Error("just above liq = danger");
}
if (
  getPriceMarkerStatus({
    direction: "long",
    currentPrice: 98.5,
    entryPrice: 100,
    stopPrice: 99,
    liquidationPrice: liq,
    liquidationInactive: false,
  }) !== "stop_should_trigger"
) {
  throw new Error("between stop and liq band = stop should trigger");
}
if (
  getPriceMarkerStatus({
    direction: "long",
    currentPrice: 100.5,
    entryPrice: 100,
    stopPrice: 99,
    liquidationPrice: liq,
    liquidationInactive: false,
  }) !== "profit_zone"
) {
  throw new Error("above entry = profit");
}
console.log("  ✓ price ladder anchors, pnl, status");

const diag = computePositionDiagnostics({ deposit: 100, leverage: 25, stopPercent: 1 });
if (diag.positionSize !== 2500) throw new Error("diag position 2500");
if (Math.abs(diag.roundTripFeeUsd - 2500 * 0.055 * 2 / 100) > 0.01) {
  throw new Error("diag fee round trip");
}
if (diag.riskTier !== "high") throw new Error("25x = high risk");
const diag30 = computePositionDiagnostics({ deposit: 100, leverage: 30, stopPercent: 1 });
if (diag30.riskTier !== "extreme") throw new Error("30x = extreme risk");
if (!diag.mainAlert.includes("4%") && !diag.mainAlert.includes("4.00%")) {
  throw new Error("main alert includes liq distance");
}
if (diag.stopPrice <= diag.liquidationPrice) throw new Error("diag long stop must be above liq");
const diagInvalid = computePositionDiagnostics({ deposit: 100, leverage: 50, stopPercent: 3 });
if (diagInvalid.autoDiagnosis.severity !== "error") {
  throw new Error("stop beyond liq error");
}
const autoOk = computePositionAutoDiagnosis({
  deposit: 100,
  leverage: 10,
  stopPercent: 1,
  direction: "long",
});
if (autoOk.severity !== "ok" || autoOk.lines[0] !== POSITION_AUTO_DIAG.ok) {
  throw new Error("auto diag ok scheme");
}
const autoShort = computePositionAutoDiagnosis({
  deposit: 100,
  leverage: 50,
  stopPercent: 3,
  direction: "short",
});
if (!autoShort.lines[0].includes("ликвидация наступит раньше")) {
  throw new Error("short stop beyond liq");
}
const autoBuffer = computePositionAutoDiagnosis({
  deposit: 100,
  leverage: 10,
  stopPercent: 9.2,
  direction: "long",
});
if (!autoBuffer.lines.some((l) => l.includes("Запас после стопа"))) {
  throw new Error("small buffer warning");
}
const autoStopLoss = computePositionAutoDiagnosis({
  deposit: 100,
  leverage: 10,
  stopPercent: 2,
  direction: "long",
});
if (!autoStopLoss.lines.some((l) => l.includes("10% депозита"))) {
  throw new Error("stop loss > 10% deposit");
}
console.log("  ✓ position diagnostics");
console.log("  ✓ position auto-diagnosis");

const compression = buildLeverageSpaceCompressionItems();
if (compression.length !== 6) throw new Error("compression steps count");
const byLev = Object.fromEntries(compression.map((c) => [c.leverage, c]));
if (byLev[2].movePercent !== 50) throw new Error("compression 2x percent");
if (byLev[5].movePercent !== 20 || byLev[10].movePercent !== 10) {
  throw new Error("compression 5x/10x percent");
}
if (byLev[20].movePercent !== 5 || byLev[50].movePercent !== 2) {
  throw new Error("compression 20x/50x percent");
}
if (byLev[1].movePercent != null) throw new Error("1x no liq percent");
if (!byLev[1].moveLabel.includes("неактуальна")) throw new Error("1x label");
if (byLev[50].gapVisual >= byLev[5].gapVisual) throw new Error("50x gap smaller than 5x");
if (byLev[50].visualTier !== "extreme" || byLev[20].visualTier !== "danger") {
  throw new Error("compression visual tiers");
}
if (snapLeverageSpaceCompressionStep(10) !== 10) throw new Error("snap 10");
if (snapLeverageSpaceCompressionStep(7) !== 5 && snapLeverageSpaceCompressionStep(7) !== 10) {
  throw new Error("snap 7 to 5 or 10");
}
if (!formatLeverageMoveInsightPhrase(50).includes("2%")) {
  throw new Error("leverage insight 50x");
}
if (getLeverageLiquidationMovePercent(20) !== 5) throw new Error("move 20x");
console.log("  ✓ leverage space compression");

if (labelMinGapPctForLeverage(50) >= labelMinGapPctForLeverage(10)) {
  throw new Error("50x should use tighter label gap than 10x");
}
const tight50 = resolveLevelLabelPlacements(
  [
    { id: "entry", yPct: 50 },
    { id: "stop", yPct: 52 },
    { id: "liquidation", yPct: 53.5 },
  ],
  { leverage: 50 },
);
if (!tight50.stop.ultraCompact || !tight50.liquidation.ultraCompact) {
  throw new Error("50x cluster should use ultraCompact labels");
}
if (tight50.stop.side === tight50.liquidation.side) {
  throw new Error("50x stop/liq labels should split sides");
}
console.log("  ✓ label placement high leverage");

const entry = 100;
let prevGap = Infinity;
for (const lev of [10, 20, 30, 50]) {
  const liq = entry * (1 - 1 / lev);
  const stop = 99;
  const take = 102;
  const scale = buildHonestPriceScale({
    entryPrice: entry,
    takeProfitPrice: take,
    stopPrice: stop,
    liquidationPrice: liq,
    liquidationInactive: false,
    direction: "long",
    mode: "risk_focus",
  });
  const gap = entryLiquidationVisualGapYPct(entry, liq, scale);
  if (gap >= prevGap) {
    throw new Error(`honest scale: lev ${lev}x liq should move closer to entry (gap ${gap} >= ${prevGap})`);
  }
  prevGap = gap;
  const entryY = priceToHonestYPct(entry, scale);
  const liqY = priceToHonestYPct(liq, scale);
  if (liq >= entry) throw new Error(`long ${lev}x liq below entry`);
  if (liqY <= entryY) throw new Error(`long ${lev}x liq should be below entry on chart`);
  if (Math.abs(entryY - ENTRY_ANCHOR_Y_PCT) > 0.01) {
    throw new Error(`entry anchored at center (${entryY} != ${ENTRY_ANCHOR_Y_PCT})`);
  }
}
const longRiskFocus = buildHonestPriceScale({
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 80,
  liquidationInactive: false,
  direction: "long",
  mode: "risk_focus",
});
const liqLines = buildHonestLevelLines({
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 80,
  liquidationInactive: false,
  scale: longRiskFocus,
});
const farLiq = liqLines.find((l) => l.id === "liquidation");
if (!farLiq || farLiq.inView) {
  throw new Error("5x long liq (-20%) should be off-screen in risk_focus");
}
if (!farLiq.clipLabel?.includes("далеко")) {
  throw new Error("off-screen liq should show far label");
}
const longSpans = getRiskFocusSpans("long");
if (longSpans.spanUp !== 5 || longSpans.spanDown !== 10) {
  throw new Error("long risk_focus spans");
}
const shortSpans = getRiskFocusSpans("short");
if (shortSpans.spanUp !== 10 || shortSpans.spanDown !== 5) {
  throw new Error("short risk_focus spans");
}
const shortScale = buildHonestPriceScale({
  entryPrice: 100,
  takeProfitPrice: 98,
  stopPrice: 101,
  liquidationPrice: 102.5,
  liquidationInactive: false,
  direction: "short",
});
if (priceToHonestYPct(102.5, shortScale) >= priceToHonestYPct(100, shortScale)) {
  throw new Error("short liq above entry on chart");
}
const ladderLongPrices = computeRiskLadderPrices({ leverage: 10, direction: "long", stopPercent: 1, takeProfitR: 2 });
if (ladderLongPrices.takeProfitPrice <= ladderLongPrices.entryPrice) {
  throw new Error("long: TP must be above entry");
}
if (ladderLongPrices.stopPrice >= ladderLongPrices.entryPrice) {
  throw new Error("long: stop must be below entry");
}
if (ladderLongPrices.liquidationPrice >= ladderLongPrices.stopPrice) {
  throw new Error("long: liq must be below stop");
}
const ladderShortPrices = computeRiskLadderPrices({ leverage: 10, direction: "short", stopPercent: 1, takeProfitR: 2 });
if (ladderShortPrices.takeProfitPrice >= ladderShortPrices.entryPrice) {
  throw new Error("short: TP must be below entry");
}
if (ladderShortPrices.stopPrice <= ladderShortPrices.entryPrice) {
  throw new Error("short: stop must be above entry");
}
if (ladderShortPrices.liquidationPrice <= ladderShortPrices.stopPrice) {
  throw new Error("short: liq must be above stop");
}
const longScale = buildHonestPriceScale({
  entryPrice: ladderLongPrices.entryPrice,
  takeProfitPrice: ladderLongPrices.takeProfitPrice,
  stopPrice: ladderLongPrices.stopPrice,
  liquidationPrice: ladderLongPrices.liquidationPrice,
  liquidationInactive: false,
  direction: "long",
});
const longTpY = priceToHonestYPct(ladderLongPrices.takeProfitPrice, longScale);
const longEntryY = priceToHonestYPct(ladderLongPrices.entryPrice, longScale);
const longStopY = priceToHonestYPct(ladderLongPrices.stopPrice, longScale);
const longLiqY = priceToHonestYPct(ladderLongPrices.liquidationPrice, longScale);
if (!(longTpY < longEntryY && longEntryY < longStopY && longStopY < longLiqY)) {
  throw new Error("long chart Y order: TP top → Entry → Stop → Liq bottom");
}
const shortScale2 = buildHonestPriceScale({
  entryPrice: ladderShortPrices.entryPrice,
  takeProfitPrice: ladderShortPrices.takeProfitPrice,
  stopPrice: ladderShortPrices.stopPrice,
  liquidationPrice: ladderShortPrices.liquidationPrice,
  liquidationInactive: false,
  direction: "short",
});
const sLiqY = priceToHonestYPct(ladderShortPrices.liquidationPrice, shortScale2);
const sStopY = priceToHonestYPct(ladderShortPrices.stopPrice, shortScale2);
const sEntryY = priceToHonestYPct(ladderShortPrices.entryPrice, shortScale2);
const sTpY = priceToHonestYPct(ladderShortPrices.takeProfitPrice, shortScale2);
if (!(sLiqY < sStopY && sStopY < sEntryY && sEntryY < sTpY)) {
  throw new Error("short chart Y order: Liq top → Stop → Entry → TP bottom");
}
const axisScale = buildHonestPriceScale({
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 98,
  liquidationInactive: false,
  direction: "long",
});
const axisTicks = buildHonestAxisTicks(axisScale, 6, [
  { id: "take", price: 102 },
  { id: "entry", price: 100 },
  { id: "stop", price: 99 },
  { id: "liquidation", price: 98 },
]);
const entryTick = axisTicks.find((t) => t.role === "entry");
if (!entryTick || entryTick.percentLabel !== "0.00%") {
  throw new Error("axis: entry tick must show 0.00% aligned with entry");
}
const closeLevels = [
  { id: "stop" as const, yPct: 50 },
  { id: "liquidation" as const, yPct: 54 },
];
const placements = resolveLevelLabelPlacements(closeLevels, { minGapPct: 8.5 });
if (placements.stop.side === placements.liquidation.side) {
  throw new Error("label placement: close stop/liq should split sides");
}
if (getLiquidationLineVisualTier(19) !== "default") throw new Error("liq visual tier 19");
if (getLiquidationLineVisualTier(20) !== "glow") throw new Error("liq visual tier 20");
if (getLiquidationLineVisualTier(30) !== "glow-pulse") throw new Error("liq visual tier 30");
if (getLeverage50xWarning(50, false) !== LEVERAGE_50X_WARNING) throw new Error("50x warning");
if (getLeverage50xWarning(49, false) != null) throw new Error("49x no warning");
if (liquidationPercentFromEntry(10, "long") !== -10) throw new Error("ghost 10x long %");
if (liquidationPercentFromEntry(20, "long") !== -5) throw new Error("ghost 20x long %");
if (Math.abs(liquidationPercentFromEntry(30, "long") + 100 / 30) > 0.001) throw new Error("ghost 30x long %");
if (liquidationPercentFromEntry(50, "long") !== -2) throw new Error("ghost 50x long %");
if (liquidationPercentFromEntry(10, "short") !== 10) throw new Error("ghost 10x short %");
const ghostScale = buildHonestPriceScale({
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 95,
  liquidationInactive: false,
  direction: "long",
  mode: "risk_focus",
});
const ghosts = buildLiquidationGhostLines({
  entryPrice: 100,
  direction: "long",
  activeLeverage: 20,
  scale: ghostScale,
  liquidationInactive: false,
});
if (ghosts.length < 3) throw new Error("ghost lines in risk_focus long");
const g20 = ghosts.find((g) => g.leverage === 20);
if (!g20?.isActive || g20.percentFromEntry !== -5) throw new Error("ghost 20x active");
const ghostsByLev = [...ghosts].sort((a, b) => a.leverage - b.leverage);
for (let i = 1; i < ghostsByLev.length; i++) {
  if (ghostsByLev[i].yPct >= ghostsByLev[i - 1].yPct) {
    throw new Error("ghost Y order long: higher leverage closer to entry");
  }
}
if (!ghostMatchesLiquidationPrice(100, 95, 20, "long")) throw new Error("ghost price match 20x");
console.log("  ✓ honest price ladder scale");
console.log("  ✓ liquidation ghost lines");

for (const [lev, expectedPct] of [
  [10, 10],
  [20, 5],
  [50, 2],
] as const) {
  const liq = entry * (1 - 1 / lev);
  const pct = ((liq - entry) / entry) * 100;
  if (Math.abs(pct + expectedPct) > 0.05) {
    throw new Error(`long ${lev}x liq ~ -${expectedPct}% (got ${pct})`);
  }
}
const entryAnchored = buildHonestPriceScale({
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 90,
  liquidationInactive: false,
  direction: "long",
  mode: "risk_focus",
});
if (Math.abs(priceToHonestYPct(100, entryAnchored) - ENTRY_ANCHOR_Y_PCT) > 0.01) {
  throw new Error("entry Y fixed at anchor");
}
const liq10 = buildHonestPriceScale({
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 90,
  liquidationInactive: false,
  direction: "long",
  mode: "risk_focus",
});
const liq50 = buildHonestPriceScale({
  entryPrice: 100,
  takeProfitPrice: 102,
  stopPrice: 99,
  liquidationPrice: 98,
  liquidationInactive: false,
  direction: "long",
  mode: "risk_focus",
});
const y10 = priceToHonestYPct(90, liq10);
const y50 = priceToHonestYPct(98, liq50);
if (y50 >= y10) throw new Error("50x liq closer to entry than 10x on chart");
const shortAnchored = buildHonestPriceScale({
  entryPrice: 100,
  takeProfitPrice: 98,
  stopPrice: 101,
  liquidationPrice: 110,
  liquidationInactive: false,
  direction: "short",
  mode: "risk_focus",
});
if (priceToHonestYPct(110, shortAnchored) >= ENTRY_ANCHOR_Y_PCT) {
  throw new Error("short liq above entry on chart (smaller Y)");
}
console.log("  ✓ liquidation map UX anchors");

console.log("  ✓ leverage micro-interaction");

const sim = computeLiquidationSimulator({
  deposit: 100,
  leverage: 10,
  direction: "long",
});
if (sim.positionSize !== 1000 || sim.liquidationPrice !== 90 || sim.liquidationDistancePercent !== 10) {
  throw new Error("simulator long 10x mismatch");
}
const simShort = computeLiquidationSimulator({ deposit: 100, leverage: 10, direction: "short" });
if (Math.abs(simShort.liquidationPrice - 110) > 1e-9) throw new Error("simulator short 10x mismatch");
if (sim.liquidationPrice >= sim.entryPrice) throw new Error("long liq must be below entry");
if (simShort.liquidationPrice <= simShort.entryPrice) throw new Error("short liq must be above entry");
const sim1 = computeLiquidationSimulator({ deposit: 100, leverage: 1, direction: "long" });
if (sim1.leverageOneNote == null || sim1.liquidationDistancePercent !== 0) {
  throw new Error("simulator 1x note mismatch");
}
console.log("  ✓ liquidation simulator");

if (getLeverageMetricsVisualTier(3) !== "calm") throw new Error("tier 3 should be calm");
if (getLeverageMetricsVisualTier(5) !== "warning") throw new Error("tier 5 should be warning");
if (getLeverageMetricsVisualTier(15) !== "danger") throw new Error("tier 15 should be danger");
if (getLeverageMetricsVisualTier(25) !== "extreme") throw new Error("tier 25 should be extreme");
if (!getLeverageChipInsight(10).includes("10%")) throw new Error("insight 10x mismatch");
if (!getLeverageChipInsight(50).includes("2%")) throw new Error("insight 50x mismatch");
if (getLeverageChipInsight(1) !== getLeverageDynamicInsight(1)) throw new Error("chip insight 1x");
console.log("  ✓ leverage chip insights");

if (getLeverageLadderPhrase(2).tone !== "calm") throw new Error("ladder phrase 2x should be calm");
if (!getLeverageLadderPhrase(10).text.includes("Стоп")) throw new Error("ladder phrase 10x");
if (getLeverageLadderPhrase(50).tone !== "extreme") throw new Error("ladder phrase 50x");
console.log("  ✓ leverage ladder phrase");
console.log("  ✓ leverage metrics tier & insight");

const mapMetrics = computeLiquidationMapMetrics({
  deposit: 100,
  leverage: 25,
  direction: "long",
  stopPercent: 1,
  takeProfitR: 2,
});
if (mapMetrics.liquidationDistancePercent !== 4) throw new Error("liq distance 25x should be 4%");
if (Math.abs(mapMetrics.airAfterStop - 3) > 1e-9) throw new Error("air after stop should be 3%");
if (mapMetrics.airStatus !== "ok") throw new Error("3% air should be ok status");
const tightMetrics = computeLiquidationMapMetrics({
  deposit: 100,
  leverage: 50,
  direction: "long",
  stopPercent: 2,
  takeProfitR: 2,
});
if (tightMetrics.airAfterStop !== 0) throw new Error("50x 2% stop should have 0 air");
if (tightMetrics.airStatus !== "invalid") throw new Error("0 air should be invalid");
console.log("  ✓ liquidation map metrics");

const impact = buildLeverageImpactCards(100);
if (impact.length !== 6) throw new Error("expected 6 leverage impact cards");
const x10 = impact.find((c) => c.leverage === 10);
const x20 = impact.find((c) => c.leverage === 20);
if (x10?.positionSize !== 1000 || x10.adverseMovePercent !== 10) {
  throw new Error("x10 card mismatch");
}
if (x20?.positionSize !== 2000 || x20.adverseMovePercent !== 5 || !x20.showWarning) {
  throw new Error("x20 card mismatch");
}
if (impact.find((c) => c.leverage === 1)?.adverseMovePercent != null) {
  throw new Error("x1 should not have adverseMovePercent");
}
const x2 = impact.find((c) => c.leverage === 2);
if (x2?.statusLabel !== "спокойно" || x2.cardTone !== "cyan") {
  throw new Error("x2 card status/tone mismatch");
}
if (impact.find((c) => c.leverage === 50)?.statusLabel !== "почти без воздуха") {
  throw new Error("x50 status mismatch");
}
console.log("  ✓ leverage impact cards");

if (PERPETUAL_LEVERAGE_QUIZ.length !== 5) throw new Error("expected 5 quiz questions");
const q1 = PERPETUAL_LEVERAGE_QUIZ[0];
if (!isQuizAnswerCorrect(q1, "b")) throw new Error("quiz q1 correct answer");
console.log("  ✓ perpetual leverage quiz");

console.log("All perpetual calculator checks passed.");
