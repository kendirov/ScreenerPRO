import type { StrategyCandlePeriodId } from "@/lib/screener/strategies/strategy-candle-range";
import type { StrategyTimeframeMinutes } from "@/lib/screener/strategies/strategy-candles";
import type { BufferDisplayMode } from "@/lib/strategies/strategy-buffer-zone-overlay";
import type { ChartVisibleRangePreset } from "@/lib/strategies/chart-visible-range";
import type { RoundLevel } from "@/lib/strategies/round-levels-engine";
import type {
  RoundLevelReactionResult,
  RoundLevelTechnicalityStats,
  RoundLevelTouchEvent,
} from "@/lib/strategies/round-level-reaction-engine";
import type { RoundLevelApproachSegment } from "@/lib/strategies/round-level-approach-engine";
import type { ApproachDirection, DirectionalBufferZone } from "@/lib/strategies/round-buffer-direction-engine";
import type { SessionBox } from "@/lib/strategies/session-box-engine";
import type { ZigZagLiteResult } from "@/lib/strategies/zigzag-lite-engine";
import {
  formatApproachDirection,
  formatLevelImportance,
  formatReactionType,
  formatTimeframeHeader,
} from "@/lib/strategies/strategy-lab-labels";
import { formatDirectionalPriceRange } from "@/lib/strategies/round-buffer-direction-engine";
import type { ApproachFactorMode } from "@/lib/strategies/round-approach-zone-engine";
import type { RoundLevelEvent } from "@/lib/strategies/round-level-event-engine";
import {
  buildApproachZone,
  computeApproachWidth,
  eventKindLabel,
  resolveApproachFactorValue,
} from "@/lib/strategies/round-approach-zone-engine";
import { formatStrategyCandleTimeMsk } from "@/lib/strategies/strategy-candles-normalizer";
import { formatTechnicalityScore } from "@/lib/strategies/round-level-reaction-engine";

export type StrategyLabStrategyId = "round-levels" | "zigzag" | "technicality";

export type LevelsLayerMode = "important" | "all" | "off";
export type ExtremumsLayerMode = "important" | "all" | "off";
export type ReactionsLayerMode = "selected" | "all" | "off";
export type SessionsLayerMode = "on" | "off";

export type StrategyLabLayerModes = {
  levels: LevelsLayerMode;
  buffers: BufferDisplayMode;
  extremums: ExtremumsLayerMode;
  reactions: ReactionsLayerMode;
  sessions: SessionsLayerMode;
};

export const DEFAULT_STRATEGY_LAB_LAYER_MODES: StrategyLabLayerModes = {
  levels: "important",
  buffers: "active",
  extremums: "important",
  reactions: "selected",
  sessions: "on",
};

export const DEFAULT_STRATEGY_LAB_TIMEFRAME: StrategyTimeframeMinutes = 5;
export const DEFAULT_STRATEGY_LAB_PERIOD: StrategyCandlePeriodId = "20d";
export const DEFAULT_STRATEGY_LAB_VISIBLE_RANGE: ChartVisibleRangePreset = "two_sessions";

export const STRATEGY_LAB_SNAPSHOT_STORAGE_KEY = "screenerpro.strategyLab.snapshot";

export const STRATEGY_LAB_STRATEGY_OPTIONS: Array<{
  id: StrategyLabStrategyId;
  label: string;
  description: string;
  available: boolean;
}> = [
  { id: "round-levels", label: "Круглые уровни", description: "Round Levels · реакции и буферы", available: true },
  { id: "zigzag", label: "ZigZag / Swing", description: "структура движения", available: false },
  { id: "technicality", label: "Техничность инструментов", description: "рейтинг по стратегии", available: false },
];

export const STRATEGY_LAB_TIMEFRAME_OPTIONS: Array<{
  value: StrategyTimeframeMinutes;
  label: string;
}> = [
  { value: 1, label: "1m" },
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
];

export const STRATEGY_LAB_PERIOD_OPTIONS: Array<{
  id: StrategyCandlePeriodId;
  label: string;
}> = [
  { id: "today", label: "сегодня" },
  { id: "3d", label: "3д" },
  { id: "10d", label: "10д" },
  { id: "20d", label: "20д" },
  { id: "60d", label: "60д" },
];

