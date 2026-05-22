import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { IntradayCurrencyResponse } from "@/lib/domain/currency-correlation-intraday";
import { findSpreadEvents, type SpreadEvent } from "@/lib/domain/currency-intraday-series";
import { alignIntradayForPair } from "@/lib/domain/currency-time-series-align";
import type { AlignedIntradayRow } from "@/lib/domain/currency-intraday-series";
import { PAIR_DEFS, getPairConfig } from "@/lib/domain/currency-pair-config";
import {
  calculatePairDivergence,
  DEFAULT_PAIR_Z_WINDOW,
  formatPairSpreadValue,
  getPairStrengthLabel,
  zScoreBadgeFromZ,
} from "@/lib/domain/currency-pair-divergence";
import {
  barsBetweenTimestamps,
  DEFAULT_SPREAD_ANCHOR_MODE,
  divergenceOptionsFromResolution,
  durationLabelFromAnchor,
  resolveSpreadAnchor,
  SPREAD_ANCHOR_MODE_LABELS,
  type SpreadAnchorMode,
} from "@/lib/domain/currency-spread-anchor";
import type { ContractPointSpec, SpreadUnitMode } from "@/lib/domain/currency-spread-units";

import {
  LIFECYCLE_SENSITIVITY_LABELS,
  SPREAD_LIFECYCLE_THRESHOLDS,
  type SpreadLifecycleSensitivity,
} from "@/lib/domain/spread-lifecycle";

export type SpreadScannerSensitivity = SpreadLifecycleSensitivity;

export const SPREAD_SCANNER_SENSITIVITY_Z: Record<SpreadScannerSensitivity, number> = {
  soft: SPREAD_LIFECYCLE_THRESHOLDS.soft.stretch,
  standard: SPREAD_LIFECYCLE_THRESHOLDS.standard.stretch,
  strict: SPREAD_LIFECYCLE_THRESHOLDS.strict.stretch,
};

export { LIFECYCLE_SENSITIVITY_LABELS as SCANNER_SENSITIVITY_LABELS };

export type ScannerStatusLabel =
  | "спокойно"
  | "наблюдение"
  | "расхождение"
  | "сильное расхождение"
  | "—";

export type ScannerDirectionLabel =
  | "SI сильнее"
  | "CNY сильнее"
  | "ED сильнее"
  | "ED отдельно"
  | "—";

export type SpreadScannerCard = {
  pairKey: PointsPairKey;
  label: string;
  modeLabelRu: string;
  experimental: boolean;
  familyA: CurrencyCorrelationFamily;
  familyB: CurrencyCorrelationFamily;
  currentSpread: number | null;
  currentSpreadFormatted: string;
  currentZ: number | null;
  status: ScannerStatusLabel;
  zBadge: ReturnType<typeof zScoreBadgeFromZ>;
  direction: ScannerDirectionLabel;
  lastCandleLabel: string;
  candlesInCalc: number;
  available: boolean;
};

export type SpreadScannerTimelineItem = {
  timestamp: string;
  timeLabel: string;
  pair: string;
  spreadPoints: number;
  zScore: number;
  direction: ScannerDirectionLabel;
  anchorModeLabel: string;
  durationFromAnchor: string;
  spreadFromAnchor: number;
};

export type SpreadScannerModel = {
  hasData: boolean;
  sensitivity: SpreadScannerSensitivity;
  zThreshold: number;
  cards: SpreadScannerCard[];
  recentEvents: SpreadScannerTimelineItem[];
  commonTimestamps: number;
};

const Z_WINDOW = DEFAULT_PAIR_Z_WINDOW;
const MIN_POINTS = 5;

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function scannerStatusFromZ(
  z: number | null,
  sensitivityZ: number,
): ScannerStatusLabel {
  if (z == null || !Number.isFinite(z)) return "—";
  const abs = Math.abs(z);
  if (abs >= 2) return "сильное расхождение";
  if (abs >= sensitivityZ) return "расхождение";
  if (abs >= 1) return "наблюдение";
  return "спокойно";
}

