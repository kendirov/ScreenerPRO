/**
 * QA Strategy Lab UX pass 3 — pnpm -C frontend verify:strategy-lab-ux
 */
import {
  buildDirectionalBufferZone,
} from "../lib/strategies/round-buffer-direction-engine";
import {
  BUFFER_ZONE_VISIBILITY,
  bufferZoneFillOpacity,
} from "../lib/strategies/strategy-buffer-zone-overlay";
import { STRATEGY_CHART_CANDLE_COLORS } from "../lib/strategies/strategy-chart-candle-colors";
import {
  buildApproachZone,
  classifyEventKind,
  computeApproachWidth,
  DEFAULT_CONTEXT_HUD_EXPANDED,
  DEFAULT_SHOW_NEAR_MISS,
} from "../lib/strategies/round-approach-zone-engine";
import {
  buildRecentLevelEvents,
  isNearMissCase,
} from "../lib/strategies/round-level-event-engine";
import {
  AI_EXPORT_REQUIRED_SECTIONS,
  buildStrategyLabAiMarkdown,
  buildStrategyLabJsonExport,
  DEFAULT_STRATEGY_LAB_LAYER_MODES,
  DEFAULT_STRATEGY_LAB_PERIOD,
  DEFAULT_STRATEGY_LAB_TIMEFRAME,
  DEFAULT_STRATEGY_LAB_VISIBLE_RANGE,
  mapPeriodToDataPeriod,
  mapTimeframeToDataInterval,
  parseStrategyLabSnapshot,
  serializeStrategyLabSnapshot,
  STRATEGY_LAB_ANALYSIS_SETTINGS_COLLAPSED_DEFAULT,
  STRATEGY_LAB_EXPORT_SCHEMA_VERSION,
  STRATEGY_LAB_SNAPSHOT_VERSION,
  STRATEGY_LAB_STRATEGY_NAV_COMPACT,
  type StrategyLabExportContext,
  type StrategyLabSnapshotState,
} from "../lib/strategies/strategy-lab-ux";

function assert(label: string, condition: boolean): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`OK: ${label}`);
}

assert("default timeframe is 5m", DEFAULT_STRATEGY_LAB_TIMEFRAME === 5);
assert("default period is 20d", DEFAULT_STRATEGY_LAB_PERIOD === "20d");
assert("default visible range is two_sessions", DEFAULT_STRATEGY_LAB_VISIBLE_RANGE === "two_sessions");
assert("default levels mode is important", DEFAULT_STRATEGY_LAB_LAYER_MODES.levels === "important");
assert("default buffers mode is active", DEFAULT_STRATEGY_LAB_LAYER_MODES.buffers === "active");
assert("default extremums mode is important", DEFAULT_STRATEGY_LAB_LAYER_MODES.extremums === "important");
assert("default reactions mode is selected", DEFAULT_STRATEGY_LAB_LAYER_MODES.reactions === "selected");
assert("default sessions mode is on", DEFAULT_STRATEGY_LAB_LAYER_MODES.sessions === "on");
assert("analysis settings collapsed by default", STRATEGY_LAB_ANALYSIS_SETTINGS_COLLAPSED_DEFAULT === true);
assert("strategy nav compact mode enabled", STRATEGY_LAB_STRATEGY_NAV_COMPACT === true);
assert("snapshot version is 3", STRATEGY_LAB_SNAPSHOT_VERSION === 3);
assert("export schema version is 3", STRATEGY_LAB_EXPORT_SCHEMA_VERSION === 3);
assert("context HUD collapsed by default", DEFAULT_CONTEXT_HUD_EXPANDED === false);
assert("show near miss by default", DEFAULT_SHOW_NEAR_MISS === true);

assert("candle colors have separate bullish body", typeof STRATEGY_CHART_CANDLE_COLORS.bullish.body === "string");
assert("candle colors have separate bearish body", typeof STRATEGY_CHART_CANDLE_COLORS.bearish.body === "string");
assert(
  "bullish and bearish bodies differ",
  String(STRATEGY_CHART_CANDLE_COLORS.bullish.body) !== String(STRATEGY_CHART_CANDLE_COLORS.bearish.body),
);

assert(
  "selected buffer opacity stronger than active reaction",
  bufferZoneFillOpacity("selected", "reaction") > bufferZoneFillOpacity("active", "reaction"),
);
assert(
  "active buffer opacity stronger than background reaction",
  bufferZoneFillOpacity("active", "reaction") > bufferZoneFillOpacity("background", "reaction"),
);
assert("selected buffer opacity below candle dominance threshold", bufferZoneFillOpacity("selected", "reaction") <= 0.16);
assert("buffer zone visibility config has selected/active/background", BUFFER_ZONE_VISIBILITY.selected != null);

