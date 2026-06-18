/** Учебный калькулятор perpetual (isolated margin, упрощённые формулы). */

import {
  DIRECTION_FLOW_LONG,
  DIRECTION_FLOW_SHORT,
} from "@/lib/domain/liquidation-map-labels";
import {
  computePositionAutoDiagnosis,
  type PositionAutoDiagnosis,
} from "@/lib/domain/position-auto-diagnosis";

export type PositionSide = "long" | "short";

export const PERPETUAL_LEVERAGE_OPTIONS = [1, 2, 3, 5, 10, 20, 50] as const;

/** Плечи на главном симуляторе и в карточках сравнения */
export const SIMULATOR_LEVERAGE_OPTIONS = [1, 2, 5, 10, 20, 50] as const;

export type SimulatorLeverageOption = (typeof SIMULATOR_LEVERAGE_OPTIONS)[number];

/** Фиксированный вход на главном симуляторе */
export const SIMULATOR_ENTRY_PRICE = 100;

export const SIMULATOR_DEPOSIT_OPTIONS = [20, 100, 500] as const;

export const SIMULATOR_DISCLAIMER =
  "Упрощённая модель. Реальная ликвидация зависит от биржи, maintenance margin, комиссий и режима маржи.";

export const LEVERAGE_ONE_NOTE =
  "Без заёмного плеча ликвидация в этой учебной модели неактуальна.";

/** Stop-loss на главной панели */
export const SIMULATOR_STOP_OPTIONS = [0.5, 1, 2] as const;
export type SimulatorStopOption = (typeof SIMULATOR_STOP_OPTIONS)[number];
export const DEFAULT_SIMULATOR_STOP_PERCENT: SimulatorStopOption = 1;

/** Take profit в R (от размера стопа) */
export const SIMULATOR_TAKE_R_OPTIONS = [1, 2, 3] as const;
export type SimulatorTakeProfitR = (typeof SIMULATOR_TAKE_R_OPTIONS)[number];
export const DEFAULT_SIMULATOR_TAKE_PROFIT_R: SimulatorTakeProfitR = 2;

/** @deprecated — используйте DEFAULT_SIMULATOR_STOP_PERCENT */
export const SIMULATOR_STOP_PERCENT = DEFAULT_SIMULATOR_STOP_PERCENT;

export type RiskLadderPrices = {
  entryPrice: number;
  stopPrice: number;
  takeProfitPrice: number;
  liquidationPrice: number;
  liquidationInactive: boolean;
  airGapPercent: number;
};

export function computeTakeProfitPercent(riskPercent: number, takeProfitR: number): number {
  return Math.max(0, riskPercent) * Math.max(1, takeProfitR);
}

export type AirAfterStopStatus = "inactive" | "invalid" | "tight" | "ok";

export type LiquidationMapMetricsResult = {
  positionSize: number;
  riskPercent: number;
  liquidationDistancePercent: number;
  airAfterStop: number;
  takeProfitPercent: number;
  takeProfitR: number;
  liquidationInactive: boolean;
  airStatus: AirAfterStopStatus;
  statusMessage: string | null;
  proximityWarning: string | null;
};

export function buildAirAfterStopStatus(
  airAfterStop: number,
  liquidationInactive: boolean,
): Pick<LiquidationMapMetricsResult, "airStatus" | "statusMessage" | "proximityWarning"> {
  if (liquidationInactive) {
    return { airStatus: "inactive", statusMessage: null, proximityWarning: null };
  }
  if (airAfterStop <= 0) {
    return {
      airStatus: "invalid",
      statusMessage: "Стоп за зоной ликвидации. Позиция может умереть раньше плана.",
      proximityWarning: "Стоп слишком близко к ликвидации. Сделка не оставляет воздуха.",
    };
  }
  if (airAfterStop < 1) {
    return {
      airStatus: "tight",
      statusMessage: "Воздуха почти нет.",
      proximityWarning: "Стоп слишком близко к ликвидации. Сделка не оставляет воздуха.",
    };
  }
  return {
    airStatus: "ok",
    statusMessage: "Стоп раньше ликвидации. Контроль есть.",
    proximityWarning: null,
  };
}