export function scannerDirectionLabel(
  pairKey: PointsPairKey,
  spread: number | null,
): ScannerDirectionLabel {
  const label = getPairStrengthLabel(getPairConfig(pairKey), spread);
  if (label === "—" || label === "эксперимент" || label === "паритет") return "—";
  if (label.includes("SI сильнее")) return "SI сильнее";
  if (label.includes("CNY сильнее")) return "CNY сильнее";
  if (label.includes("ED сильнее")) return "ED сильнее";
  return "—";
}

function eventToTimelineItem(
  event: SpreadEvent,
  familyA: CurrencyCorrelationFamily,
  familyB: CurrencyCorrelationFamily,
  displaySpread: number,
  anchorModeLabel: string,
  durationFromAnchor: string,
): SpreadScannerTimelineItem {
  return {
    timestamp: event.timestamp,
    timeLabel: formatTimeLabel(event.timestamp),
    pair: event.pair.replace("/", " − "),
    spreadPoints: displaySpread,
    zScore: event.zScore,
    direction: scannerDirectionLabel(event.pair as PointsPairKey, event.spreadPoints),
    anchorModeLabel,
    durationFromAnchor,
    spreadFromAnchor: displaySpread,
  };
}

function buildScannerCard(
  aligned: AlignedIntradayRow[],
  pairKey: PointsPairKey,
  a: CurrencyCorrelationFamily,
  b: CurrencyCorrelationFamily,
  sensitivityZ: number,
  hedgeRatio: number,
  available: boolean,
  anchorOptions?: ReturnType<typeof divergenceOptionsFromResolution>,
): SpreadScannerCard {
  const config = getPairConfig(pairKey);
  if (!available || aligned.length < MIN_POINTS) {
    return {
      pairKey,
      label: config.label,
      modeLabelRu: config.modeLabelRu,
      experimental: config.availability === "experimental",
      familyA: a,
      familyB: b,
      currentSpread: null,
      currentSpreadFormatted: "—",
      currentZ: null,
      status: "—",
      zBadge: "—",
      direction: "—",
      lastCandleLabel: "—",
      candlesInCalc: 0,
      available: false,
    };
  }

  const divergence = calculatePairDivergence(
    aligned,
    pairKey,
    hedgeRatio,
    Z_WINDOW,
    anchorOptions,
  );
  const lastIdx = (divergence?.spread.length ?? 1) - 1;
  const lastSpread = divergence?.spread[lastIdx] ?? null;
  const lastZ = divergence?.zScores[lastIdx] ?? null;
  const lastRow = aligned[aligned.length - 1]!;

  return {
    pairKey,
    label: config.label,
    modeLabelRu: config.modeLabelRu,
    experimental: config.availability === "experimental",
    familyA: a,
    familyB: b,
    currentSpread:
      lastSpread != null && Number.isFinite(lastSpread) ? lastSpread : null,
    currentSpreadFormatted: formatPairSpreadValue(lastSpread, config),
    currentZ: lastZ,
    status: scannerStatusFromZ(lastZ, sensitivityZ),
    zBadge: zScoreBadgeFromZ(lastZ),
    direction: scannerDirectionLabel(pairKey, lastSpread),
    lastCandleLabel: formatTimeLabel(lastRow.timestamp),
    candlesInCalc: aligned.length,
    available: true,
  };
}

export type BuildSpreadScannerOptions = {
  unitMode?: SpreadUnitMode;
  specsByFamily?: Partial<Record<CurrencyCorrelationFamily, ContractPointSpec>>;
  anchorMode?: SpreadAnchorMode;
  manualAnchorTime?: string | null;
};

