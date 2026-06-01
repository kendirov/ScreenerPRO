/** Палитра Spread Lab chart (premium dark / neon glass). */
export const SPREAD_LAB_CHART_COLORS = {
  /** Первая нога сильнее (spread > 0). */
  legAStronger: "#22d3ee",
  legAStrongerFill: "rgba(34,211,238,0.55)",
  legAStrongerLine: "rgba(34,211,238,0.92)",
  /** Вторая нога сильнее (spread < 0). */
  legBStronger: "#fbbf24",
  legBStrongerFill: "rgba(251,191,36,0.5)",
  legBStrongerLine: "rgba(251,191,36,0.88)",
  /** Экстремум окна / зона extreme. */
  extreme: "#a78bfa",
  extremeLine: "rgba(167,139,250,0.65)",
  /** Сильный экстремум. */
  strongExtreme: "#fb7185",
  strongExtremeLine: "rgba(251,113,133,0.7)",
  /** Нулевая линия / нейтраль. */
  zero: "#94a3b8",
  zeroLine: "rgba(148,163,184,0.85)",
  /** Текущая точка. */
  now: "#67e8f9",
  /** Max / min маркеры. */
  maxMarker: "#34d399",
  minMarker: "#f43f5e",
  /** Локальный экстремум. */
  localExtreme: "rgba(167,139,250,0.45)",
  /** Watch zone. */
  watch: "rgba(251,191,36,0.35)",
  grid: "rgba(148,163,184,0.05)",
  crosshair: "rgba(34,211,238,0.18)",
  /** Движение ног: первая / вторая. */
  legMovementA: "rgba(34,211,238,0.88)",
  legMovementB: "rgba(251,191,36,0.88)",
} as const;

export function spreadBarColor(
  value: number,
  abs: number,
  th: { watchPoints: number; divergencePoints: number; strongPoints: number },
): string {
  if (abs >= th.strongPoints) {
    return value >= 0
      ? SPREAD_LAB_CHART_COLORS.strongExtreme
      : SPREAD_LAB_CHART_COLORS.strongExtreme;
  }
  if (abs >= th.divergencePoints) {
    return value >= 0 ? SPREAD_LAB_CHART_COLORS.extreme : SPREAD_LAB_CHART_COLORS.extreme;
  }
  if (abs >= th.watchPoints) {
    return value >= 0 ? SPREAD_LAB_CHART_COLORS.legAStrongerFill : SPREAD_LAB_CHART_COLORS.legBStrongerFill;
  }
  return value >= 0 ? SPREAD_LAB_CHART_COLORS.legAStrongerFill : SPREAD_LAB_CHART_COLORS.legBStrongerFill;
}

export function spreadLineColor(value: number): string {
  return value >= 0
    ? SPREAD_LAB_CHART_COLORS.legAStrongerLine
    : SPREAD_LAB_CHART_COLORS.legBStrongerLine;
}