export function computeLiquidationMapMetrics(
  params: LiquidationSimulatorInput & {
    stopPercent: number;
    takeProfitR: number;
  },
): LiquidationMapMetricsResult {
  const sim = computeLiquidationSimulator(params);
  const riskPercent = Math.max(0, params.stopPercent);
  const takeProfitR = Math.max(1, Math.round(params.takeProfitR));
  const takeProfitPercent = computeTakeProfitPercent(riskPercent, takeProfitR);
  const liquidationDistancePercent = sim.liquidationDistancePercent;
  const liquidationInactive = sim.leverageOneNote != null;
  const airAfterStop = liquidationInactive
    ? 0
    : liquidationDistancePercent - riskPercent;

  const air = buildAirAfterStopStatus(airAfterStop, liquidationInactive);

  return {
    positionSize: sim.positionSize,
    riskPercent,
    liquidationDistancePercent,
    airAfterStop,
    takeProfitPercent,
    takeProfitR,
    liquidationInactive,
    ...air,
  };
}

export function computeRiskLadderPrices(params: {
  entryPrice?: number;
  leverage: number;
  direction: PositionSide;
  /** riskPercent = stop-loss % */
  stopPercent?: number;
  takeProfitR?: number;
}): RiskLadderPrices {
  const entryPrice = clampPositive(params.entryPrice ?? SIMULATOR_ENTRY_PRICE, SIMULATOR_ENTRY_PRICE);
  const leverage = Math.max(1, Math.round(params.leverage));
  const riskPercent = Math.max(0, params.stopPercent ?? DEFAULT_SIMULATOR_STOP_PERCENT);
  const takeProfitR = Math.max(1, Math.round(params.takeProfitR ?? DEFAULT_SIMULATOR_TAKE_PROFIT_R));
  const takeProfitPercent = computeTakeProfitPercent(riskPercent, takeProfitR);
  const { direction } = params;

  const liquidationInactive = leverage === 1;
  const liquidationPrice = liquidationInactive
    ? entryPrice
    : direction === "long"
      ? entryPrice * (1 - 1 / leverage)
      : entryPrice * (1 + 1 / leverage);

  const stopPrice =
    direction === "long"
      ? entryPrice * (1 - riskPercent / 100)
      : entryPrice * (1 + riskPercent / 100);

  const takeProfitPrice =
    direction === "long"
      ? entryPrice * (1 + takeProfitPercent / 100)
      : entryPrice * (1 - takeProfitPercent / 100);

  const airGapPercent =
    liquidationInactive || entryPrice <= 0
      ? 0
      : (Math.abs(stopPrice - liquidationPrice) / entryPrice) * 100;

  return {
    entryPrice,
    stopPrice,
    takeProfitPrice,
    liquidationPrice,
    liquidationInactive,
    airGapPercent,
  };
}

export type LiquidationSimulatorInput = {
  deposit: number;
  leverage: number;
  direction: PositionSide;
  /** По умолчанию SIMULATOR_ENTRY_PRICE */
  entryPrice?: number;
};

export type LiquidationSimulatorResult = {
  positionSize: number;
  margin: number;
  entryPrice: number;
  liquidationPrice: number;
  liquidationDistancePercent: number;
  leverageOneNote: string | null;
  warningMessage: string;
};

/** Учебный расчёт карты ликвидации (явные формулы, без комиссий/funding). */
export function computeLiquidationSimulator(
  input: LiquidationSimulatorInput,
): LiquidationSimulatorResult {
  const deposit = clampPositive(input.deposit, 100);
  const entryPrice = clampPositive(input.entryPrice ?? SIMULATOR_ENTRY_PRICE, SIMULATOR_ENTRY_PRICE);
  const leverage = Math.max(1, Math.round(input.leverage));
  const direction = input.direction;

  const positionSize = deposit * leverage;
  const margin = deposit;

  const liquidationDistancePercent = leverage === 1 ? 0 : 100 / leverage;

  const liquidationPrice =
    leverage === 1
      ? entryPrice
      : direction === "long"
        ? entryPrice * (1 - 1 / leverage)
        : entryPrice * (1 + 1 / leverage);

  return {
    positionSize,
    margin,
    entryPrice,
    liquidationPrice,
    liquidationDistancePercent,
    leverageOneNote: leverage === 1 ? LEVERAGE_ONE_NOTE : null,
    warningMessage: buildSimulatorWarningMessage(leverage, liquidationDistancePercent),
  };
}