export const LEVELS_LAYER_OPTIONS: Array<{ id: LevelsLayerMode; label: string }> = [
  { id: "important", label: "Важные" },
  { id: "all", label: "Все" },
  { id: "off", label: "Выкл" },
];

export const BUFFERS_LAYER_OPTIONS: Array<{ id: BufferDisplayMode; label: string }> = [
  { id: "active", label: "Активные" },
  { id: "selected", label: "Выбранный" },
  { id: "important", label: "Важные" },
  { id: "all", label: "Все" },
];

export const EXTREMUMS_LAYER_OPTIONS: Array<{ id: ExtremumsLayerMode; label: string }> = [
  { id: "important", label: "Важные" },
  { id: "all", label: "Все" },
  { id: "off", label: "Выкл" },
];

export const REACTIONS_LAYER_OPTIONS: Array<{ id: ReactionsLayerMode; label: string }> = [
  { id: "selected", label: "Выбранный" },
  { id: "all", label: "Все" },
  { id: "off", label: "Выкл" },
];

export const SESSIONS_LAYER_OPTIONS: Array<{ id: SessionsLayerMode; label: string }> = [
  { id: "on", label: "Вкл" },
  { id: "off", label: "Выкл" },
];

export function isStrategyLabStrategyId(value: string | null | undefined): value is StrategyLabStrategyId {
  return value === "round-levels" || value === "zigzag" || value === "technicality";
}

export function resolveStrategyLabTimeframe(raw: string | null | undefined): StrategyTimeframeMinutes {
  const n = Number(raw);
  if (n === 1 || n === 5 || n === 15 || n === 30 || n === 60) return n;
  if (n === 10) return 15;
  return DEFAULT_STRATEGY_LAB_TIMEFRAME;
}

export function mapTimeframeToDataInterval(timeframe: StrategyTimeframeMinutes): StrategyTimeframeMinutes {
  return timeframe;
}

export function mapPeriodToDataPeriod(period: StrategyCandlePeriodId): StrategyCandlePeriodId {
  return period;
}

export function layerModesToLegacyFlags(modes: StrategyLabLayerModes): {
  showLevels: boolean;
  showBuffers: boolean;
  showSessions: boolean;
  showReactions: boolean;
  showHalfLevels: boolean;
  levelScope: "important" | "all";
  bufferDisplayMode: BufferDisplayMode;
  zigzagMode: ExtremumsLayerMode;
  reactionMarkerMode: "selected" | "all";
} {
  return {
    showLevels: modes.levels !== "off",
    showBuffers: true,
    showSessions: modes.sessions === "on",
    showReactions: modes.reactions !== "off",
    showHalfLevels: modes.levels === "all",
    levelScope: modes.levels === "all" ? "all" : "important",
    bufferDisplayMode: modes.buffers,
    zigzagMode: modes.extremums,
    reactionMarkerMode: modes.reactions === "all" ? "all" : "selected",
  };
}

export const STRATEGY_LAB_SNAPSHOT_VERSION = 3;
export const STRATEGY_LAB_EXPORT_SCHEMA_VERSION = 3;
export const STRATEGY_LAB_ANALYSIS_SETTINGS_COLLAPSED_DEFAULT = true;
export const STRATEGY_LAB_STRATEGY_NAV_COMPACT = true;

