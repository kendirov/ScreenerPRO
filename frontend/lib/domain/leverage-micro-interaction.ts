/** Пороги визуальной обратной связи при смене плеча (Liquidation Map). */
export const LEVERAGE_GLOW_MIN = 20;
export const LEVERAGE_PULSE_MIN = 30;
export const LEVERAGE_EXTREME_MIN = 50;

export const LEVERAGE_50X_WARNING =
  "50x: цена ликвидации почти рядом. Ошибка не оставляет пространства.";

export type LiquidationLineVisualTier = "default" | "glow" | "glow-pulse";

export function getLiquidationLineVisualTier(leverage: number): LiquidationLineVisualTier {
  if (leverage >= LEVERAGE_PULSE_MIN) return "glow-pulse";
  if (leverage >= LEVERAGE_GLOW_MIN) return "glow";
  return "default";
}

export function getLeverage50xWarning(leverage: number, liquidationInactive: boolean): string | null {
  if (liquidationInactive || leverage < LEVERAGE_EXTREME_MIN) return null;
  return LEVERAGE_50X_WARNING;
}

/** ~300ms spring — спокойное движение линий. */
export const LEVERAGE_LEVEL_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 32,
  mass: 0.82,
};

/** Чуть отзывчивее при перетаскивании слайдера плеча. */
export const LEVERAGE_LEVEL_SPRING_LIVE = {
  type: "spring" as const,
  stiffness: 420,
  damping: 29,
  mass: 0.72,
};

/** 250–400ms для числовых метрик. */
export const LEVERAGE_VALUE_TRANSITION = {
  duration: 0.32,
  ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
};

export function getLevelMotionTransition(live: boolean, reduceMotion: boolean) {
  if (reduceMotion) return { duration: 0 };
  return live ? LEVERAGE_LEVEL_SPRING_LIVE : LEVERAGE_LEVEL_SPRING;
}