export function buildSimulatorWarningMessage(
  leverage: number,
  liquidationDistancePercent: number,
): string {
  if (leverage === 1) return "Плечо 1× — только размер позиции без заёмного объёма.";
  if (leverage >= 20) return "Высокое плечо: ошибка цены почти не оставляет запаса до ликвидации.";
  if (liquidationDistancePercent < 5) return "Ликвидация экстремально близко — малый ход против позиции.";
  if (liquidationDistancePercent < 10) return "Запас до ликвидации уже узкий.";
  if (leverage <= 3) return "Консервативное плечо — больше дистанция до ликвидации.";
  return "Двигай плечо и смотри, как сжимается дистанция до ликвидации.";
}

/** Учебный taker fee для оценки комиссии на главном экране (%). */
export const SIMULATOR_DEFAULT_TAKER_FEE = 0.055;

export type PositionDiagnosticsRiskTier = "educational" | "working" | "high" | "extreme";

export type PositionDiagnostics = {
  positionSize: number;
  leverage: number;
  margin: number;
  entryPrice: number;
  stopPrice: number;
  liquidationPrice: number;
  stopDistancePercent: number;
  stopLossUsd: number;
  liquidationDistancePercent: number;
  liquidationInactive: boolean;
  bufferAfterStopPercent: number;
  roundTripFeeUsd: number;
  riskTier: PositionDiagnosticsRiskTier;
  riskTierLabel: string;
  mainAlert: string;
  /** @deprecated — используйте autoDiagnosis */
  warnings: string[];
  autoDiagnosis: PositionAutoDiagnosis;
};

export function getPositionDiagnosticsRiskTier(leverage: number): {
  tier: PositionDiagnosticsRiskTier;
  label: string;
} {
  const L = Math.max(1, Math.round(leverage));
  if (L <= 3) return { tier: "educational", label: "Учебный режим" };
  if (L <= 10) return { tier: "working", label: L >= 5 ? "Рабочий риск" : "Учебный режим" };
  if (L < 30) return { tier: "high", label: L >= 20 ? "Высокий риск" : "Рабочий риск" };
  return { tier: "extreme", label: "Экстремальный риск" };
}

export function formatPositionDiagnosticsMainAlert(
  leverage: number,
  liquidationDistancePercent: number,
  liquidationInactive: boolean,
): string {
  const L = Math.max(1, Math.round(leverage));
  if (liquidationInactive || L <= 1) {
    return "При 1x заёмного плеча нет — ликвидация в этой учебной модели не применяется.";
  }
  const move = formatPercentFixed(liquidationDistancePercent, 2);
  return `При ${L}x движение цены всего на ${move}% против позиции может привести к ликвидации.`;
}

/** Отрицательный % хода против позиции для диагностики (long: вниз, short: вверх). */
export function formatDiagnosticsAdversePercent(distancePercent: number, decimals = 2): string {
  return `-${formatPercentFixed(distancePercent, decimals)}`;
}

