import type { ScreenerRow } from "@screenerpro/shared";
import {
  formatAnomalyReason,
  formatFocusReasonTags,
  formatReasonTagsForCard,
  formatTurnoverCompact,
  inferFutureMarketSegment,
  isRowAnomaly,
} from "@/lib/domain/screener-overview";
import { isStockInPlay } from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";

export type MarketCardSize = "hero" | "medium" | "compact";
export type MarketCardType = "stock" | "future" | "lab" | "anomaly";
export type MarketCardState = "positive" | "negative" | "neutral" | "warning";

export type ReasonTagId =
  | "оборот"
  | "сделки"
  | "ход"
  | "аномалия"
  | "перекат"
  | "новость"
  | "сессия"
  | "движение"
  | "активность";

export type MarketFocusCardMetric = {
  label: string;
  value: string;
};

/** Единый словарь визуальных состояний карточки. */
export const MARKET_CARD_STATE_STYLES: Record<
  MarketCardState,
  {
    percent: string;
    ring: string;
    hoverGlow: string;
    heroGlow: string;
    accentLine: string;
    backdropGradient: string;
    inlineSpark: string;
  }
> = {
  positive: {
    percent: "text-lab-green",
    ring: "ring-1 ring-lab-green/32",
    hoverGlow: "hover:shadow-[var(--lab-glow-green)] hover:ring-lab-green/55",
    heroGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),var(--lab-glow-green)]",
    accentLine: "bg-gradient-to-r from-transparent via-lab-green/70 to-lab-cyan/50",
    backdropGradient:
      "bg-[radial-gradient(ellipse_90%_80%_at_92%_8%,rgba(34,197,94,0.2),rgba(34,211,238,0.08)_38%,transparent_72%)]",
    inlineSpark: "stroke-lab-green",
  },
  negative: {
    percent: "text-lab-red",
    ring: "ring-1 ring-lab-red/32",
    hoverGlow: "hover:shadow-[var(--lab-glow-red)] hover:ring-lab-red/55",
    heroGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),var(--lab-glow-red)]",
    accentLine: "bg-gradient-to-r from-transparent via-lab-red/75 to-pink-500/40",
    backdropGradient:
      "bg-[radial-gradient(ellipse_90%_80%_at_92%_8%,rgba(251,113,133,0.22),rgba(251,113,133,0.06)_40%,transparent_72%)]",
    inlineSpark: "stroke-lab-red",
  },
  neutral: {
    percent: "text-lab-muted",
    ring: "ring-1 ring-lab-blue/25",
    hoverGlow: "hover:shadow-[0_0_24px_rgba(59,130,246,0.14)] hover:ring-lab-blue/40",
    heroGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_32px_rgba(59,130,246,0.1)]",
    accentLine: "bg-gradient-to-r from-transparent via-lab-blue/50 to-lab-violet/35",
    backdropGradient:
      "bg-[radial-gradient(ellipse_90%_80%_at_92%_8%,rgba(59,130,246,0.12),transparent_68%)]",
    inlineSpark: "stroke-lab-blue/70",
  },
  warning: {
    percent: "text-lab-amber",
    ring: "ring-1 ring-lab-amber/38",
    hoverGlow: "hover:shadow-[var(--lab-glow-amber)] hover:ring-lab-amber/55",
    heroGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),var(--lab-glow-amber),0_0_28px_rgba(139,92,246,0.12)]",
    accentLine: "bg-gradient-to-r from-transparent via-lab-amber/70 to-lab-violet/50",
    backdropGradient:
      "bg-[radial-gradient(ellipse_90%_80%_at_92%_8%,rgba(245,158,11,0.16),rgba(139,92,246,0.08)_45%,transparent_72%)]",
    inlineSpark: "stroke-lab-amber",
  },
};

/** Цветовые роли фьючерсов по сегменту базового актива. */
export const FUTURE_SEGMENT_THEMES: Record<
  string,
  {
    chip: string;
    accentLine: string;
    backdropGradient: string;
    ring: string;
    hoverGlow: string;
  }
