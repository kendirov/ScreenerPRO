import {
  computeLiquidationSimulator,
  computeRiskLadderPrices,
  type PositionSide,
} from "@/lib/domain/perpetual-leverage";

export type PositionAutoDiagnosisSeverity = "error" | "warning" | "ok";

export type PositionAutoDiagnosis = {
  severity: PositionAutoDiagnosisSeverity;
  /** Короткие строки для UI (приоритетные предупреждения). */
  lines: string[];
};

export const POSITION_AUTO_DIAG = {
  liquidationBeforeStop: "Ошибка: ликвидация наступит раньше стопа.",
  smallBuffer: "Запас после стопа слишком маленький.",
  stopLossTooLarge: "Убыток по стопу больше 10% депозита. Для обучения слишком много.",
  ok: "Схема читается: стоп раньше ликвидации, риск контролируем.",
} as const;

type DiagIssue = {
  priority: number;
  severity: Exclude<PositionAutoDiagnosisSeverity, "ok">;
  message: string;
};

function clampDeposit(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 100;
}

export function computePositionAutoDiagnosis(params: {
  deposit: number;
  leverage: number;
  stopPercent: number;
  direction: PositionSide;
  takeProfitR?: number;
}): PositionAutoDiagnosis {
  const deposit = clampDeposit(params.deposit);
  const leverage = Math.max(1, Math.round(params.leverage));
  const stopPercent = Math.max(0, params.stopPercent);
  const direction = params.direction;

  const ladder = computeRiskLadderPrices({
    leverage,
    direction,
    stopPercent,
    takeProfitR: params.takeProfitR,
  });

  const sim = computeLiquidationSimulator({ deposit, leverage, direction });
  const lossAtStop = (sim.positionSize * stopPercent) / 100;
  const stopBufferPercent = ladder.liquidationInactive
    ? Number.POSITIVE_INFINITY
    : sim.liquidationDistancePercent - stopPercent;

  if (!ladder.liquidationInactive) {
    const stopBeyondLiquidation =
      direction === "long"
        ? ladder.stopPrice <= ladder.liquidationPrice
        : ladder.stopPrice >= ladder.liquidationPrice;

    if (stopBeyondLiquidation) {
      return {
        severity: "error",
        lines: [POSITION_AUTO_DIAG.liquidationBeforeStop],
      };
    }
  }

  const issues: DiagIssue[] = [];

  if (lossAtStop > deposit * 0.1) {
    issues.push({
      priority: 20,
      severity: "warning",
      message: POSITION_AUTO_DIAG.stopLossTooLarge,
    });
  }
  if (!ladder.liquidationInactive && stopBufferPercent < 1) {
    issues.push({
      priority: 30,
      severity: "warning",
      message: POSITION_AUTO_DIAG.smallBuffer,
    });
  }

  if (issues.length === 0) {
    return { severity: "ok", lines: [POSITION_AUTO_DIAG.ok] };
  }

  issues.sort((a, b) => a.priority - b.priority);
  return {
    severity: issues[0].severity,
    lines: issues.slice(0, 2).map((i) => i.message),
  };
}
