/** Пороги расхождения в пунктах (SI/EU/CN: 1 пункт = 1 ₽). */
export type QuadHedgePointThresholds = {
  noisePoints: number;
  watchPoints: number;
  /** Зона экстремума (alias: extremePoints). */
  divergencePoints: number;
  /** Сильный экстремум (alias: strongExtremePoints). */
  strongPoints: number;
  nearExtremePct: number;
  trendLookbackPoints: number;
  minTrendPoints: number;
  minZScorePoints: number;
  /** Мин. prominence локального экстремума (пункты). */
  localExtremeMinProminence: number;
  /** Мин. расстояние между локальными экстремумами (бары). */
  localExtremeMinDistance: number;
  /** Макс. локальных экстремумов на графике. */
  localExtremeMaxMarkers: number;
  /** Мин. точек для перцентильных зон (иначе fixed 100/300/700/900). */
  minPercentilePoints: number;
};

/** Spread Lab — рабочие пороги для SI/CN/EU на 5м истории. */
export const SPREAD_LAB_POINT_THRESHOLDS: QuadHedgePointThresholds = {
  noisePoints: 100,
  watchPoints: 300,
  divergencePoints: 700,
  strongPoints: 900,
  nearExtremePct: 0.12,
  trendLookbackPoints: 5,
  minTrendPoints: 5,
  minZScorePoints: 20,
  localExtremeMinProminence: 150,
  localExtremeMinDistance: 4,
  localExtremeMaxMarkers: 6,
  minPercentilePoints: 40,
};

/** @deprecated Используйте SPREAD_LAB_POINT_THRESHOLDS */
export const DEFAULT_QUAD_HEDGE_POINT_THRESHOLDS = SPREAD_LAB_POINT_THRESHOLDS;

export function resolvePointThresholds(
  overrides?: Partial<QuadHedgePointThresholds>,
): QuadHedgePointThresholds {
  return { ...SPREAD_LAB_POINT_THRESHOLDS, ...overrides };
}

/** Алиасы для конфигурации Spread Lab. */
export function spreadLabThresholdZones(th = SPREAD_LAB_POINT_THRESHOLDS) {
  return {
    noisePoints: th.noisePoints,
    watchPoints: th.watchPoints,
    extremePoints: th.divergencePoints,
    strongExtremePoints: th.strongPoints,
  };
}