export type StrategyLabSnapshotState = {
  snapshotVersion: 3;
  /** @deprecated legacy field — kept for migration reads */
  version?: 1;
  savedAt: string;
  strategy: StrategyLabStrategyId;
  ticker: string;
  timeframe: StrategyTimeframeMinutes;
  period: StrategyCandlePeriodId;
  selectedLevelPrice: number | null;
  visibleRangeMode: ChartVisibleRangePreset;
  visibleRangeFrom: number | null;
  visibleRangeTo: number | null;
  layerModes: StrategyLabLayerModes;
  analysisPreset?: "quick" | "normal" | "deep";
  bufferAuto?: boolean;
  customBuffer?: string | null;
  sessionPreset?: string | null;
  chartViewportMode?: ChartVisibleRangePreset;
  selectedTouchEventId?: string | null;
  exportSchemaVersion?: 3;
  contextHudExpanded?: boolean;
  showNearMiss?: boolean;
  approachFactor?: ApproachFactorMode;
  technicalSummary: {
    instrumentTechnicalityScore: number;
    totalTouches: number;
    bounceRate: number | null;
    breakoutRate: number | null;
    falseBreakRate: number | null;
    chopRate: number | null;
  } | null;
  selectedLevelEvents: RoundLevelTouchEvent[];
  activeApproaches: RoundLevelApproachSegment[];
};

export function sanitizeJsonValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(sanitizeJsonValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeJsonValue(entry);
    }
    return out;
  }
  return value;
}

export function serializeStrategyLabSnapshot(state: StrategyLabSnapshotState): string {
  return JSON.stringify(sanitizeJsonValue(state));
}

export function parseStrategyLabSnapshot(raw: string | null): StrategyLabSnapshotState | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as StrategyLabSnapshotState & { version?: number; snapshotVersion?: number };
    if (parsed?.snapshotVersion === 3) return parsed;
    if (parsed?.snapshotVersion === 2 || parsed?.version === 1) {
      return {
        ...parsed,
        snapshotVersion: 3,
        exportSchemaVersion: 3,
        contextHudExpanded: parsed.contextHudExpanded ?? false,
        showNearMiss: parsed.showNearMiss ?? true,
        approachFactor: parsed.approachFactor ?? "auto",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStrategyLabSnapshot(state: StrategyLabSnapshotState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STRATEGY_LAB_SNAPSHOT_STORAGE_KEY, serializeStrategyLabSnapshot(state));
  } catch {
    // ignore quota / private mode
  }
}