const hardBuffer = 0.14;
const approachWidth = computeApproachWidth(hardBuffer, "auto");
assert("approach width greater than hard buffer", approachWidth > hardBuffer);

const approachZone94 = buildApproachZone(94, approachWidth);
assert("level 94 approach zone lower bound", approachZone94.from <= 93.72 + 0.01);
assert(
  "near miss case level 94 extremum 93.74",
  isNearMissCase(94, 93.74, hardBuffer, approachWidth),
);

const nearMissKind = classifyEventKind("bounce", false, true);
assert("near_miss classification when approach only", nearMissKind === "near_miss");
const touchKind = classifyEventKind("bounce", true, true);
assert("touch classification when hard buffer entered", touchKind === "touch");
const overshootKind = classifyEventKind("false_break", true, true);
assert("overshoot maps from false_break", overshootKind === "overshoot");
const cleanBreakKind = classifyEventKind("breakout", true, true);
assert("clean_break maps from breakout", cleanBreakKind === "clean_break");
const chopKind = classifyEventKind("chop", true, true);
assert("chop maps from chop outcome", chopKind === "chop");

const belowToUp = buildDirectionalBufferZone(95, "up_to_level", 0.14);
assert("below-to-up reaction zone ends at level", belowToUp?.reactionZone.to === 95);
assert("below-to-up break zone starts at level", belowToUp?.breakZone.from === 95);

const aboveToDown = buildDirectionalBufferZone(95, "down_to_level", 0.14);
assert("above-to-down reaction zone starts at level", aboveToDown?.reactionZone.from === 95);
assert("above-to-down break zone ends at level", aboveToDown?.breakZone.to === 95);

const unknownDir = buildDirectionalBufferZone(95, "unknown", 0.14);
assert("unknown direction still builds zones", unknownDir != null);

assert("timeframe 15 maps to data interval 15", mapTimeframeToDataInterval(15) === 15);
assert("timeframe 60 maps to data interval 60", mapTimeframeToDataInterval(60) === 60);
assert("period 60d maps to data period 60d", mapPeriodToDataPeriod("60d") === "60d");

const mockLevelEvents = buildRecentLevelEvents({
  approaches: [
    {
      id: "level_94_near_2240",
      level: 94,
      direction: "up",
      fromIndex: 2230,
      toIndex: 2240,
      startTime: 1_719_861_000,
      endTime: 1_719_861_300,
      startPrice: 93.5,
      endPrice: 93.74,
      reactionZone: { from: 93.86, to: 94 },
      breakZone: { from: 94, to: 94.14 },
      outcome: "bounce",
      eventKind: "near_miss",
      approachZone: { from: 93.72, to: 94.28 },
      approachWidth: 0.28,
      enteredHardBuffer: false,
      enteredApproachZone: true,
      distanceToLevel: 0.26,
    },
  ],
  touches: [],
  limit: 5,
});

const mockExportContext = {
  strategy: "round-levels" as const,
  ticker: "GAZP",
  board: "TQBR",
  timeframe: 5 as const,
  period: "20d" as const,
  status: "онлайн",
  candleCount: 1200,
  visibleRangeFrom: 1_700_000_000,
  visibleRangeTo: 1_700_010_000,
  currentPrice: 129.7,
  selectedLevel: {
    price: 130,
    label: "130",
    importance: "major" as const,
    step: 10,
    upperBuffer: { from: 130, to: 130.14 },
    lowerBuffer: { from: 129.86, to: 130 },
  },
  selectedLevelStats: {
    level: 130,
    touches: 12,
    bounceRate: 0.58,
    breakoutRate: 0.2,
    falseBreakRate: 0.08,
    chopRate: 0.14,
    avgMaxBounceAbs: 0.42,
    avgMaxDiveAbs: 0.31,
    avgBarsToDecision: 3,
    technicalityScore: 72,
  },
  technicalSummary: {
    instrumentTechnicalityScore: 68,
    totalTouches: 120,
    bounceRate: 0.52,
    breakoutRate: 0.22,
    falseBreakRate: 0.1,
    chopRate: 0.16,
    avgBounce: 0.4,
    avgDive: 0.28,
    bestLevels: [{ level: 130, score: 72 }],
    scoreComponents: {
      levels: 70,
      sample: 65,
      clarity: 72,
      lowChop: 60,
      speed: 66,
    },
    sampleWarning: null,
  },
  sessionBoxes: [],
  movement: {
    lastPivot: { type: "low" as const, price: 128.8, time: 1_700_000_000, index: 40, confirmedAtIndex: 43 },
    movementDirection: "up" as const,
    nearestLevel: 130,
    nearestDistance: 0.5,
  },
  directionalBufferZone: buildDirectionalBufferZone(130, "up_to_level", 0.14),
  bufferAuto: true,
  bufferWidth: 0.14,
  bufferSource: "auto" as const,
  directionIntoSelectedLevel: "up_to_level" as const,
  activeApproachCount: 2,
  latestApproach: null,
  levelsTable: [],
  recentTouches: [
    {
      id: "touch_2841",
      level: 130,
      levelType: "major" as const,
      touchTime: 1_719_861_300,
      touchIndex: 2841,
      approach: "from_below" as const,
      entryPrice: 129.9,
      bufferFrom: 129.86,
      bufferTo: 130.14,
      maxDiveAbs: 0.37,
      maxDivePct: 0.28,
      maxBounceAbs: 0.94,
      maxBouncePct: 0.72,
      outcome: "false_break" as const,
      volumeRatio: 2.1,
      cleanlinessScore: 62,
    },
  ],
  recentLevelEvents: mockLevelEvents,
  activeApproaches: [],
  layerModes: DEFAULT_STRATEGY_LAB_LAYER_MODES,
  approachFactor: "auto" as const,
  approachWidth: 0.28,
  showNearMiss: true,
} as unknown as StrategyLabExportContext;