> = {
  Нефть: {
    chip: "border-lab-amber/40 bg-lab-amber/12 text-lab-amber",
    accentLine: "bg-gradient-to-r from-transparent via-lab-amber/75 to-lab-red/45",
    backdropGradient:
      "bg-[radial-gradient(ellipse_88%_78%_at_90%_10%,rgba(245,158,11,0.18),rgba(251,113,133,0.08)_42%,transparent_70%)]",
    ring: "ring-1 ring-lab-amber/35",
    hoverGlow: "hover:shadow-[var(--lab-glow-amber)]",
  },
  Валюта: {
    chip: "border-lab-cyan/40 bg-lab-cyan/10 text-lab-cyan",
    accentLine: "bg-gradient-to-r from-transparent via-lab-cyan/70 to-lab-violet/45",
    backdropGradient:
      "bg-[radial-gradient(ellipse_88%_78%_at_90%_10%,rgba(34,211,238,0.16),rgba(139,92,246,0.08)_42%,transparent_70%)]",
    ring: "ring-1 ring-lab-cyan/30",
    hoverGlow: "hover:shadow-[var(--lab-glow-cyan)]",
  },
  Металл: {
    chip: "border-lab-lime/35 bg-lab-lime/10 text-lab-lime",
    accentLine: "bg-gradient-to-r from-transparent via-lab-lime/60 to-lab-cyan/45",
    backdropGradient:
      "bg-[radial-gradient(ellipse_88%_78%_at_90%_10%,rgba(163,230,53,0.14),rgba(34,211,238,0.08)_42%,transparent_70%)]",
    ring: "ring-1 ring-lab-lime/30",
    hoverGlow: "hover:shadow-[0_0_24px_rgba(163,230,53,0.18)]",
  },
  Индекс: {
    chip: "border-lab-blue/40 bg-lab-blue/10 text-lab-blue",
    accentLine: "bg-gradient-to-r from-transparent via-lab-blue/65 to-lab-violet/45",
    backdropGradient:
      "bg-[radial-gradient(ellipse_88%_78%_at_90%_10%,rgba(59,130,246,0.16),rgba(139,92,246,0.08)_42%,transparent_70%)]",
    ring: "ring-1 ring-lab-blue/30",
    hoverGlow: "hover:shadow-[0_0_24px_rgba(139,92,246,0.16)]",
  },
};

export function resolveFutureSegmentTheme(segment: string | null | undefined) {
  if (segment && segment in FUTURE_SEGMENT_THEMES) {
    return FUTURE_SEGMENT_THEMES[segment]!;
  }
  return null;
}

/** Цветовой маркер для ленты аномалий. */
export const ANOMALY_REASON_MARKER: Record<string, string> = {
  оборот: "bg-lab-cyan shadow-[0_0_6px_rgba(34,211,238,0.55)]",
  сделки: "bg-lab-blue shadow-[0_0_6px_rgba(59,130,246,0.5)]",
  движение: "bg-lab-violet shadow-[0_0_6px_rgba(139,92,246,0.5)]",
  аномалия: "bg-lab-amber shadow-[0_0_6px_rgba(245,158,11,0.55)]",
  перекат: "bg-lab-violet shadow-[0_0_6px_rgba(139,92,246,0.45)]",
  активность: "bg-lab-dim",
};

export const REASON_TAG_STYLES: Record<string, string> = {
  оборот: "border-lab-cyan/35 bg-lab-cyan/10 text-lab-cyan",
  сделки: "border-lab-blue/35 bg-lab-blue/10 text-lab-blue",
  ход: "border-lab-violet/35 bg-lab-violet/10 text-lab-violet",
  движение: "border-lab-violet/30 bg-lab-violet/8 text-lab-violet/95",
  аномалия: "border-lab-amber/40 bg-lab-amber/12 text-lab-amber",
  перекат: "border-lab-violet/35 bg-lab-violet/10 text-lab-violet",
  новость: "border-lab-amber/35 bg-lab-amber/10 text-lab-amber",
  сессия: "border-lab-cyan/30 bg-lab-cyan/8 text-lab-cyan/90",
  активность: "border-lab-border-soft bg-lab-surface-3/80 text-lab-text-muted",
  работает: "border-lab-green/30 bg-lab-green/10 text-lab-green",
  скоро: "border-lab-amber/30 bg-lab-amber/10 text-lab-amber",
  эксперимент: "border-lab-violet/30 bg-lab-violet/10 text-lab-violet",
};

