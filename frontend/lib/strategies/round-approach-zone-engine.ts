import { roundToStep } from "@/lib/strategies/round-levels-engine";

export type ApproachFactorMode = "auto" | "2x" | "2.5x" | "3x";

export type LevelEventKind = "touch" | "near_miss" | "overshoot" | "clean_break" | "chop";

export const DEFAULT_APPROACH_FACTOR_MODE: ApproachFactorMode = "auto";
export const DEFAULT_SHOW_NEAR_MISS = true;
export const DEFAULT_CONTEXT_HUD_EXPANDED = false;

const EPS = 1e-6;

export function resolveApproachFactorValue(mode: ApproachFactorMode): number {
  if (mode === "2x") return 2.0;
  if (mode === "2.5x") return 2.5;
  if (mode === "3x") return 3.0;
  return 2.0;
}

export function computeApproachWidth(
  hardBufferWidth: number,
  factorMode: ApproachFactorMode = "auto",
  options?: { atr?: number; minTick?: number },
): number {
  if (!Number.isFinite(hardBufferWidth) || hardBufferWidth <= 0) return 0;

  const factor = resolveApproachFactorValue(factorMode);
  let width = hardBufferWidth * factor;

  if (factorMode === "auto" && options?.atr != null && Number.isFinite(options.atr) && options.atr > 0) {
    width = Math.max(width, options.atr * 0.5);
  }
  if (options?.minTick != null && Number.isFinite(options.minTick) && options.minTick > 0) {
    width = Math.max(width, options.minTick * 2);
  }

  return width;
}

export function buildApproachZone(
  level: number,
  approachWidth: number,
  minStep = 0.01,
): { from: number; to: number } {
  const snap = (value: number) => roundToStep(value, minStep);
  return {
    from: snap(level - approachWidth),
    to: snap(level + approachWidth),
  };
}

export function candleEntersZone(
  candle: { low: number; high: number },
  zone: { from: number; to: number },
): boolean {
  if (!Number.isFinite(candle.low) || !Number.isFinite(candle.high)) return false;
  return candle.high >= zone.from - EPS && candle.low <= zone.to + EPS;
}

export function classifyEventKind(
  outcome: "bounce" | "breakout" | "false_break" | "chop" | "pending" | undefined,
  enteredHardBuffer: boolean,
  enteredApproachZone: boolean,
): LevelEventKind {
  if (!enteredApproachZone) return "touch";

  if (!enteredHardBuffer) {
    return "near_miss";
  }

  if (outcome === "false_break") return "overshoot";
  if (outcome === "breakout") return "clean_break";
  if (outcome === "chop") return "chop";
  return "touch";
}

export function eventKindLabel(kind: LevelEventKind): string {
  if (kind === "near_miss") return "near miss";
  if (kind === "clean_break") return "clean break";
  return kind;
}

export function eventKindLabelRu(kind: LevelEventKind): string {
  if (kind === "near_miss") return "недоход";
  if (kind === "overshoot") return "прокол";
  if (kind === "clean_break") return "пробой";
  if (kind === "chop") return "пила";
  return "касание";
}

export type RoundLevelEvent = {
  id: string;
  level: number;
  eventKind: LevelEventKind;
  direction: "from_above" | "from_below";
  outcome: "bounce" | "breakout" | "false_break" | "chop" | "pending";
  time: number;
  barIndex: number;
  distanceToLevel: number;
  enteredHardBuffer: boolean;
  enteredApproachZone: boolean;
  maxDiveAbs?: number;
  maxBounceAbs?: number;
  volumeRatio?: number;
  approachZoneFrom?: number;
  approachZoneTo?: number;
};

export function approachDirectionToFrom(
  direction: "up" | "down",
): "from_above" | "from_below" {
  return direction === "up" ? "from_below" : "from_above";
}