export function loadStrategyLabSnapshot(): StrategyLabSnapshotState | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStrategyLabSnapshot(localStorage.getItem(STRATEGY_LAB_SNAPSHOT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export type StrategyLabExportContext = {
  strategy: StrategyLabStrategyId;
  ticker: string;
  board: string;
  timeframe: StrategyTimeframeMinutes;
  period: StrategyCandlePeriodId;
  status: string;
  candleCount: number;
  visibleRangeFrom: number | null;
  visibleRangeTo: number | null;
  currentPrice: number | null;
  selectedLevel: RoundLevel | null;
  selectedLevelStats: RoundLevelTechnicalityStats | null;
  technicalSummary: RoundLevelReactionResult["summary"] | null;
  sessionBoxes: SessionBox[];
  movement: {
    lastPivot: ZigZagLiteResult["lastPivot"];
    movementDirection: ZigZagLiteResult["movementDirection"] | "unknown";
    nearestLevel: number | null;
    nearestDistance: number | null;
  };
  directionalBufferZone: DirectionalBufferZone | null;
  bufferAuto: boolean;
  bufferWidth: number | null;
  bufferSource: "auto" | "manual";
  directionIntoSelectedLevel: ApproachDirection | null;
  activeApproachCount: number;
  latestApproach: RoundLevelApproachSegment | null;
  levelsTable: Array<{ level: RoundLevel; stats: RoundLevelTechnicalityStats | null }>;
  recentTouches: RoundLevelTouchEvent[];
  recentLevelEvents: RoundLevelEvent[];
  activeApproaches: RoundLevelApproachSegment[];
  layerModes: StrategyLabLayerModes;
  approachFactor: ApproachFactorMode;
  approachWidth: number | null;
  showNearMiss: boolean;
};

function formatPct(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

function formatNum(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function approachOutcomeLabel(outcome: RoundLevelApproachSegment["outcome"]): string {
  if (outcome === "bounce") return "отбой";
  if (outcome === "breakout") return "пробой";
  if (outcome === "false_break") return "ложный";
  if (outcome === "chop") return "пила";
  if (outcome === "pending") return "в работе";
  return "—";
}

function approachDirectionTouchLabel(approach: RoundLevelTouchEvent["approach"]): string {
  if (approach === "from_below") return "from below";
  if (approach === "from_above") return "from above";
  return "inside zone";
}

function formatTouchEventTime(touchTime: number): string {
  if (!Number.isFinite(touchTime)) return "n/a";
  return formatStrategyCandleTimeMsk(touchTime);
}

function formatVolumeMultiplier(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "n/a";
  return `x${value.toFixed(1)}`;
}

function roundExportNumber(value: number, digits = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function prioritizeActiveApproaches(
  approaches: RoundLevelApproachSegment[],
  selectedLevelPrice: number | null,
  currentPrice: number | null,
  limit = 15,
): RoundLevelApproachSegment[] {
  const selectedPrice = selectedLevelPrice;
  const sorted = [...approaches].sort((a, b) => {
    const aSelected = selectedPrice != null && Math.abs(a.level - selectedPrice) < 1e-6;
    const bSelected = selectedPrice != null && Math.abs(b.level - selectedPrice) < 1e-6;
    if (aSelected !== bSelected) return aSelected ? -1 : 1;

    if (currentPrice != null && Number.isFinite(currentPrice)) {
      const distA = Math.abs(a.level - currentPrice);
      const distB = Math.abs(b.level - currentPrice);
      if (Math.abs(distA - distB) > 1e-6) return distA - distB;
    }

    const timeDiff = (b.endTime ?? 0) - (a.endTime ?? 0);
    if (timeDiff !== 0) return timeDiff;

    return 0;
  });

  const selected = selectedPrice != null
    ? sorted.filter((item) => Math.abs(item.level - selectedPrice) < 1e-6)
    : [];
  const rest = sorted.filter(
    (item) => selectedPrice == null || Math.abs(item.level - selectedPrice) >= 1e-6,
  );
  const merged = [...selected, ...rest];
  const unique = new Map<string, RoundLevelApproachSegment>();
  for (const item of merged) {
    unique.set(item.id, item);
  }
  return [...unique.values()].slice(0, limit);
}

export function buildStrategyLabAiMarkdown(ctx: StrategyLabExportContext): string {
  const lines: string[] = [];
  const summary = ctx.technicalSummary;
  const prioritizedApproaches = prioritizeActiveApproaches(
    ctx.activeApproaches,
    ctx.selectedLevel?.price ?? null,
    ctx.currentPrice,
    15,
  );

  lines.push("# Strategy Lab Export");
  lines.push("");
  lines.push("## Context");
  lines.push(`- strategy: ${ctx.strategy}`);
  lines.push(`- ticker: ${ctx.ticker}`);
  lines.push(`- board: ${ctx.board}`);
  lines.push(`- timeframe: ${formatTimeframeHeader(ctx.timeframe)}`);
  lines.push(`- period: ${ctx.period}`);
  lines.push(`- candles count: ${ctx.candleCount}`);
  if (ctx.visibleRangeFrom != null && ctx.visibleRangeTo != null) {
    lines.push(
      `- visible range: ${formatStrategyCandleTimeMsk(ctx.visibleRangeFrom)} — ${formatStrategyCandleTimeMsk(ctx.visibleRangeTo)}`,
    );
  } else {
    lines.push("- visible range: n/a");
  }
  lines.push(`- selected level: ${ctx.selectedLevel?.label ?? "—"}`);
  lines.push(`- status: ${ctx.status}`);
  lines.push("");

  lines.push("## Technical summary");
  if (summary) {
    lines.push(`- instrument score: ${formatTechnicalityScore(summary.instrumentTechnicalityScore)}/100`);
    lines.push(`- touches: ${summary.totalTouches}`);
    lines.push(`- bounce: ${formatPct(summary.bounceRate)}`);
    lines.push(`- breakout: ${formatPct(summary.breakoutRate)}`);
    lines.push(`- false break: ${formatPct(summary.falseBreakRate)}`);
    lines.push(`- chop: ${formatPct(summary.chopRate)}`);
    lines.push(`- avg bounce: ${formatNum(summary.avgBounce)}`);
    lines.push(`- avg dive: ${formatNum(summary.avgDive)}`);
    if (summary.bestLevels.length > 0) {
      lines.push(`- strongest levels: ${summary.bestLevels.map((level) => level.level).join(", ")}`);
    }
    const weakest = [...ctx.levelsTable]
      .filter((row) => row.stats != null)
      .sort((a, b) => (a.stats?.technicalityScore ?? 100) - (b.stats?.technicalityScore ?? 100))
      .slice(0, 3)
      .map((row) => row.level.label);
    if (weakest.length > 0) {
      lines.push(`- weakest/dirtiest levels: ${weakest.join(", ")}`);
    }
  } else {
    lines.push("- no summary");
  }
  lines.push("");

  lines.push("## Movement structure");
  const pivot = ctx.movement.lastPivot;
  lines.push(
    `- last pivot: ${
      pivot == null
        ? "—"
        : `${pivot.type === "high" ? "H" : "L"} ${pivot.price.toFixed(2)} · ${formatTouchEventTime(typeof pivot.time === "number" ? pivot.time : NaN)}`
    }`,
  );
  lines.push(
    `- current swing: ${
      ctx.movement.movementDirection === "up"
        ? "up"
        : ctx.movement.movementDirection === "down"
          ? "down"
          : "unknown"
    }`,
  );
  lines.push(`- nearest round level: ${ctx.movement.nearestLevel ?? "—"}`);
  lines.push(`- distance to level: ${formatNum(ctx.movement.nearestDistance)}`);
  lines.push(`- current price: ${formatNum(ctx.currentPrice)}`);
  lines.push(
    `- direction into selected level: ${formatApproachDirection(ctx.directionIntoSelectedLevel)}`,
  );
  lines.push("");

  lines.push("## Selected level");
  if (ctx.selectedLevel) {
    lines.push(`- level: ${ctx.selectedLevel.label}`);
    if (ctx.selectedLevelStats) {
      const s = ctx.selectedLevelStats;
      lines.push(`- score: ${formatTechnicalityScore(s.technicalityScore)}/100`);
      lines.push(`- touches: ${s.touches}`);
      lines.push(`- bounce: ${formatPct(s.bounceRate)}`);
      lines.push(`- breakout: ${formatPct(s.breakoutRate)}`);
      lines.push(`- false break: ${formatPct(s.falseBreakRate)}`);
      lines.push(`- chop: ${formatPct(s.chopRate)}`);
    }
    if (ctx.directionalBufferZone) {
      lines.push(
        `- reaction zone: ${formatDirectionalPriceRange(
          ctx.directionalBufferZone.reactionZone.from,
          ctx.directionalBufferZone.reactionZone.to,
        )}`,
      );
      lines.push(
        `- break zone: ${formatDirectionalPriceRange(
          ctx.directionalBufferZone.breakZone.from,
          ctx.directionalBufferZone.breakZone.to,
        )}`,
      );
      lines.push(`- buffer width: ${formatNum(ctx.directionalBufferZone.buffer)}`);
    }
    if (ctx.approachWidth != null && ctx.selectedLevel) {
      const zone = buildApproachZone(ctx.selectedLevel.price, ctx.approachWidth);
      lines.push(`- approach zone: ${formatDirectionalPriceRange(zone.from, zone.to)}`);
    }
    lines.push(`- buffer source: ${ctx.bufferSource}`);
    lines.push(`- last outcome: ${ctx.latestApproach ? approachOutcomeLabel(ctx.latestApproach.outcome) : "—"}`);

    const selectedEvents = ctx.recentLevelEvents.filter(
      (event) => Math.abs(event.level - ctx.selectedLevel!.price) < 1e-6,
    );
    const eventCounts = {
      near_miss: selectedEvents.filter((e) => e.eventKind === "near_miss").length,
      overshoot: selectedEvents.filter((e) => e.eventKind === "overshoot").length,
      clean_break: selectedEvents.filter((e) => e.eventKind === "clean_break").length,
      chop: selectedEvents.filter((e) => e.eventKind === "chop").length,
    };
    const lastEvent = selectedEvents[0] ?? null;
    lines.push(`- last event kind: ${lastEvent ? eventKindLabel(lastEvent.eventKind) : "—"}`);
    lines.push(
      `- last event time: ${lastEvent ? formatTouchEventTime(lastEvent.time) : "—"}`,
    );
    lines.push(`- near miss count: ${eventCounts.near_miss}`);
    lines.push(`- overshoot count: ${eventCounts.overshoot}`);
    lines.push(`- clean break count: ${eventCounts.clean_break}`);
    lines.push(`- chop count: ${eventCounts.chop}`);
    lines.push(`- active approaches: ${ctx.activeApproachCount}`);
  } else {
    lines.push("- level: —");
  }
  lines.push("");

  lines.push("## Approach model");
  lines.push(`- hard buffer width: ${formatNum(ctx.bufferWidth)}`);
  lines.push(`- approach width: ${formatNum(ctx.approachWidth)}`);
  lines.push(`- approach factor: ${ctx.approachFactor} (${resolveApproachFactorValue(ctx.approachFactor)}x)`);
  if (ctx.selectedLevel && ctx.approachWidth != null) {
    const zone = buildApproachZone(ctx.selectedLevel.price, ctx.approachWidth);
    lines.push(
      `- selected level approach zone: ${formatDirectionalPriceRange(zone.from, zone.to)}`,
    );
  } else {
    lines.push("- selected level approach zone: —");
  }
  lines.push("- event kinds supported: touch, near_miss, overshoot, clean_break, chop");
  lines.push("");

  lines.push("## Recent level events");
  for (const event of ctx.recentLevelEvents.slice(0, 30)) {
    lines.push(
      `- ${formatTouchEventTime(event.time)} · level ${event.level} · ${eventKindLabel(event.eventKind)} · ${event.direction === "from_below" ? "from below" : "from above"} · ${formatReactionType(event.outcome)} · distance ${formatNum(event.distanceToLevel)} · hard ${event.enteredHardBuffer ? "yes" : "no"} · approach ${event.enteredApproachZone ? "yes" : "no"} · dive ${formatNum(event.maxDiveAbs)} · bounce ${formatNum(event.maxBounceAbs)} · volume ${formatVolumeMultiplier(event.volumeRatio)} · bar ${Number.isFinite(event.barIndex) ? event.barIndex : "n/a"} · event ${event.id}`,
    );
  }
  if (ctx.recentLevelEvents.length === 0) {
    lines.push("- no level events");
  }
  lines.push("");

  lines.push("## Active approaches");
  for (const approach of prioritizedApproaches) {
    lines.push(
      `- level ${approach.level} · ${approach.direction === "up" ? "from below" : "from above"} · ${approachOutcomeLabel(approach.outcome)} · end ${formatTouchEventTime(approach.endTime)}`,
    );
  }
  if (prioritizedApproaches.length === 0) {
    lines.push("- no active approaches");
  }

  return lines.join("\n");
}

export function buildStrategyLabJsonExport(ctx: StrategyLabExportContext): string {
  const prioritizedApproaches = prioritizeActiveApproaches(
    ctx.activeApproaches,
    ctx.selectedLevel?.price ?? null,
    ctx.currentPrice,
    15,
  );

  const payload = sanitizeJsonValue({
    schemaVersion: STRATEGY_LAB_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    strategy: ctx.strategy,
    ticker: ctx.ticker,
    board: ctx.board,
    timeframe: ctx.timeframe,
    period: ctx.period,
    status: ctx.status,
    candleCount: ctx.candleCount,
    visibleRange:
      ctx.visibleRangeFrom != null && ctx.visibleRangeTo != null
        ? { from: ctx.visibleRangeFrom, to: ctx.visibleRangeTo }
        : null,
    selectedLevel: ctx.selectedLevel?.price ?? null,
    layerModes: ctx.layerModes,
    approachModel: {
      hardBufferWidth: roundExportNumber(ctx.bufferWidth ?? 0, 4),
      approachWidth: roundExportNumber(ctx.approachWidth ?? 0, 4),
      approachFactor: ctx.approachFactor,
      approachFactorValue: resolveApproachFactorValue(ctx.approachFactor),
      selectedApproachZone:
        ctx.selectedLevel && ctx.approachWidth != null
          ? buildApproachZone(ctx.selectedLevel.price, ctx.approachWidth)
          : null,
      eventKindsSupported: ["touch", "near_miss", "overshoot", "clean_break", "chop"],
    },
    technicalSummary: ctx.technicalSummary
      ? {
          instrumentScore: roundExportNumber(ctx.technicalSummary.instrumentTechnicalityScore, 2),
          touches: ctx.technicalSummary.totalTouches,
          bounceRate: roundExportNumber(ctx.technicalSummary.bounceRate ?? 0, 4),
          breakoutRate: roundExportNumber(ctx.technicalSummary.breakoutRate ?? 0, 4),
          falseBreakRate: roundExportNumber(ctx.technicalSummary.falseBreakRate ?? 0, 4),
          chopRate: roundExportNumber(ctx.technicalSummary.chopRate ?? 0, 4),
          avgBounce: roundExportNumber(ctx.technicalSummary.avgBounce ?? 0, 4),
          avgDive: roundExportNumber(ctx.technicalSummary.avgDive ?? 0, 4),
          strongestLevels: ctx.technicalSummary.bestLevels.map((level) => level.level),
        }
      : null,
    movementStructure: {
      lastPivot: ctx.movement.lastPivot,
      currentSwing: ctx.movement.movementDirection,
      nearestRoundLevel: ctx.movement.nearestLevel,
      distanceToLevel: ctx.movement.nearestDistance,
      currentPrice: ctx.currentPrice,
      directionIntoSelectedLevel: ctx.directionIntoSelectedLevel,
    },
    selectedLevelStats: ctx.selectedLevelStats,
    zones: ctx.directionalBufferZone
      ? {
          reaction: ctx.directionalBufferZone.reactionZone,
          break: ctx.directionalBufferZone.breakZone,
          bufferWidth: roundExportNumber(ctx.directionalBufferZone.buffer, 4),
          bufferSource: ctx.bufferSource,
        }
      : null,
    recentLevelEvents: ctx.recentLevelEvents.slice(0, 30).map((event) => ({
      id: event.id,
      time: event.time,
      level: event.level,
      eventKind: event.eventKind,
      direction: event.direction,
      outcome: event.outcome,
      distanceToLevel: roundExportNumber(event.distanceToLevel, 4),
      enteredHardBuffer: event.enteredHardBuffer,
      enteredApproachZone: event.enteredApproachZone,
      dive: event.maxDiveAbs != null ? roundExportNumber(event.maxDiveAbs, 4) : null,
      bounce: event.maxBounceAbs != null ? roundExportNumber(event.maxBounceAbs, 4) : null,
      volumeMultiplier: event.volumeRatio ?? null,
      barIndex: event.barIndex,
    })),
    recentTouchEvents: ctx.recentTouches
      .filter((touch) => touch.outcome !== "pending")
      .slice(0, 30)
      .map((touch) => ({
        id: touch.id,
        time: touch.touchTime,
        level: touch.level,
        approach: touch.approach,
        outcome: touch.outcome,
        dive: roundExportNumber(touch.maxDiveAbs, 4),
        bounce: roundExportNumber(touch.maxBounceAbs, 4),
        volumeMultiplier: touch.volumeRatio ?? null,
        barIndex: touch.touchIndex,
      })),
    activeApproaches: prioritizedApproaches,
    levelsTop: ctx.levelsTable.slice(0, 20).map((row) => ({
      level: row.level.price,
      label: row.level.label,
      importance: row.level.importance,
      stats: row.stats,
    })),
  });
  return JSON.stringify(payload, null, 2);
}

export const AI_EXPORT_REQUIRED_SECTIONS = [
  "## Context",
  "## Technical summary",
  "## Movement structure",
  "## Selected level",
  "## Approach model",
  "## Recent level events",
  "## Active approaches",
] as const;
