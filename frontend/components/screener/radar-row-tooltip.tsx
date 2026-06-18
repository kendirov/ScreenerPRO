"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { ScreenerRow } from "@screenerpro/shared";
import { RadarMiniSparkline } from "@/components/screener/radar-mini-sparkline";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  getMarketRadarReasonDetail,
  getMarketRadarReasonLabel,
  type MarketRadarReasonKey,
} from "@/lib/domain/market-radar-config";
import {
  buildTradesRatioTooltip,
  buildVolumeRatioTooltip,
  formatTradesRatioDisplayParts,
  formatVolumeRatioDisplayParts,
} from "@/lib/domain/baseline-info";
import { RADAR_METRIC_LABEL, RADAR_SECTION } from "@/lib/domain/radar-ui-labels";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { formatTradesCompact } from "@/lib/domain/stocks-screener-signals";
import {
  formatSparklineScopeLabel,
  hasTwoSessionSparkline,
  type StockSparklineSeries,
} from "@/lib/domain/stock-sparkline";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

const CARD_WIDTH = 300;
const VIEWPORT_PAD = 10;

export type RadarTooltipBlock = "inplay" | "active" | "shots";

const BLOCK_LABEL: Record<RadarTooltipBlock, string> = {
  inplay: RADAR_SECTION.inPlay.badge,
  active: RADAR_SECTION.activity.title,
  shots: RADAR_SECTION.volatility.title,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function MetricLine({
  label,
  value,
  className,
  title,
}: {
  label: string;
  value: string;
  className?: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[10px]" title={title}>
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-mono tabular-nums text-slate-200", className)}>{value}</span>
    </div>
  );
}

export function RadarRowTooltip({
  row,
  series,
  sparklineLoading = false,
  anchorRect,
  visible,
  block,
  reasonKey,
  alsoInPlay,
  onTooltipEnter,
  onTooltipLeave,
}: {
  row: ScreenerRow;
  series: StockSparklineSeries | null | undefined;
  sparklineLoading?: boolean;
  anchorRect: DOMRect | null;
  visible: boolean;
  block: RadarTooltipBlock;
  reasonKey: MarketRadarReasonKey;
  alsoInPlay?: boolean;
  onTooltipEnter?: () => void;
  onTooltipLeave?: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const volTooltip = buildVolumeRatioTooltip(row);
  const tradesTooltip = buildTradesRatioTooltip(row);
  const volParts = formatVolumeRatioDisplayParts(row);
  const tradesParts = formatTradesRatioDisplayParts(row);
  const volLabel = volParts.showAsVolX ? volParts.primary : "—";
  const tradesLabel = tradesParts.showAsVolX ? tradesParts.primary : "—";
  const volDetailTitle = [volTooltip.title, ...volTooltip.lines].join("\n");
  const tradesDetailTitle = [tradesTooltip.title, ...tradesTooltip.lines].join("\n");
  const scopeLabel = formatSparklineScopeLabel(series);
  const hasChart = hasTwoSessionSparkline(series);
  const reasonLabel = getMarketRadarReasonLabel(reasonKey);
  const reasonDetail = getMarketRadarReasonDetail(reasonKey);
  const tradesFormatted = formatTradesCompact(row.tradesCount) ?? "—";

  if (!mounted || !visible || !anchorRect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardHeight = hasChart ? 248 : 212;
  let top = anchorRect.bottom + 6;
  if (top + cardHeight > vh - VIEWPORT_PAD) {
    top = anchorRect.top - cardHeight - 6;
  }
  top = clamp(top, VIEWPORT_PAD, vh - cardHeight - VIEWPORT_PAD);

  let left = anchorRect.right - CARD_WIDTH;
  if (left < VIEWPORT_PAD) left = anchorRect.left;
  left = clamp(left, VIEWPORT_PAD, vw - CARD_WIDTH - VIEWPORT_PAD);

  const changeCls =
    (row.percentChange ?? 0) > 0
      ? "text-emerald-400"
      : (row.percentChange ?? 0) < 0
        ? "text-rose-400"
        : "text-slate-300";

  const score =
    row.metrics.inPlayScore != null && Number.isFinite(row.metrics.inPlayScore)
      ? Math.round(row.metrics.inPlayScore)
      : null;

  return createPortal(
    <div
      className="pointer-events-auto fixed z-[120] animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ top, left, width: CARD_WIDTH }}
      onMouseEnter={onTooltipEnter}
      onMouseLeave={onTooltipLeave}
    >
      <LabGlassPanel
        depth={30}
        className="space-y-2 border border-white/[0.1] bg-slate-950/80 p-2.5 shadow-[0_16px_48px_rgba(2,6,23,0.65)] backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="font-mono text-[12px] font-semibold tracking-wide text-white">{row.ticker}</p>
              <span className="rounded border border-white/[0.08] bg-white/[0.04] px-1 py-px text-[7px] uppercase tracking-wider text-slate-500">
                {BLOCK_LABEL[block]}
              </span>
              {alsoInPlay ? (
                <span className="rounded border border-emerald-500/25 bg-emerald-950/30 px-1 py-px text-[7px] text-emerald-400/85">
                  в игре
                </span>
              ) : null}
            </div>
            <p className="truncate text-[9px] text-slate-500">{row.shortName}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[12px] tabular-nums text-slate-100">
              {tradingFormat.formatDynamicPrice(row.lastPrice)}
            </p>
            <p className={cn("font-mono text-[10px] tabular-nums", changeCls)}>
              {tradingFormat.formatSignedPercent(row.percentChange)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span
            className="rounded-md border border-violet-500/20 bg-violet-950/35 px-1.5 py-0.5 text-[9px] text-violet-200/90"
            title={reasonDetail ?? undefined}
          >
            {reasonLabel}
          </span>
          {score != null && block === "inplay" ? (
            <span className="font-mono text-[9px] tabular-nums text-emerald-400/80">score {score}</span>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-md border border-white/[0.06] bg-black/35 px-2 py-2">
          {sparklineLoading ? (
            <div className="flex h-[72px] flex-col items-center justify-center gap-1.5">
              <div className="h-10 w-full animate-pulse rounded bg-white/[0.06]" />
              <p className="text-[9px] text-slate-500">загрузка 2С…</p>
            </div>
          ) : hasChart ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-center">
                <RadarMiniSparkline
                  series={series}
                  dayHigh={row.high}
                  dayLow={row.low}
                  changePct={row.percentChange}
                  size="tooltip"
                />
              </div>
              <div className="flex items-center justify-between gap-2 font-mono text-[8px] tabular-nums text-slate-500">
                <span>
                  L{" "}
                  <span className="text-rose-400/80">
                    {tradingFormat.formatDynamicPrice(row.low)}
                  </span>
                </span>
                <span className="text-cyan-400/75">● сейчас</span>
                <span>
                  H{" "}
                  <span className="text-emerald-400/80">
                    {tradingFormat.formatDynamicPrice(row.high)}
                  </span>
                </span>
              </div>
              {scopeLabel ? <p className="text-center text-[8px] text-slate-600">{scopeLabel}</p> : null}
            </div>
          ) : (
            <p className="py-2 text-center text-[10px] font-medium text-slate-400">нет 2С графика</p>
          )}
        </div>

        <div className="grid gap-1 border-t border-white/[0.05] pt-2">
          <MetricLine label={RADAR_METRIC_LABEL.turnover} value={formatTurnoverCompact(row.turnover)} />
          <MetricLine label={RADAR_METRIC_LABEL.trades} value={tradesFormatted} />
          <MetricLine
            label={RADAR_METRIC_LABEL.turnoverX}
            value={volLabel}
            title={volDetailTitle}
            className={volLabel === "—" ? "text-slate-500" : undefined}
          />
          <MetricLine
            label={RADAR_METRIC_LABEL.tradesX}
            value={tradesLabel}
            title={tradesDetailTitle}
            className={tradesLabel === "—" ? "text-slate-500" : undefined}
          />
          <MetricLine
            label={RADAR_METRIC_LABEL.range}
            value={
              row.metrics.dayRangePct != null
                ? tradingFormat.formatDayRangeMagnitude(row.metrics.dayRangePct)
                : "—"
            }
          />
          <MetricLine
            label="High / Low"
            value={`${tradingFormat.formatDynamicPrice(row.high)} / ${tradingFormat.formatDynamicPrice(row.low)}`}
          />
        </div>
      </LabGlassPanel>
    </div>,
    document.body,
  );
}