export function normalizeReasonTag(tag: string): ReasonTagId | string {
  const lower = tag.toLowerCase().trim();
  if (lower in REASON_TAG_STYLES) return lower;
  if (lower.includes("оборот") || lower.includes("объём")) return "оборот";
  if (lower.includes("сдел")) return "сделки";
  if (lower.includes("ход") || lower.includes("диапазон")) return "ход";
  if (lower.includes("аномал")) return "аномалия";
  return lower;
}

export function resolveMarketCardState(
  changePct: number | null,
  options?: { forceWarning?: boolean },
): MarketCardState {
  if (options?.forceWarning) return "warning";
  if ((changePct ?? 0) > 0) return "positive";
  if ((changePct ?? 0) < 0) return "negative";
  return "neutral";
}

export function resolveStateFromRow(row: ScreenerRow): MarketCardState {
  if (isRowAnomaly(row)) return "warning";
  return resolveMarketCardState(row.percentChange);
}

export function stockReasonTags(row: ScreenerRow): string[] {
  if (isRowAnomaly(row)) return ["аномалия"];
  const tags = formatReasonTagsForCard(row).map(normalizeReasonTag);
  if (tags.length) return tags.slice(0, 3);
  const focus = formatFocusReasonTags(row);
  return focus.length ? focus : ["активность"];
}

export function buildStockMetrics(row: ScreenerRow, count: 2 | 3): MarketFocusCardMetric[] {
  const dayRange = row.metrics.dayRangePct;
  const all: MarketFocusCardMetric[] = [
    { label: "Оборот", value: formatTurnoverCompact(row.turnover) },
    { label: "Сделки", value: tradingFormat.formatInteger(row.tradesCount ?? null) },
    {
      label: "Ход",
      value: dayRange !== null ? tradingFormat.formatDayRangeMagnitude(dayRange) : "—",
    },
  ];
  return all.slice(0, count);
}

export function buildFutureMetrics(row: ScreenerRow, baseLabel: string): MarketFocusCardMetric[] {
  const dayRange = row.metrics.dayRangePct;
  const oi = row.openInterest;
  return [
    { label: "Оборот", value: formatTurnoverCompact(row.turnover) },
    {
      label: "ОИ",
      value: oi != null && oi > 0 ? tradingFormat.formatInteger(oi) : "—",
    },
    {
      label: "Ход",
      value: dayRange !== null ? tradingFormat.formatDayRangeMagnitude(dayRange) : "—",
    },
    { label: "База", value: baseLabel.length > 18 ? `${baseLabel.slice(0, 16)}…` : baseLabel },
  ];
}

export function screenerRowToStockCard(row: ScreenerRow, size: MarketCardSize) {
  const state = resolveStateFromRow(row);
  const metrics = buildStockMetrics(row, size === "hero" ? 3 : 2);
  return {
    size,
    type: "stock" as const,
    state,
    ticker: row.ticker,
    nameOrBase: row.shortName,
    changePct: row.percentChange,
    reasonTags: stockReasonTags(row),
    status: isStockInPlay(row) ? "в игре" : undefined,
    metrics,
    href: `/stocks/${row.ticker}`,
  };
}

export function screenerRowToFutureCard(
  row: ScreenerRow,
  size: MarketCardSize,
  baseLabel: string,
) {
  const state = resolveStateFromRow(row);
  const segment = inferFutureMarketSegment(baseLabel, row.ticker);
  const metrics = buildFutureMetrics(row, baseLabel)
    .filter((m) => m.label !== "База")
    .slice(0, size === "hero" ? 3 : 2);
  return {
    size,
    type: "future" as const,
    state,
    ticker: row.ticker,
    nameOrBase: baseLabel,
    changePct: row.percentChange,
    futureSegment: segment,
    status: segment ?? undefined,
    metrics,
    href: `/futures/${row.ticker}`,
  };
}

export function formatCompactReason(row: ScreenerRow): string {
  return formatAnomalyReason(row);
}
