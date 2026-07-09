/**
 * QA Round Levels Engine — pnpm -C frontend verify:round-levels
 */
import {
  computeRoundLevels,
  formatRoundLevelLabel,
  roundToStep,
  type RoundLevel,
} from "../lib/strategies/round-levels-engine";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function levelPrices(levels: RoundLevel[]): number[] {
  return levels.map((level) => level.price);
}

function hasPrice(levels: RoundLevel[], price: number): boolean {
  return levels.some((level) => Math.abs(level.price - price) < 1e-6);
}

function findLevel(levels: RoundLevel[], price: number): RoundLevel | undefined {
  return levels.find((level) => Math.abs(level.price - price) < 1e-6);
}

function assertNoNaNInLevels(label: string, levels: RoundLevel[]): void {
  for (const level of levels) {
    assert(`${label} price finite`, Number.isFinite(level.price));
    assert(`${label} upperBuffer finite`, Number.isFinite(level.upperBuffer.to));
    assert(`${label} lowerBuffer finite`, Number.isFinite(level.lowerBuffer.from));
    assert(`${label} label non-empty`, level.label.length > 0);
    assert(`${label} no NaN label`, !level.label.includes("NaN"));
  }
}

// --- GAZP-like ---
const gazpLevels = computeRoundLevels({
  minPrice: 92.1,
  maxPrice: 94.7,
  currentPrice: 94.06,
  minStep: 0.01,
});

assert("GAZP-like produces levels", gazpLevels.length > 0);
assertNoNaNInLevels("GAZP-like", gazpLevels);

for (const expected of [91, 91.5, 92, 92.5, 93, 93.5, 94, 94.5, 95]) {
  assert(`GAZP-like includes ${expected}`, hasPrice(gazpLevels, expected));
}

for (const expected of [90, 95]) {
  assert(`GAZP-like includes nearby major ${expected}`, hasPrice(gazpLevels, expected));
}

assert("GAZP-like labels clean", gazpLevels.every((level) => /^-?\d+(\.\d+)?$/.test(level.label)));
assert(
  "GAZP-like no duplicate prices",
  new Set(levelPrices(gazpLevels)).size === gazpLevels.length,
);
assert(
  "GAZP-like sorted asc",
  gazpLevels.every((level, index, arr) => index === 0 || arr[index - 1]!.price < level.price),
);

assert("GAZP 94 normal", findLevel(gazpLevels, 94)?.importance === "normal");
assert("GAZP 93.5 minor", findLevel(gazpLevels, 93.5)?.importance === "minor");

const level93 = findLevel(gazpLevels, 93);
assert("GAZP level 93 exists", level93 != null);

if (level93) {
  const buffer = roundToStep(level93.upperBuffer.to - level93.price, 0.01);
  assert("GAZP buffer ~0.14–0.15", buffer >= 0.14 && buffer <= 0.15);
  assert(
    "GAZP level 93 upper from price",
    Math.abs(level93.upperBuffer.from - 93) < 1e-6,
  );
  assert(
    "GAZP level 93 lower to price",
    Math.abs(level93.lowerBuffer.to - 93) < 1e-6,
  );
  const lowerSpan = roundToStep(93 - level93.lowerBuffer.from, 0.01);
  assert("GAZP lower buffer ~0.14–0.15", lowerSpan >= 0.14 && lowerSpan <= 0.15);
}

assert("GAZP nearby 90 major", findLevel(gazpLevels, 90)?.importance === "major");
assert("GAZP 95 major", findLevel(gazpLevels, 95)?.importance === "major");

// --- High price stock ---
const highPriceLevels = computeRoundLevels({
  minPrice: 2900,
  maxPrice: 3100,
  currentPrice: 3000,
  minStep: 0.01,
});

assert("high price uses step 50", highPriceLevels.some((level) => level.step === 50));
assert("high price includes 3000", hasPrice(highPriceLevels, 3000));
assertNoNaNInLevels("high price", highPriceLevels);

// --- Low price stock ---
const lowPriceLevels = computeRoundLevels({
  minPrice: 2,
  maxPrice: 3,
  currentPrice: 2.5,
  minStep: 0.01,
});

assert("low price uses step 0.1", lowPriceLevels.every((level) => level.step === 0.1 || level.step === 0.05));
assert("low price includes 2.5", hasPrice(lowPriceLevels, 2.5));
assertNoNaNInLevels("low price", lowPriceLevels);

// --- Safety ---
assert("invalid config returns []", computeRoundLevels({ minPrice: 100, maxPrice: 50 }).length === 0);
assert("NaN config returns []", computeRoundLevels({ minPrice: NaN, maxPrice: 100 }).length === 0);

const wideLevels = computeRoundLevels({
  minPrice: 1,
  maxPrice: 10_000,
  currentPrice: 5000,
  minStep: 0.01,
  includeHalfLevels: true,
});
assert("wide range capped at 200", wideLevels.length <= 200);
assertNoNaNInLevels("wide range", wideLevels);

// --- Formatting ---
assert("format 93", formatRoundLevelLabel(93, 0.01) === "93");
assert("format 94.5", formatRoundLevelLabel(94.5, 0.01) === "94.5");
assert("format no junk precision", !formatRoundLevelLabel(93.00000001, 0.01).includes("000000"));

console.log("\nGAZP-like levels:", levelPrices(gazpLevels).join(", "));
console.log("\nAll round-levels-engine checks passed.");
