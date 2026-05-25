import type { CorrelationApiFactorId, CorrelationApiInterval, CorrelationApiPeriod, CorrelationSignal } from "@/lib/domain/correlation-api";
import { formatBetaCompact, formatCorrelationCompact } from "@/lib/domain/correlation-lab";

export type CorrelationSortMode = "strong" | "inverse" | "break" | "weak";
export type CorrelationWindowMode = 20 | 60 | 120;
export type CorrelationLensTab = "lens" | "heatmap" | "list";

export const CORRELATION_SORT_LABELS: Record<CorrelationSortMode, string> = {
  strong: "сильная связь",
  inverse: "обратная связь",
  break: "разрыв связи",
  weak: "слабая связь",
};

export const CORRELATION_KIND_LABELS: Record<CorrelationSignal["kind"], string> = {
  strong: "сильная +",
  inverse: "обратная",
  break: "разрыв",
  weak: "слабая",
  neutral: "нейтр.",
};

export const CORRELATION_KIND_REASON: Record<CorrelationSignal["kind"], string> = {
  strong: "corr60 выше порога сильной связи",
  inverse: "corr60 ниже порога обратной связи",
  break: "corr20 и corr60 расходятся — связь меняется",
  weak: "corr60 близка к нулю — явной связи нет",
  neutral: "связь не попала в пороги strong/inverse/break/weak",
};

export function formatIntervalLabel(interval: CorrelationApiInterval): string {
  if (interval >= 24) return "день";
  return `${interval}м`;
}

export function formatPeriodLabel(period: CorrelationApiPeriod): string {
  return `${period}д`;
}

export function pickCorr(signal: CorrelationSignal, window: CorrelationWindowMode): number | null {
  if (window === 20) return signal.corr20;
  if (window === 60) return signal.corr60;
  return signal.corr120;
}

export function pickBeta(signal: CorrelationSignal, window: CorrelationWindowMode): number | null {
  if (window === 20) return signal.beta20;
  if (window === 60) return signal.beta60;
  return signal.beta120;
}

export function formatSignalLine(signal: CorrelationSignal, window: CorrelationWindowMode = 60): string {
  const corr = pickCorr(signal, window);
  const beta = pickBeta(signal, window);
  const corrStr = formatCorrelationCompact(corr);
  const betaStr = formatBetaCompact(beta);
  return `${signal.ticker} ${corrStr} beta ${betaStr}`;
}

export function sortSignals(signals: CorrelationSignal[], mode: CorrelationSortMode): CorrelationSignal[] {
  const copy = [...signals];
  switch (mode) {
    case "strong":
      return copy
        .filter((s) => s.kind === "strong")
        .sort((a, b) => (b.corr60 ?? 0) - (a.corr60 ?? 0));
    case "inverse":
      return copy
        .filter((s) => s.kind === "inverse")
        .sort((a, b) => (a.corr60 ?? 0) - (b.corr60 ?? 0));
    case "break":
      return copy
        .filter((s) => s.kind === "break")
        .sort((a, b) => (b.breakScore ?? 0) - (a.breakScore ?? 0));
    case "weak":
      return copy
        .filter((s) => s.kind === "weak" || s.kind === "neutral")
        .sort((a, b) => Math.abs(a.corr60 ?? 0) - Math.abs(b.corr60 ?? 0));
    default:
      return copy;
  }
}

export function formatFactorProxyFromMeta(factorId: CorrelationApiFactorId, proxyTicker: string | null): string {
  const short: Record<CorrelationApiFactorId, string> = {
    index: "IMOEX2",
    ruble: "Si",
    oil: "Brent",
    gold: "Gold",
    us: "S&P",
    sector: "сектор",
  };
  if (factorId === "sector") return "секторные корзины";
  if (proxyTicker) return `${short[factorId]} / ${proxyTicker}`;
  return short[factorId];
}

export function corrHeatColor(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "rgba(100,116,139,0.15)";
  const v = Math.max(-1, Math.min(1, value));
  if (v >= 0) {
    const a = 0.15 + v * 0.65;
    return `rgba(34,211,238,${a.toFixed(2)})`;
  }
  const a = 0.15 + Math.abs(v) * 0.65;
  return `rgba(139,92,246,${a.toFixed(2)})`;
}

export function kindScatterColor(kind: CorrelationSignal["kind"]): string {
  switch (kind) {
    case "strong":
      return "#22d3ee";
    case "inverse":
      return "#8b5cf6";
    case "break":
      return "#f59e0b";
    case "weak":
      return "#64748b";
    default:
      return "#475569";
  }
}

export function normalizeFactorId(raw: string): CorrelationApiFactorId | null {
  const id = raw.toLowerCase();
  if (id === "america") return "us";
  const valid: CorrelationApiFactorId[] = ["index", "ruble", "oil", "gold", "us", "sector"];
  return valid.includes(id as CorrelationApiFactorId) ? (id as CorrelationApiFactorId) : null;
}
