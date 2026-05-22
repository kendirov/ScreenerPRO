/**
 * Локальная проверка расчётов пар (запуск: pnpm -C frontend exec tsx scripts/verify-currency-pair-divergence.ts)
 */
import {
  calcPercentMoveFromAnchor,
  calcPointsMoveFromAnchor,
  calculatePairDivergence,
} from "../lib/domain/currency-pair-divergence";
import type { AlignedIntradayRow } from "../lib/domain/currency-intraday-series";
import {
  alignTimeSeriesWithForwardFill,
  alignIntradayForPair,
} from "../lib/domain/currency-time-series-align";
import { candlesFromIntraday } from "../lib/domain/currency-time-series-align";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

function row(ts: string, closes: Record<string, number>): AlignedIntradayRow {
  return { timestamp: ts, closes };
}

// SI-CNY: SI 100→101 (+1%), CNY 10→10.2 (+2%), spread = -1%
const siCnyAligned: AlignedIntradayRow[] = [
  row("2026-01-01T10:00:00Z", { SI: 100, CNY: 10 }),
  row("2026-01-01T10:05:00Z", { SI: 101, CNY: 10.2 }),
];
const siCny = calculatePairDivergence(siCnyAligned, "SI/CNY")!;
assert(Math.abs(siCny.legA[1]! - 1) < 1e-6, "SI leg +1%");
assert(Math.abs(siCny.legB[1]! - 2) < 1e-6, "CNY leg +2%");
assert(Math.abs(siCny.spread[1]! - -1) < 1e-6, "SI-CNY spread -1% (CNY сильнее)");

// SI-ED: points mode
const siEdAligned: AlignedIntradayRow[] = [
  row("2026-01-01T10:00:00Z", { SI: 95000, ED: 1.1 }),
  row("2026-01-01T10:05:00Z", { SI: 94500, ED: 1.095 }),
];
const siEd = calculatePairDivergence(siEdAligned, "SI/ED")!;
assert(Math.abs(siEd.legA[1]! - -500) < 1e-6, "SI -500 п.");
assert(Math.abs(siEd.legB[1]! - -0.005) < 1e-6, "ED -0.005 п. (сырая котировка)");
assert(
  Math.abs(siEd.spread[1]! - (-500 - -0.005)) < 1e-6,
  "SI-ED spread в пунктах без percent normalization",
);

// normalize helpers
const pct = calcPercentMoveFromAnchor(siCnyAligned, "SI");
assert(Math.abs(pct[1]! - 1) < 1e-6, "percent helper");

const pts = calcPointsMoveFromAnchor(siEdAligned, "SI");
assert(pts[1] === -500, "points helper");

// SI-ED: SI много свечей, ED реже — forward fill должен дать много aligned точек
const siMany = Array.from({ length: 10 }, (_, i) => ({
  timestamp: `2026-01-01T10:${String(i * 5).padStart(2, "0")}:00Z`,
  open: 95000,
  high: 95000,
  low: 95000,
  close: 95000 - i * 10,
}));
const edFew = [
  { timestamp: "2026-01-01T10:00:00Z", open: 1.1, high: 1.1, low: 1.1, close: 1.1 },
  { timestamp: "2026-01-01T10:25:00Z", open: 1.095, high: 1.095, low: 1.095, close: 1.095 },
];
const ff = alignTimeSeriesWithForwardFill(
  candlesFromIntraday(siMany),
  candlesFromIntraday(edFew),
  30,
);
assert(ff.points.length >= 8, `forward-fill SI-ED: ${ff.points.length} aligned (ожидали >=8)`);
assert(ff.forwardFilledCount >= 1, "есть forward-filled точки");

const pairRows = alignIntradayForPair(
  "SI/ED",
  { SI: siMany, ED: edFew },
  5,
);
assert((pairRows?.stats.alignedCount ?? 0) >= 8, "alignIntradayForPair SI/ED");

console.log("\nВсе проверки currency-pair-divergence пройдены.");