export function buildSpreadScannerModel(
  response: IntradayCurrencyResponse | undefined,
  sensitivity: SpreadScannerSensitivity = "standard",
  hedgeRatio = 1,
  options: BuildSpreadScannerOptions = {},
): SpreadScannerModel | null {
  if (!response) return null;

  const displayMode = options.unitMode ?? "raw-points";
  const specs = options.specsByFamily ?? {};
  const sensitivityZ = SPREAD_SCANNER_SENSITIVITY_Z[sensitivity];
  const okInstruments = response.instruments.filter(
    (i) => i.status === "ok" && i.points.length > 0,
  );
  const seriesInput: Record<string, (typeof okInstruments)[0]["points"]> = {};
  for (const inst of okInstruments) {
    seriesInput[inst.family] = inst.points;
  }

  const families = new Set(
    okInstruments.map((i) => i.family),
  ) as Set<CurrencyCorrelationFamily>;

  const cards: SpreadScannerCard[] = PAIR_DEFS.map((p) => {
    const pairAligned = alignIntradayForPair(p.pairKey, seriesInput, response.usedInterval);
    const aligned = pairAligned?.rows ?? [];
    const anchorResolution = resolveSpreadAnchor(
      aligned,
      pairAligned?.points,
      options.anchorMode ?? DEFAULT_SPREAD_ANCHOR_MODE,
      {
        manualAnchorTime: options.manualAnchorTime,
        intervalMinutes: response.usedInterval,
      },
    );
    return buildScannerCard(
      aligned,
      p.pairKey,
      p.a,
      p.b,
      sensitivityZ,
      hedgeRatio,
      families.has(p.a) && families.has(p.b),
      divergenceOptionsFromResolution(anchorResolution),
    );
  });

  let allEvents: SpreadEvent[] = [];
  const eventAnchorMeta = new Map<
    string,
    { anchorModeLabel: string; anchorTs: string }
  >();
  for (const p of PAIR_DEFS) {
    if (!families.has(p.a) || !families.has(p.b)) continue;
    const pairAligned = alignIntradayForPair(p.pairKey, seriesInput, response.usedInterval);
    const aligned = pairAligned?.rows ?? [];
    if (aligned.length < MIN_POINTS) continue;
    const anchorResolution = resolveSpreadAnchor(
      aligned,
      pairAligned?.points,
      options.anchorMode ?? DEFAULT_SPREAD_ANCHOR_MODE,
      {
        manualAnchorTime: options.manualAnchorTime,
        intervalMinutes: response.usedInterval,
      },
    );
    const anchorOpts = divergenceOptionsFromResolution(anchorResolution);
    const events = findSpreadEvents(
      aligned,
      p.pairKey,
      hedgeRatio,
      Z_WINDOW,
      sensitivityZ,
      anchorOpts,
    );
    for (const ev of events) {
      eventAnchorMeta.set(`${ev.timestamp}-${ev.pair}`, {
        anchorModeLabel: SPREAD_ANCHOR_MODE_LABELS[anchorResolution.effectiveMode],
        anchorTs: anchorResolution.timestamp,
      });
    }
    allEvents = allEvents.concat(events);
  }

  const recentEvents = allEvents
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 5)
    .map((e) => {
      const def = PAIR_DEFS.find((p) => p.pairKey === e.pair)!;
      const meta = eventAnchorMeta.get(`${e.timestamp}-${e.pair}`);
      const durationFromAnchor = meta
        ? durationLabelFromAnchor(
            barsBetweenTimestamps(meta.anchorTs, e.timestamp, response.usedInterval),
            response.usedInterval,
          )
        : "—";
      return eventToTimelineItem(
        e,
        def.a,
        def.b,
        e.spreadPoints,
        meta?.anchorModeLabel ?? SPREAD_ANCHOR_MODE_LABELS["period-start"],
        durationFromAnchor,
      );
    });

  const focusAligned =
    alignIntradayForPair("SI/ED", seriesInput, response.usedInterval)?.rows ?? [];

  return {
    hasData:
      cards.some((c) => c.available && c.candlesInCalc >= MIN_POINTS) && families.size >= 2,
    sensitivity,
    zThreshold: sensitivityZ,
    cards,
    recentEvents,
    commonTimestamps: focusAligned.length,
  };
}

/** Позиция на шкале ±2 z (0–100%). */
export function zScoreScalePercent(z: number | null): number {
  if (z == null || !Number.isFinite(z)) return 50;
  const clamped = Math.max(-2, Math.min(2, z));
  return ((clamped + 2) / 4) * 100;
}

export function zScaleTone(z: number | null): "neutral" | "watch" | "alert" {
  if (z == null || !Number.isFinite(z)) return "neutral";
  const abs = Math.abs(z);
  if (abs >= 2) return "alert";
  if (abs >= 1.5) return "watch";
  return "neutral";
}
