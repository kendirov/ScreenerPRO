/**
 * QA Directional Buffer Engine — pnpm -C frontend verify:round-buffer-direction
 */
import {
  buildDirectionalBufferZone,
  inferApproachDirection,
  inferApproachDirectionToLevel,
  isDirectionalZoneRangeValid,
  resolveActiveDirectionalBuffer,
  type DirectionalBufferZone,
} from "../lib/strategies/round-buffer-direction-engine";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

function assertRange(zone: DirectionalBufferZone, kind: "reaction" | "break", from: number, to: number): void {
  const part = kind === "reaction" ? zone.reactionZone : zone.breakZone;
  assert(`${kind} from ${from}`, Math.abs(part.from - from) < 1e-6);
  assert(`${kind} to ${to}`, Math.abs(part.to - to) < 1e-6);
  assert(`${kind} not inverted`, part.from <= part.to + 1e-6);
}

function assertNoNaN(zone: DirectionalBufferZone | null, label: string): void {
  assert(`${label} not null`, zone != null);
  if (!zone) return;
  assert(`${label} level finite`, Number.isFinite(zone.level));
  assert(`${label} buffer finite`, Number.isFinite(zone.buffer));
  assert(`${label} reaction.from finite`, Number.isFinite(zone.reactionZone.from));
  assert(`${label} reaction.to finite`, Number.isFinite(zone.reactionZone.to));
  assert(`${label} break.from finite`, Number.isFinite(zone.breakZone.from));
  assert(`${label} break.to finite`, Number.isFinite(zone.breakZone.to));
  assert(`${label} range valid`, isDirectionalZoneRangeValid(zone));
}

// --- up_to_level @ 95, buffer 0.15 ---
const up95 = buildDirectionalBufferZone(95, "up_to_level", 0.15);
assertNoNaN(up95, "up_to_level 95");
if (up95) {
  assert("up_to_level direction", up95.direction === "up_to_level");
  assertRange(up95, "reaction", 94.85, 95);
  assertRange(up95, "break", 95, 95.15);
}

// --- down_to_level @ 93, buffer 0.15 ---
const down93 = buildDirectionalBufferZone(93, "down_to_level", 0.15);
assertNoNaN(down93, "down_to_level 93");
if (down93) {
  assert("down_to_level direction", down93.direction === "down_to_level");
  assertRange(down93, "reaction", 93, 93.15);
  assertRange(down93, "break", 92.85, 93);
}

// --- unknown safe ---
const unknown = buildDirectionalBufferZone(100, "unknown", 0.15);
assertNoNaN(unknown, "unknown");
if (unknown) {
  assert("unknown direction", unknown.direction === "unknown");
  assertRange(unknown, "reaction", 99.85, 100);
  assertRange(unknown, "break", 100, 100.15);
}

// --- inferApproachDirection ---
const risingCandles = [
  { close: 90 },
  { close: 91 },
  { close: 92 },
  { close: 93 },
  { close: 94 },
  { close: 94.5 },
  { close: 94.8 },
];
const fallingCandles = [
  { close: 95 },
  { close: 94.5 },
  { close: 94 },
  { close: 93.5 },
  { close: 93 },
  { close: 92.8 },
  { close: 92.5 },
];
const flatCandles = [
  { close: 93 },
  { close: 93 },
  { close: 93 },
  { close: 93 },
  { close: 93 },
  { close: 93 },
  { close: 93 },
];

assert("rising → up_to_level", inferApproachDirection(risingCandles) === "up_to_level");
assert("falling → down_to_level", inferApproachDirection(fallingCandles) === "down_to_level");
assert("single candle → unknown", inferApproachDirection([{ close: 93 }]) === "unknown");
assert("flat candles → unknown", inferApproachDirection(flatCandles) === "unknown");

assert(
  "below level → up_to_level",
  inferApproachDirectionToLevel(93.8, 94) === "up_to_level",
);
assert(
  "above level → down_to_level",
  inferApproachDirectionToLevel(94.2, 94) === "down_to_level",
);
assert(
  "on level → unknown",
  inferApproachDirectionToLevel(94, 94) === "unknown",
);

// --- resolveActiveDirectionalBuffer ---
const resolved = resolveActiveDirectionalBuffer({
  candles: risingCandles,
  levels: [90, 91, 92, 93, 94, 95],
  selectedLevelPrice: 95,
  buffer: 0.15,
});
assertNoNaN(resolved, "resolve rising @ 95");
if (resolved) {
  assert("resolve uses selected level", resolved.level === 95);
  assertRange(resolved, "reaction", 94.85, 95);
}

const resolvedDown = resolveActiveDirectionalBuffer({
  candles: fallingCandles,
  levels: [90, 91, 92, 93, 94, 95],
  selectedLevelPrice: 93,
  buffer: 0.15,
});
assertNoNaN(resolvedDown, "resolve falling @ 93");
if (resolvedDown) {
  assertRange(resolvedDown, "reaction", 93, 93.15);
  assertRange(resolvedDown, "break", 92.85, 93);
}

console.log("\nAll round-buffer-direction checks passed.");
