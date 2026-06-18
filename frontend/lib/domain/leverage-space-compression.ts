/** Учебная шкала «плечо → % хода до ликвидации» (упрощённая модель 100/L). */
export const LEVERAGE_SPACE_COMPRESSION_STEPS = [1, 2, 5, 10, 20, 50] as const;

export type LeverageSpaceCompressionStep = (typeof LEVERAGE_SPACE_COMPRESSION_STEPS)[number];

export type CompressionVisualTier = "calm" | "neutral" | "danger" | "extreme";

export type LeverageSpaceCompressionItem = {
  leverage: LeverageSpaceCompressionStep;
  /** null = 1x, ликвидация в модели неактуальна */
  movePercent: number | null;
  moveLabel: string;
  /** 0–1 для ширины зазора Entry↔Liq (1 = самый широкий в ряду) */
  gapVisual: number;
  visualTier: CompressionVisualTier;
};

const MAX_GAP_PERCENT = 50;

const MOVE_LABEL_BY_STEP: Record<LeverageSpaceCompressionStep, string> = {
  1: "без заёмного риска · ликвидация неактуальна",
  2: "≈50% против позиции",
  5: "≈20% против позиции",
  10: "≈10% против позиции",
  20: "≈5% против позиции",
  50: "≈2% против позиции",
};

export function getLeverageLiquidationMovePercent(leverage: number): number | null {
  const L = Math.max(1, Math.round(leverage));
  if (L <= 1) return null;
  return 100 / L;
}

export function getCompressionVisualTier(leverage: LeverageSpaceCompressionStep): CompressionVisualTier {
  if (leverage <= 2) return "calm";
  if (leverage === 5) return "calm";
  if (leverage === 10) return "neutral";
  if (leverage === 20) return "danger";
  return "extreme";
}

function formatMovePercentForPhrase(movePercent: number): string {
  const rounded = Math.round(movePercent * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Фраза для блока диагностики (текущее плечо с ползунка). */
export function formatLeverageMoveInsightPhrase(leverage: number): string {
  const L = Math.max(1, Math.round(leverage));
  if (L <= 1) {
    return "При 1x заёмного риска нет — ликвидация в этой модели неактуальна.";
  }
  const move = getLeverageLiquidationMovePercent(L);
  if (move == null) {
    return "При 1x заёмного риска нет — ликвидация в этой модели неактуальна.";
  }
  return `При ${L}x достаточно движения примерно на ${formatMovePercentForPhrase(move)}% против позиции.`;
}

export function buildLeverageSpaceCompressionItems(): LeverageSpaceCompressionItem[] {
  return LEVERAGE_SPACE_COMPRESSION_STEPS.map((leverage) => {
    const movePercent = getLeverageLiquidationMovePercent(leverage);
    const gapVisual =
      movePercent == null ? 1 : Math.min(1, Math.max(0.06, movePercent / MAX_GAP_PERCENT));
    return {
      leverage,
      movePercent,
      moveLabel: MOVE_LABEL_BY_STEP[leverage],
      gapVisual,
      visualTier: getCompressionVisualTier(leverage),
    };
  });
}

/** Подсветка карточки при произвольном плече с ползунка (ближайший пресет). */
export function snapLeverageSpaceCompressionStep(leverage: number): LeverageSpaceCompressionStep {
  const L = Math.max(1, Math.round(leverage));
  const exact = LEVERAGE_SPACE_COMPRESSION_STEPS.find((s) => s === L);
  if (exact) return exact;

  let best: LeverageSpaceCompressionStep = LEVERAGE_SPACE_COMPRESSION_STEPS[0];
  let bestDist = Infinity;
  for (const step of LEVERAGE_SPACE_COMPRESSION_STEPS) {
    const d = Math.abs(step - L);
    if (d < bestDist) {
      bestDist = d;
      best = step;
    }
  }
  return best;
}
