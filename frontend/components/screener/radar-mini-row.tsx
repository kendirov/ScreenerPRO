"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import type { MarketRadarReasonKey } from "@/lib/domain/market-radar-config";
import { buildTradesRatioTooltip, buildVolumeRatioTooltip } from "@/lib/domain/baseline-info";
import {
  RADAR_METRIC_LABEL,
  RADAR_METRIC_TOOLTIP,
  RADAR_SECTION,
  RADAR_VOLATILITY_REASON,
  type RadarRowVariant,
} from "@/lib/domain/radar-ui-labels";
import {
  formatTradesXCompact,
  formatVolXCompact,
  resolveStockTradesRatio,
  resolveStockVolumeRatio,
} from "@/lib/domain/stock-volume-ratio";
import { CopyTickerBadge } from "@/components/screener/copy-ticker-badge";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

export function formatRadarTradesK(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—";
  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000)}m`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return k >= 100 ? `${Math.round(k)}k` : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(k)}k`;
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

export type RadarTagTone = "neutral" | "amber" | "rose";

const TAG_TONE_CLASS: Record<RadarTagTone, string> = {
  neutral: "text-slate-500",
  amber: "text-amber-300/90",
  rose: "text-rose-300/90",
};

export function tagToneForVolatilityTag(tag: string): RadarTagTone {
  if (
    tag === RADAR_VOLATILITY_REASON.breakoutHigh ||
    tag === RADAR_VOLATILITY_REASON.nearHigh ||
    tag === RADAR_VOLATILITY_REASON.range
  ) {
    return "amber";
  }
  if (tag === RADAR_VOLATILITY_REASON.breakoutLow || tag === RADAR_VOLATILITY_REASON.nearLow) {
    return "rose";
  }
  return "neutral";
}

function pctClass(value: number | null, variant: RadarRowVariant): string {
  if (variant === "liquidity") return "text-slate-400";
  if ((value ?? 0) > 0) return "text-emerald-300/95";
  if ((value ?? 0) < 0) return "text-rose-300/95";
  return "text-slate-500";
}

export function RadarMiniRow({
  row,
  reasonKey,
  variant,
  inPlayBadge = false,
  inPlayAccent = false,
  displayTag,
  onTickerSelect,
  selected,
  title,
}: {
  row: ScreenerRow;
  reasonKey: MarketRadarReasonKey;
  variant: RadarRowVariant;
  inPlayBadge?: boolean;
  inPlayAccent?: boolean;
  displayTag?: string;
  onTickerSelect?: (ticker: string) => void;
  selected?: boolean;
  title?: string;
}) {
  const tag = displayTag ?? "—";
  const tagTone = variant === "volatility" ? tagToneForVolatilityTag(tag) : "neutral";

  const turnover = formatTurnoverCompact(row.turnover);
  const vol = variant === "activity" ? resolveStockVolumeRatio(row) : null;
  const tradesX = variant === "activity" ? resolveStockTradesRatio(row) : null;
  const volLabel = vol != null ? formatVolXCompact(vol) : null;
  const tradesXLabel = tradesX != null ? formatTradesXCompact(tradesX) : null;

  const colTurnover =
    variant === "activity" && volLabel
      ? { text: volLabel, title: [RADAR_METRIC_LABEL.turnoverX, ...buildVolumeRatioTooltip(row).lines].join("\n") }
      : { text: turnover ?? "—", title: turnover ? `${RADAR_METRIC_LABEL.turnover}: ${turnover}` : undefined };

  const colMetric =
    variant === "volatility"
      ? {
          text:
            row.metrics.dayRangePct != null
              ? tradingFormat.formatDayRangeMagnitude(row.metrics.dayRangePct)
              : "—",
          title: RADAR_METRIC_LABEL.range,
        }
      : variant === "activity" && tradesXLabel
        ? {
            text: tradesXLabel,
            title: [RADAR_METRIC_LABEL.tradesX, ...buildTradesRatioTooltip(row).lines].join("\n"),
          }
        : {
            text: formatRadarTradesK(row.tradesCount),
            title: RADAR_METRIC_LABEL.trades,
          };

  const hoverTitle =
    title ?? `${row.ticker} ${tradingFormat.formatSignedPercent(row.percentChange)} ${colTurnover.text} ${colMetric.text} ${tag}`;

  return (
    <div
      role={onTickerSelect ? "button" : undefined}
      tabIndex={onTickerSelect ? 0 : undefined}
      title={hoverTitle}
      className={cn(
        "flex h-[22px] min-h-[22px] max-h-[22px] w-full min-w-0 items-center gap-1 px-1 text-[11px] leading-none",
        "transition-colors hover:bg-white/[0.04]",
        variant === "activity" && "hover:bg-white/[0.06]",
        inPlayAccent && "border-l border-emerald-500/40 pl-0.5",
        selected && variant === "activity" && "bg-cyan-500/10",
        selected && variant !== "activity" && "bg-white/[0.05]",
      )}
      onClick={onTickerSelect ? () => onTickerSelect(row.ticker) : undefined}
      onKeyDown={
        onTickerSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onTickerSelect(row.ticker);
              }
            }
          : undefined
      }
      aria-pressed={onTickerSelect ? selected : undefined}
    >
      <CopyTickerBadge
        ticker={row.ticker}
        size="compact"
        className="w-[2.35rem] shrink-0 text-[11px] font-bold tracking-tight text-slate-200"
      />
      {inPlayBadge ? (
        <span
          className="max-w-[2.1rem] shrink-0 truncate text-[8px] font-medium text-emerald-400/85"
          title={RADAR_SECTION.inPlay.badge}
        >
          {RADAR_SECTION.inPlay.badge}
        </span>
      ) : null}
      <span className={cn("w-[2.35rem] shrink-0 text-right font-mono tabular-nums", pctClass(row.percentChange, variant))}>
        {tradingFormat.formatSignedPercent(row.percentChange)}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-right font-mono tabular-nums",
          variant === "liquidity" ? "text-slate-400" : "text-slate-300/90",
          variant === "activity" && volLabel && "text-slate-200",
        )}
        title={colTurnover.title ?? (volLabel ? undefined : RADAR_METRIC_TOOLTIP.noBaseline)}
      >
        {colTurnover.text}
      </span>
      <span
        className={cn(
          "w-[2.25rem] shrink-0 truncate text-right font-mono tabular-nums",
          variant === "liquidity" ? "text-slate-500" : "text-slate-500",
          variant === "activity" && tradesXLabel && "text-slate-300",
        )}
        title={colMetric.title}
      >
        {colMetric.text}
      </span>
      <span
        className={cn(
          "w-[4.1rem] shrink-0 truncate text-right text-[10px] font-normal lowercase",
          TAG_TONE_CLASS[tagTone],
        )}
        title={tag}
      >
        {tag}
      </span>
    </div>
  );
}