export function computePositionDiagnostics(params: {
  deposit: number;
  leverage: number;
  stopPercent: number;
  direction?: PositionSide;
  takeProfitR?: number;
  takerFee?: number;
}): PositionDiagnostics {
  const deposit = clampPositive(params.deposit, 100);
  const leverage = Math.max(1, Math.round(params.leverage));
  const stopPercent = Math.max(0, params.stopPercent);
  const takerFee = Math.max(0, params.takerFee ?? SIMULATOR_DEFAULT_TAKER_FEE);

  const direction = params.direction ?? "long";
  const sim = computeLiquidationSimulator({ deposit, leverage, direction });
  const ladder = computeRiskLadderPrices({
    leverage,
    direction,
    stopPercent,
    takeProfitR: params.takeProfitR,
  });

  const positionSize = sim.positionSize;
  const stopLossUsd = (positionSize * stopPercent) / 100;
  const liquidationInactive = sim.leverageOneNote != null;
  const bufferAfterStopPercent = liquidationInactive
    ? 0
    : sim.liquidationDistancePercent - stopPercent;
  const roundTripFeeUsd = (positionSize * takerFee * 2) / 100;

  const { tier, label } = getPositionDiagnosticsRiskTier(leverage);
  const mainAlert = formatPositionDiagnosticsMainAlert(
    leverage,
    sim.liquidationDistancePercent,
    liquidationInactive,
  );
  const autoDiagnosis = computePositionAutoDiagnosis({
    deposit,
    leverage,
    stopPercent,
    direction,
    takeProfitR: params.takeProfitR,
  });
  const warnings = autoDiagnosis.lines;

  return {
    positionSize,
    leverage,
    margin: sim.margin,
    entryPrice: ladder.entryPrice,
    stopPrice: ladder.stopPrice,
    liquidationPrice: ladder.liquidationPrice,
    stopDistancePercent: stopPercent,
    stopLossUsd,
    liquidationDistancePercent: sim.liquidationDistancePercent,
    liquidationInactive,
    bufferAfterStopPercent,
    roundTripFeeUsd,
    riskTier: tier,
    riskTierLabel: label,
    mainAlert,
    warnings,
    autoDiagnosis,
  };
}

/** Визуальный tier метрик под шкалой (calm → extreme). */
export type LeverageMetricsVisualTier = "calm" | "warning" | "danger" | "extreme";

export function getLeverageMetricsVisualTier(leverage: number): LeverageMetricsVisualTier {
  const L = Math.max(1, Math.round(leverage));
  if (L >= 20) return "extreme";
  if (L > 10) return "danger";
  if (L > 3) return "warning";
  return "calm";
}

export const LEVERAGE_CHIP_INSIGHTS: Record<SimulatorLeverageOption, string> = {
  1: "Без заёмного плеча ликвидация в этой модели не главный риск.",
  2: "Запас большой: рынок может пройти против позиции около 50%.",
  5: "Рабочий риск: до ликвидации около 20%.",
  10: "Агрессивно: ошибка на 10% может убить позицию.",
  20: "Опасно: 5% против позиции — зона ликвидации.",
  50: "Почти без воздуха: 2% против позиции — критично.",
};

/** Insight для чипов и метрик; при промежуточном плече — ближайший уровень. */
export function getLeverageChipInsight(leverage: number): string {
  const L = Math.max(1, Math.round(leverage));
  const exact = SIMULATOR_LEVERAGE_OPTIONS.find((lev) => lev === L);
  if (exact) return LEVERAGE_CHIP_INSIGHTS[exact];

  let nearest: SimulatorLeverageOption = SIMULATOR_LEVERAGE_OPTIONS[0];
  for (const lev of SIMULATOR_LEVERAGE_OPTIONS) {
    if (Math.abs(lev - L) < Math.abs(nearest - L)) nearest = lev;
  }
  return LEVERAGE_CHIP_INSIGHTS[nearest];
}

/** @deprecated — используйте getLeverageChipInsight */
export function getLeverageDynamicInsight(leverage: number): string {
  return getLeverageChipInsight(leverage);
}

export type LeverageLadderPhraseTone = "calm" | "warm" | "alert" | "danger" | "extreme";

/** @deprecated use LIQUIDATION_MAP_TAKEAWAY from liquidation-map-labels */
export { LIQUIDATION_MAP_TAKEAWAY as TRADE_MECHANIC_TAKEAWAY } from "@/lib/domain/liquidation-map-labels";

/** Главная фраза механики сделки (5-секундное объяснение). */
export function getTradeMechanicHeadline(direction: PositionSide): string {
  return direction === "long" ? DIRECTION_FLOW_LONG : DIRECTION_FLOW_SHORT;
}

