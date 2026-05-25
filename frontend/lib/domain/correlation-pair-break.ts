import type { CorrelationPairPoint, CorrelationPairResponse } from "@/lib/domain/correlation-api";
import {
  CORRELATION_BREAK_THRESHOLD,
  CORRELATION_STRONG_THRESHOLD,
} from "@/lib/domain/correlation-lab";

export type CorrelationBreakZoneKind = "break" | "stock-stronger" | "no-response";

export type CorrelationBreakZone = {
  startIdx: number;
  endIdx: number;
  kind: CorrelationBreakZoneKind;
  label: string;
};

export type CorrelationLinkMode = "holding" | "weakening" | "broken" | "none";

export type CorrelationPairChartModel = {
  stock: CorrelationPairPoint[];
  factor: CorrelationPairPoint[];
  rollingCorr: CorrelationPairPoint[];
  breakZones: CorrelationBreakZone[];
  linkMode: CorrelationLinkMode;
  linkModeLabel: string;
  explanation: string;
};

const BREAK_ZONE_LABELS: Record<CorrelationBreakZoneKind, string> = {
  break: "разрыв связи",
  "stock-stronger": "акция ушла сильнее фактора",
  "no-response": "акция не отреагировала",
};

const LINK_MODE_LABELS: Record<CorrelationLinkMode, string> = {
  holding: "связь держится",
  weakening: "связь слабеет",
  broken: "связь сломалась",
  none: "связи нет",
};

export function linkModeLabel(mode: CorrelationLinkMode): string {
  return LINK_MODE_LABELS[mode];
}

function pctChange(prev: number, curr: number): number {
  if (!Number.isFinite(prev) || prev === 0) return 0;
  return (curr - prev) / prev;
}

function resolveLinkMode(stats: CorrelationPairResponse["stats"]): CorrelationLinkMode {
  const { corr20, corr60, breakScore } = stats;
  const c60 = Math.abs(corr60 ?? 0);
  const c20 = Math.abs(corr20 ?? 0);
  const bs = breakScore ?? 0;

  if (c60 < 0.25 && c20 < 0.25) return "none";
  if (bs >= CORRELATION_BREAK_THRESHOLD) return "broken";
  if (bs >= 0.2 || (c60 >= CORRELATION_STRONG_THRESHOLD && c20 < c60 * 0.55)) return "weakening";
  if (c20 >= 0.35 && c60 >= 0.35) return "holding";
  if (c60 >= 0.25) return "weakening";
  return "none";
}

function buildExplanation(mode: CorrelationLinkMode, stats: CorrelationPairResponse["stats"], zones: CorrelationBreakZone[]): string {
  const recent = zones.at(-1);
  if (recent) {
    return `На графике: ${recent.label.toLowerCase()} — сравните траектории акции и фактора (не сигнал).`;
  }
  switch (mode) {
    case "holding":
      return "Доходности акции и фактора согласованы на окнах 20 и 60 — траектории близки.";
    case "weakening":
      return "corr20 и corr60 расходятся — связь ослабевает, смотрите последние свечи.";
    case "broken":
      return "breakScore высокий — привычная связь с фактором нарушена на последнем участке.";
    case "none":
      return "Корреляция близка к нулю — явной совместной динамики не видно.";
    default:
      return "Сравните нормализованные ряды — учебный срез, не рекомендация.";
  }
}

/** Детекция зон разрыва по реальным нормализованным рядам и rolling corr. */
export function detectBreakZones(
  stock: CorrelationPairPoint[],
  factor: CorrelationPairPoint[],
  rollingCorr: CorrelationPairPoint[],
  beta60: number | null,
  corr60: number | null,
): CorrelationBreakZone[] {
  const n = Math.min(stock.length, factor.length);
  if (n < 6) return [];

  const beta = beta60 ?? 1;
  const hadStrongLink = Math.abs(corr60 ?? 0) >= CORRELATION_STRONG_THRESHOLD * 0.7;
  const zones: CorrelationBreakZone[] = [];

  for (let i = 1; i < n; i++) {
    const sPrev = stock[i - 1]!.value;
    const sCurr = stock[i]!.value;
    const fPrev = factor[i - 1]!.value;
    const fCurr = factor[i]!.value;

    const sRet = pctChange(sPrev, sCurr);
    const fRet = pctChange(fPrev, fCurr);
    const expected = beta * fRet;
    const residual = Math.abs(sRet - expected);

    const corrPoint = rollingCorr[Math.min(i - 1, rollingCorr.length - 1)];
    const prevCorr = rollingCorr[Math.max(0, i - 2)];
    const corrDrop =
      prevCorr?.value != null &&
      corrPoint?.value != null &&
      Math.abs(prevCorr.value) > 0.45 &&
      Math.abs(corrPoint.value) < Math.abs(prevCorr.value) - 0.25;

    let kind: CorrelationBreakZoneKind | null = null;

    if (hadStrongLink && corrDrop) {
      kind = "break";
    } else if (hadStrongLink && residual > 0.012 && Math.abs(fRet) > 0.004) {
      if (Math.abs(sRet) < 0.003 && Math.abs(fRet) > 0.008) {
        kind = "no-response";
      } else if (Math.abs(sRet) > Math.abs(expected) * 1.6 && Math.sign(sRet) === Math.sign(expected)) {
        kind = "stock-stronger";
      } else if (residual > 0.018) {
        kind = "break";
      }
    }

    if (!kind) continue;

    const last = zones.at(-1);
    if (last && last.endIdx === i - 1 && last.kind === kind) {
      last.endIdx = i;
    } else {
      zones.push({
        startIdx: i - 1,
        endIdx: i,
        kind,
        label: BREAK_ZONE_LABELS[kind],
      });
    }
  }

  return zones.slice(-6);
}

export function buildCorrelationPairChartModel(pair: CorrelationPairResponse): CorrelationPairChartModel {
  const breakZones = detectBreakZones(
    pair.normalizedStock,
    pair.normalizedFactor,
    pair.rollingCorr,
    pair.stats.beta60,
    pair.stats.corr60,
  );

  const linkMode = resolveLinkMode(pair.stats);

  return {
    stock: pair.normalizedStock,
    factor: pair.normalizedFactor,
    rollingCorr: pair.rollingCorr,
    breakZones,
    linkMode,
    linkModeLabel: linkModeLabel(linkMode),
    explanation: buildExplanation(linkMode, pair.stats, breakZones),
  };
}

export function formatPairTooltipDate(t: string): string {
  if (t.length >= 10) return t.slice(0, 10);
  return t;
}
