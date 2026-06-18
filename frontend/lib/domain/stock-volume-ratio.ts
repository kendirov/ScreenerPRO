import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildBaselineInfoFromRow,
  buildTradesRatioTooltip,
  buildVolumeRatioTooltip,
  formatBaselineUiLabel,
  formatVolumeRatioDisplayParts,
  resolveHonestTradesRatio,
  resolveHonestVolumeRatio,
} from "@/lib/domain/baseline-info";

export { resolveHonestVolumeRatio as resolveStockVolumeRatio };
export { resolveHonestTradesRatio as resolveStockTradesRatio };

/** Положительное конечное число или null (никогда NaN / Infinity). */
export function finiteStockRatio(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** Компактная подпись: x1.8 или — */
export function formatVolXCompact(ratio: number | null): string {
  if (ratio == null) return "—";
  return `x${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(ratio)}`;
}

export function formatTradesXCompact(ratio: number | null): string {
  return formatVolXCompact(ratio);
}

/** Подсветка: 1.5+ / 2.0+ / 3.0+ */
export function volXTableHighlightClass(ratio: number | null): string {
  if (ratio == null) return "text-lab-text-dim";
  if (ratio >= 3) return "font-semibold text-violet-300";
  if (ratio >= 2) return "font-medium text-amber-300/95";
  if (ratio >= 1.5) return "text-cyan-300/90";
  return "text-lab-text-muted";
}

export function buildVolXTableTitle(row: ScreenerRow): string {
  const tooltip = buildVolumeRatioTooltip(row);
  return [tooltip.title, ...tooltip.lines].join("\n");
}

export function buildTradesXTableTitle(row: ScreenerRow): string {
  const tooltip = buildTradesRatioTooltip(row);
  return [tooltip.title, ...tooltip.lines].join("\n");
}

export { formatVolumeRatioDisplayParts, formatBaselineUiLabel, buildVolumeRatioTooltip };