/** Крупная фраза над Risk Ladder — одна строка. */
export function getLeverageLadderPhrase(leverage: number): {
  text: string;
  tone: LeverageLadderPhraseTone;
} {
  const L = Math.max(1, Math.round(leverage));

  if (L >= 50) {
    return {
      text: "Экстремальное плечо: 2% против тебя — позиция почти мертва.",
      tone: "extreme",
    };
  }
  if (L >= 20) {
    return {
      text: "Высокое плечо: ликвидация близко, права на хаос нет.",
      tone: "danger",
    };
  }
  if (L > 10) {
    return {
      text: "Воздуха мало: ошибка быстро превращается в потерю контроля.",
      tone: "alert",
    };
  }
  if (L > 5) {
    return {
      text: "Стоп должен быть раньше ликвидации. Без исключений.",
      tone: "warm",
    };
  }
  if (L > 2) {
    return {
      text: "Плечо уже усиливает каждое движение против тебя.",
      tone: "warm",
    };
  }
  return {
    text: "Позиция ещё имеет пространство для ошибки.",
    tone: "calm",
  };
}

const SIMULATOR_ADVANCED_DEFAULTS = {
  stopPercent: 0,
  takerFee: 0,
  makerFee: 0,
  fundingRate: 0,
  fundingPeriods: 0,
  marginMode: "isolated" as MarginMode,
} satisfies Pick<
  PerpetualCalculatorInput,
  "stopPercent" | "takerFee" | "makerFee" | "fundingRate" | "fundingPeriods" | "marginMode"
>;

export type PerpetualAdvancedControlsState = Pick<
  PerpetualCalculatorInput,
  "stopPercent" | "takerFee" | "makerFee" | "fundingRate" | "fundingPeriods" | "marginMode"
>;

export function mergeSimulatorWithAdvanced(
  simulator: LiquidationSimulatorInput,
  advanced: PerpetualAdvancedControlsState,
): PerpetualCalculatorInput {
  return {
    ...simulator,
    entryPrice: simulator.entryPrice ?? SIMULATOR_ENTRY_PRICE,
    ...advanced,
  };
}

/** Расширенный калькулятор (advanced panel). */
export function computeLiquidationSimulatorAdvanced(
  input: LiquidationSimulatorInput & Partial<Pick<PerpetualCalculatorInput, "stopPercent" | "takerFee" | "fundingRate" | "fundingPeriods">>,
): PerpetualCalculatorResult {
  const entryPrice = input.entryPrice ?? SIMULATOR_ENTRY_PRICE;
  return computePerpetualCalculator({ ...input, entryPrice, ...SIMULATOR_ADVANCED_DEFAULTS, ...input });
}

export type PerpetualLeverageOption = (typeof PERPETUAL_LEVERAGE_OPTIONS)[number];

export const PERPETUAL_LIQUIDATION_DISCLAIMER =
  "Расчёт упрощённый. Реальная цена ликвидации зависит от биржи, maintenance margin, комиссии, режима маржи и размера позиции.";

export type MarginMode = "isolated" | "cross";

export type PerpetualCalculatorInput = {
  deposit: number;
  entryPrice: number;
  leverage: number;
  direction: PositionSide;
  /** Дистанция стопа от входа, % */
  stopPercent: number;
  /** Taker fee, % (напр. 0.055) */
  takerFee: number;
  /** Maker fee, % (напр. 0.02) */
  makerFee: number;
  /** Funding rate за период, % (напр. 0.01) */
  fundingRate: number;
  fundingPeriods: number;
  /** Учебная подпись; расчёт ликвидации — isolated */
  marginMode: MarginMode;
};

export const DEFAULT_PERPETUAL_ADVANCED = {
  stopPercent: 1,
  takerFee: 0.055,
  makerFee: 0.02,
  fundingRate: 0.01,
  fundingPeriods: 1,
  marginMode: "isolated" as MarginMode,
};

export const MARGIN_MODE_EXPLANATION: Record<MarginMode, string> = {
  isolated: "Риск ограничен маржой этой позиции — как на главной шкале.",
  cross: "Риск на весь баланс: ликвидация может наступить раньше, чем на изолированной марже.",
};

export type PerpetualCalculatorWarningId =
  | "high-leverage"
  | "stop-near-liquidation"
  | "total-cost-high"
  | "conservative-leverage";

export type PerpetualCalculatorWarning = {
  id: PerpetualCalculatorWarningId;
  message: string;
  severity: "info" | "warn" | "danger";
};

export type PerpetualCalculatorResult = {
  positionSize: number;
  margin: number;
  liquidationPrice: number;
  stopPrice: number;
  lossAtStop: number;
  feeRoundTrip: number;
  fundingCost: number;
  totalEstimatedCost: number;
  liquidationDistancePercent: number;
  warnings: PerpetualCalculatorWarning[];
};

function clampPositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Чистая функция расчёта — без побочных эффектов, пригодна для unit-тестов и verify-скриптов. */
export function computePerpetualCalculator(
  raw: PerpetualCalculatorInput,
): PerpetualCalculatorResult {
  const deposit = clampPositive(raw.deposit, 100);
  const entryPrice = clampPositive(raw.entryPrice, 100);
  const leverage = clampPositive(raw.leverage, 1);
  const stopPercent = Math.max(0, raw.stopPercent);
  const takerFee = Math.max(0, raw.takerFee);
  const makerFee = Math.max(0, raw.makerFee);
  const fundingRate = Math.max(0, raw.fundingRate);
  const fundingPeriods = Math.max(0, raw.fundingPeriods);
  const direction = raw.direction;

  const positionSize = deposit * leverage;
  const margin = deposit;

  const liquidationPrice =
    direction === "long"
      ? entryPrice * (1 - 1 / leverage)
      : entryPrice * (1 + 1 / leverage);

  const stopPrice =
    direction === "long"
      ? entryPrice * (1 - stopPercent / 100)
      : entryPrice * (1 + stopPercent / 100);

  const lossAtStop = (positionSize * stopPercent) / 100;
  const feeRoundTrip = (positionSize * (takerFee + makerFee)) / 100;
  const fundingCost = ((positionSize * fundingRate) / 100) * fundingPeriods;
  const totalEstimatedCost = lossAtStop + feeRoundTrip + fundingCost;

  const liquidationDistancePercent =
    entryPrice > 0 ? (Math.abs(entryPrice - liquidationPrice) / entryPrice) * 100 : 0;

  const warnings = buildPerpetualCalculatorWarnings({
    leverage,
    stopPercent,
    liquidationDistancePercent,
    totalEstimatedCost,
    deposit,
  });

  return {
    positionSize,
    margin,
    liquidationPrice,
    stopPrice,
    lossAtStop,
    feeRoundTrip,
    fundingCost,
    totalEstimatedCost,
    liquidationDistancePercent,
    warnings,
  };
}

export function buildPerpetualCalculatorWarnings(params: {
  leverage: number;
  stopPercent: number;
  liquidationDistancePercent: number;
  totalEstimatedCost: number;
  deposit: number;
}): PerpetualCalculatorWarning[] {
  const warnings: PerpetualCalculatorWarning[] = [];
  const { leverage, stopPercent, liquidationDistancePercent, totalEstimatedCost, deposit } = params;

  if (leverage >= 20) {
    warnings.push({
      id: "high-leverage",
      message: "Высокое плечо: ошибка почти не оставляет пространства.",
      severity: "danger",
    });
  }

  if (
    liquidationDistancePercent > 0 &&
    stopPercent >= liquidationDistancePercent * 0.7
  ) {
    warnings.push({
      id: "stop-near-liquidation",
      message: "Стоп слишком близко к зоне ликвидации.",
      severity: "warn",
    });
  }

  if (deposit > 0 && totalEstimatedCost > deposit * 0.2) {
    warnings.push({
      id: "total-cost-high",
      message: "Риск сделки слишком большой для депозита.",
      severity: "warn",
    });
  }

  if (leverage <= 3) {
    warnings.push({
      id: "conservative-leverage",
      message: "Консервативный режим для обучения.",
      severity: "info",
    });
  }

  return warnings;
}

function usdFractionDigits(value: number): number {
  const abs = Math.abs(value);
  if (abs >= 1000 && Number.isInteger(value)) return 0;
  if (abs >= 100 && Number.isInteger(value)) return 0;
  if (abs >= 1) return 2;
  return 4;
}

