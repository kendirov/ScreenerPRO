import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";
import type { PointsPairKey } from "@/lib/domain/currency-correlation-points-model";
import type { IntradayCurrencyResponse } from "@/lib/domain/currency-correlation-intraday";
import { alignIntradayForPair } from "@/lib/domain/currency-time-series-align";
import { PAIR_DEFS, getPairConfig } from "@/lib/domain/currency-pair-config";
import {
  calculatePairDivergence,
  DEFAULT_PAIR_Z_WINDOW,
  formatPairSpreadValue,
} from "@/lib/domain/currency-pair-divergence";
import type { ContractPointSpec, SpreadUnitMode } from "@/lib/domain/currency-spread-units";
import {
  DEFAULT_SPREAD_ANCHOR_MODE,
  divergenceOptionsFromResolution,
  resolveSpreadAnchor,
  type SpreadAnchorMode,
} from "@/lib/domain/currency-spread-anchor";
import {
  analyzeSpreadPairLifecycle,
  LIFECYCLE_STATE_LABEL_RU,
  type SpreadLifecycleSensitivity,
  type SpreadLifecycleState,
  type SpreadPairLifecycleCurrent,
} from "@/lib/domain/spread-lifecycle";

const MIN_POINTS = 5;

const STRETCH_STATES: SpreadLifecycleState[] = [
  "stretch",
  "extreme",
  "breakdown",
  "outside-week-context",
];

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

export type DivergenceMapCard = {
  pairKey: PointsPairKey;
  label: string;
  modeLabelRu: string;
  experimental: boolean;
  available: boolean;
  current: SpreadPairLifecycleCurrent;
  displaySpread: number | null;
  displaySpreadFormatted: string;
  lastCandleLabel: string;
};

export type DivergenceMapModel = {
  hasData: boolean;
  headline: string;
  cards: DivergenceMapCard[];
  currentByPair: Partial<Record<PointsPairKey, SpreadPairLifecycleCurrent>>;
};

/** Позиция маркера на шкале z ∈ [−3, +3] (0–100%). */
export function divergenceZScalePercent(z: number | null): number {
  if (z == null || !Number.isFinite(z)) return 50;
  const clamped = Math.max(-3, Math.min(3, z));
  return ((clamped + 3) / 6) * 100;
}

function buildHeadline(cards: DivergenceMapCard[]): string {
  const stretched = cards.filter(
    (c) => c.available && STRETCH_STATES.includes(c.current.state),
  );
  if (!stretched.length) return "Сильных расхождений сейчас нет.";

  const top = stretched.reduce((best, c) => {
    const abs = Math.abs(c.current.currentZ ?? 0);
    const bestAbs = Math.abs(best.current.currentZ ?? 0);
    return abs > bestAbs ? c : best;
  });

  const z = top.current.currentZ;
  const zText = z != null && Number.isFinite(z) ? z.toFixed(1) : "—";
  return `Сильнее всего растянута: ${top.label}, z=${zText}, ${top.current.leaderLabel}.`;
}

export type BuildDivergenceMapOptions = {
  unitMode?: SpreadUnitMode;
  specsByFamily?: Partial<Record<CurrencyCorrelationFamily, ContractPointSpec>>;
  anchorMode?: SpreadAnchorMode;
  manualAnchorTime?: string | null;
};

export function buildDivergenceMapModel(
  response: IntradayCurrencyResponse | undefined,
  sensitivity: SpreadLifecycleSensitivity = "standard",
  hedgeRatio = 1,
  options: BuildDivergenceMapOptions = {},
): DivergenceMapModel | null {
  if (!response) return null;

  const displayMode = options.unitMode ?? "raw-points";
  const specs = options.specsByFamily ?? {};

  const okInstruments = response.instruments.filter(
    (i) => i.status === "ok" && i.points.length > 0,
  );
  const seriesInput: Record<string, (typeof okInstruments)[0]["points"]> = {};
  for (const inst of okInstruments) {
    seriesInput[inst.family] = inst.points;
  }

  const families = new Set(okInstruments.map((i) => i.family)) as Set<CurrencyCorrelationFamily>;

  const cards: DivergenceMapCard[] = [];
  const currentByPair: Partial<Record<PointsPairKey, SpreadPairLifecycleCurrent>> = {};

  for (const p of PAIR_DEFS) {
    const pairAligned = alignIntradayForPair(p.pairKey, seriesInput, response.usedInterval);
    const aligned = pairAligned?.rows ?? [];
    const lastCandleLabel =
      aligned.length > 0 ? formatTimeLabel(aligned[aligned.length - 1]!.timestamp) : "—";
    const available = families.has(p.a) && families.has(p.b) && aligned.length >= MIN_POINTS;
    if (!available) {
      const emptyCurrent: SpreadPairLifecycleCurrent = {
        pairKey: p.pairKey,
        pairLabel: p.pairKey.replace("/", " − "),
        familyA: p.a,
        familyB: p.b,
        currentSpread: null,
        currentZ: null,
        state: "normal",
        stateLabel: LIFECYCLE_STATE_LABEL_RU.normal,
        leaderLabel: "—",
        barsInZone: 0,
        lastEvent: null,
        weeklyContextSummary: "мало недель для статистики",
        weeklyPositionLabel: "—",
        returnStatusLabel: "—",
        barsOutsideNorm: 0,
      };
      const config = getPairConfig(p.pairKey);
      cards.push({
        pairKey: p.pairKey,
        label: p.pairKey.replace("/", " − "),
        modeLabelRu: config.modeLabelRu,
        experimental: config.availability === "experimental",
        available: false,
        current: emptyCurrent,
        displaySpread: null,
        displaySpreadFormatted: "—",
        lastCandleLabel: "—",
      });
      continue;
    }

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

    const lifecycle = analyzeSpreadPairLifecycle(
      aligned,
      p.pairKey,
      p.a,
      p.b,
      sensitivity,
      hedgeRatio,
      anchorOpts,
      anchorResolution,
    );
    if (!lifecycle) {
      continue;
    }

    const config = getPairConfig(p.pairKey);
    const divergence = calculatePairDivergence(
      aligned,
      p.pairKey,
      hedgeRatio,
      DEFAULT_PAIR_Z_WINDOW,
      anchorOpts,
    );
    const lastIdx = aligned.length - 1;
    const displaySpread =
      divergence?.spread[lastIdx] != null && Number.isFinite(divergence.spread[lastIdx])
        ? divergence.spread[lastIdx]!
        : lifecycle.current.currentSpread;

    const current = lifecycle.current;
    currentByPair[p.pairKey] = current;

    cards.push({
      pairKey: p.pairKey,
      label: current.pairLabel,
      modeLabelRu: config.modeLabelRu,
      experimental: config.availability === "experimental",
      available: true,
      current,
      displaySpread:
        displaySpread != null && Number.isFinite(displaySpread) ? displaySpread : null,
      displaySpreadFormatted:
        displaySpread != null && Number.isFinite(displaySpread)
          ? formatPairSpreadValue(displaySpread, config)
          : "—",
      lastCandleLabel,
    });
  }

  return {
    hasData: cards.some((c) => c.available),
    headline: buildHeadline(cards),
    cards,
    currentByPair,
  };
}