const markdown = buildStrategyLabAiMarkdown(mockExportContext);
for (const section of AI_EXPORT_REQUIRED_SECTIONS) {
  assert(`AI markdown contains ${section}`, markdown.includes(section));
}
assert("AI markdown includes approach model", markdown.includes("hard buffer width"));
assert("AI markdown recent level event has eventKind", markdown.includes("near_miss"));
assert("AI markdown recent level event has distance", markdown.includes("distance 0.26"));
assert("AI markdown recent level event has hard flag", markdown.includes("hard no"));
assert("AI markdown recent level event has approach flag", markdown.includes("approach yes"));
assert("AI markdown recent level event has bar index", markdown.includes("bar 2240"));

const json = buildStrategyLabJsonExport(mockExportContext);
let parsedJson: Record<string, unknown> | null;
try {
  parsedJson = JSON.parse(json) as Record<string, unknown>;
} catch {
  parsedJson = null;
}
assert("JSON export parses", parsedJson != null);
assert("JSON export schemaVersion 3", parsedJson?.schemaVersion === 3);
assert("JSON export has approachModel", parsedJson?.approachModel != null);
assert("JSON export has recentLevelEvents", Array.isArray(parsedJson?.recentLevelEvents));
assert("JSON export has recentTouchEvents alias", Array.isArray(parsedJson?.recentTouchEvents));
assert("JSON export has no NaN token", !json.includes("NaN"));
assert("JSON export has no Infinity token", !json.includes("Infinity"));
assert("JSON export has no undefined token", !json.includes("undefined"));

const snapshot: StrategyLabSnapshotState = {
  snapshotVersion: 3,
  savedAt: new Date().toISOString(),
  strategy: "round-levels",
  ticker: "GAZP",
  timeframe: 5,
  period: "20d",
  selectedLevelPrice: 130,
  visibleRangeMode: "two_sessions",
  visibleRangeFrom: 1_700_000_000,
  visibleRangeTo: 1_700_010_000,
  layerModes: DEFAULT_STRATEGY_LAB_LAYER_MODES,
  exportSchemaVersion: 3,
  contextHudExpanded: false,
  showNearMiss: true,
  approachFactor: "auto",
  technicalSummary: {
    instrumentTechnicalityScore: 68,
    totalTouches: 120,
    bounceRate: 0.52,
    breakoutRate: 0.22,
    falseBreakRate: 0.1,
    chopRate: 0.16,
  },
  selectedLevelEvents: [],
  activeApproaches: [],
};

const serialized = serializeStrategyLabSnapshot({
  ...snapshot,
  technicalSummary: {
    ...snapshot.technicalSummary!,
    bounceRate: Number.NaN,
  },
});
assert("snapshot serialization has no NaN token", !serialized.includes("NaN"));
const restored = parseStrategyLabSnapshot(serialized);
assert("snapshot restores from localStorage shape", restored?.ticker === "GAZP");
assert("snapshot has snapshotVersion 3", restored?.snapshotVersion === 3);
assert("snapshot contextHudExpanded serializes", restored?.contextHudExpanded === false);
assert("snapshot showNearMiss serializes", restored?.showNearMiss === true);
assert("snapshot approachFactor serializes", restored?.approachFactor === "auto");
assert(
  "snapshot bounceRate sanitized",
  restored?.technicalSummary?.bounceRate == null ||
    Number.isFinite(restored.technicalSummary.bounceRate),
);

const v2Migration = parseStrategyLabSnapshot(
  JSON.stringify({ ...snapshot, snapshotVersion: 2, exportSchemaVersion: 2 }),
);
assert("v2 snapshot migrates to v3", v2Migration?.snapshotVersion === 3);

console.log("\nStrategy Lab UX verification passed.");