/** $100 · $1,000 · $1,234.56 */
export function formatUsd(value: number, fractionDigits?: number): string {
  const digits = fractionDigits ?? usdFractionDigits(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** @deprecated — используйте formatUsd */
export function formatUsdt(value: number, digits = 2): string {
  return formatUsd(value, digits);
}

export function formatPrice(value: number): string {
  return formatUsd(value);
}

/** 10× */
export function formatLeverageX(leverage: number): string {
  return `${Math.round(leverage)}×`;
}

/** 5.00% */
export function formatPercentFixed(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

/** +1.2% — для ROE / PnL */
export function formatPct(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

/** Уровни для блока сравнения плеча на симуляторе */
export const LEVERAGE_IMPACT_LEVELS = [1, 2, 5, 10, 20, 50] as const;

export type LeverageImpactLevel = (typeof LEVERAGE_IMPACT_LEVELS)[number];

export type LeverageImpactRiskLevel = "low" | "moderate" | "high" | "very-high" | "extreme";

export type LeverageImpactVisualTier = "calm" | "warm" | "hot" | "extreme";

/** Цвет карточки выбора плеча: 1–2 cyan, 5–10 amber, 20–50 red */
export type LeveragePickCardTone = "cyan" | "amber" | "red";

export type LeverageImpactCard = {
  leverage: LeverageImpactLevel;
  positionSize: number;
  adverseMoveText: string;
  /** Упрощённо: 100 / leverage (для long isolated без MM) */
  adverseMovePercent: number | null;
  /** Короткий статус на карточке */
  statusLabel: string;
  cardTone: LeveragePickCardTone;
  riskLabel: string;
  riskLevel: LeverageImpactRiskLevel;
  visualTier: LeverageImpactVisualTier;
  showWarning: boolean;
};

export const LEVERAGE_IMPACT_DISCLAIMER =
  "Упрощённая учебная модель: без maintenance margin, комиссий и funding. На бирже пороги ликвидации строже.";

function resolveLeverageImpactMeta(leverage: LeverageImpactLevel): Pick<
  LeverageImpactCard,
  "statusLabel" | "cardTone" | "riskLabel" | "riskLevel" | "visualTier" | "showWarning"
> {
  switch (leverage) {
    case 1:
      return {
        statusLabel: "обучение",
        cardTone: "cyan",
        riskLabel: "низкий",
        riskLevel: "low",
        visualTier: "calm",
        showWarning: false,
      };
    case 2:
      return {
        statusLabel: "спокойно",
        cardTone: "cyan",
        riskLabel: "умеренный",
        riskLevel: "moderate",
        visualTier: "calm",
        showWarning: false,
      };
    case 5:
      return {
        statusLabel: "рабочий риск",
        cardTone: "amber",
        riskLabel: "высокий",
        riskLevel: "high",
        visualTier: "warm",
        showWarning: false,
      };
    case 10:
      return {
        statusLabel: "агрессивно",
        cardTone: "amber",
        riskLabel: "очень высокий",
        riskLevel: "very-high",
        visualTier: "hot",
        showWarning: true,
      };
    case 20:
      return {
        statusLabel: "опасно",
        cardTone: "red",
        riskLabel: "экстремальный",
        riskLevel: "extreme",
        visualTier: "extreme",
        showWarning: true,
      };
    case 50:
      return {
        statusLabel: "почти без воздуха",
        cardTone: "red",
        riskLabel: "критический",
        riskLevel: "extreme",
        visualTier: "extreme",
        showWarning: true,
      };
    default:
      return {
        statusLabel: "—",
        cardTone: "amber",
        riskLabel: "—",
        riskLevel: "moderate",
        visualTier: "warm",
        showWarning: false,
      };
  }
}

/** Карточки сравнения плеча при фиксированном депозите (чистая функция). */
export function buildLeverageImpactCards(deposit = 100): LeverageImpactCard[] {
  const margin = Math.max(0, deposit);

  return LEVERAGE_IMPACT_LEVELS.map((leverage) => {
    const positionSize = margin * leverage;
    const meta = resolveLeverageImpactMeta(leverage);

    const adverseMovePercent = leverage === 1 ? null : 100 / leverage;
    return {
      leverage,
      positionSize,
      adverseMoveText:
        leverage === 1
          ? "Без плеча"
          : `~${formatAdverseMovePercent(adverseMovePercent!)} до ликвидации`,
      adverseMovePercent,
      ...meta,
    };
  });
}

function formatAdverseMovePercent(value: number): string {
  if (value >= 10) return `${Math.round(value)}%`;
  if (Number.isInteger(value)) return `${value}%`;
  return formatPercentFixed(value, 1);
}
