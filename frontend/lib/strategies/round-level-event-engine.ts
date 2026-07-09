import type { RoundLevelApproachSegment } from "@/lib/strategies/round-level-approach-engine";
import type { RoundLevelTouchEvent } from "@/lib/strategies/round-level-reaction-engine";
import {
  approachDirectionToFrom,
  classifyEventKind,
  type LevelEventKind,
  type RoundLevelEvent,
} from "@/lib/strategies/round-approach-zone-engine";

export type { LevelEventKind, RoundLevelEvent };

export function approachSegmentToLevelEvent(segment: RoundLevelApproachSegment): RoundLevelEvent {
  const eventKind =
    segment.eventKind ??
    classifyEventKind(
      segment.outcome,
      segment.enteredHardBuffer ?? true,
      segment.enteredApproachZone ?? true,
    );

  return {
    id: segment.id,
    level: segment.level,
    eventKind,
    direction: approachDirectionToFrom(segment.direction),
    outcome: segment.outcome ?? "pending",
    time: segment.endTime,
    barIndex: segment.toIndex,
    distanceToLevel: segment.distanceToLevel ?? Math.abs(segment.endPrice - segment.level),
    enteredHardBuffer: segment.enteredHardBuffer ?? eventKind !== "near_miss",
    enteredApproachZone: segment.enteredApproachZone ?? true,
    approachZoneFrom: segment.approachZone?.from,
    approachZoneTo: segment.approachZone?.to,
  };
}

export function touchEventToLevelEvent(touch: RoundLevelTouchEvent): RoundLevelEvent {
  const eventKind = classifyEventKind(touch.outcome, true, true);

  return {
    id: touch.id,
    level: touch.level,
    eventKind,
    direction:
      touch.approach === "from_below"
        ? "from_below"
        : touch.approach === "from_above"
          ? "from_above"
          : "from_below",
    outcome: touch.outcome,
    time: touch.touchTime,
    barIndex: touch.touchIndex,
    distanceToLevel: Math.abs(touch.entryPrice - touch.level),
    enteredHardBuffer: true,
    enteredApproachZone: true,
    maxDiveAbs: touch.maxDiveAbs,
    maxBounceAbs: touch.maxBounceAbs,
    volumeRatio: touch.volumeRatio,
  };
}

export function buildRecentLevelEvents(options: {
  approaches: RoundLevelApproachSegment[];
  touches: RoundLevelTouchEvent[];
  limit?: number;
}): RoundLevelEvent[] {
  const { approaches, touches, limit = 30 } = options;
  const byId = new Map<string, RoundLevelEvent>();

  for (const touch of touches) {
    byId.set(touch.id, touchEventToLevelEvent(touch));
  }

  for (const approach of approaches) {
    const event = approachSegmentToLevelEvent(approach);
    if (!byId.has(event.id)) {
      byId.set(event.id, event);
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.time - a.time)
    .slice(0, limit);
}

export function countEventsByKind(
  events: RoundLevelEvent[],
  level: number | null,
): Record<LevelEventKind, number> {
  const counts: Record<LevelEventKind, number> = {
    touch: 0,
    near_miss: 0,
    overshoot: 0,
    clean_break: 0,
    chop: 0,
  };

  for (const event of events) {
    if (level != null && Math.abs(event.level - level) > 1e-6) continue;
    counts[event.eventKind] += 1;
  }

  return counts;
}

export function latestEventForLevel(
  events: RoundLevelEvent[],
  level: number | null,
): RoundLevelEvent | null {
  if (level == null) return null;
  const filtered = events.filter((event) => Math.abs(event.level - level) < 1e-6);
  return filtered.length > 0 ? filtered[0] ?? null : null;
}

/** QA helper: near_miss case level 94, extremum 93.74 */
export function isNearMissCase(
  level: number,
  extremum: number,
  hardBuffer: number,
  approachWidth: number,
): boolean {
  const hardLower = level - hardBuffer;
  const approachLower = level - approachWidth;
  return (
    extremum >= approachLower - 1e-6 &&
    extremum < hardLower - 1e-6 &&
    Math.abs(extremum - level) > 1e-6
  );
}
