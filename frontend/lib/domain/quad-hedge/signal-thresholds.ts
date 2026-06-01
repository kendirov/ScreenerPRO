import type { QuadHedgeSignalState } from "./types";

/**
 * Настраиваемые пороги сигнальной механики квадрохеджа.
 */
export type QuadHedgeSignalThresholds = {
  minPoints: number;
  staleMinutes: number;
  watchZ: number;
  divergenceZ: number;
  strongDivergenceZ: number;
  minDurationPoints: number;
  minSpreadWatchPp: number;
  minSpreadDivergencePp: number;
  minSpreadStrongPp: number;
  minLiquidityRub: number;
  maxDataGap: number;
  spreadNormMaxPp: number;
  watchZApproachRatio: number;
  minFadeBars: number;
};

export const DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS: QuadHedgeSignalThresholds = {
  minPoints: 10,
  staleMinutes: 45,
  watchZ: 1.0,
  divergenceZ: 1.5,
  strongDivergenceZ: 2.0,
  minDurationPoints: 3,
  minSpreadWatchPp: 0.08,
  minSpreadDivergencePp: 0.15,
  minSpreadStrongPp: 0.25,
  minLiquidityRub: 0,
  maxDataGap: 3,
  spreadNormMaxPp: 0.12,
  watchZApproachRatio: 0.75,
  minFadeBars: 2,
};

export const QUAD_HEDGE_SIGNAL_CHIP_LABEL_RU: Record<QuadHedgeSignalState, string> = {
  "no-data": "Нет данных",
  sync: "Синхрон",
  watch: "Наблюдение",
  divergence: "Расхождение",
  "strong-divergence": "Сильное расхождение",
  fade: "Схлопывание",
};

export const QUAD_HEDGE_SIGNAL_OUTPUT_RU: Record<QuadHedgeSignalState, string> = {
  "no-data": "Данных недостаточно — только наблюдение",
  sync: "SI/EU/CN синхронны — общее движение рубля",
  watch: "Наблюдение, расхождение начинает расширяться",
  divergence: "Одна нога заметно оторвалась от других",
  "strong-divergence": "Сильное расхождение — смотреть mean reversion",
  fade: "Расхождение схлопывается",
};

export const QUAD_HEDGE_Z_WATCH = DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS.watchZ;
export const QUAD_HEDGE_Z_DIVERGENCE = DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS.divergenceZ;
export const QUAD_HEDGE_Z_STRONG = DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS.strongDivergenceZ;

export function resolveSignalThresholds(
  overrides?: Partial<QuadHedgeSignalThresholds>,
): QuadHedgeSignalThresholds {
  return { ...DEFAULT_QUAD_HEDGE_SIGNAL_THRESHOLDS, ...overrides };
}
