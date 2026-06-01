"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { SpreadLabEventTape } from "@/components/lab/currency-correlation/spread-lab-event-tape";
import {
  formatSpreadPoints,
  SPREAD_TREND_LABEL_RU,
} from "@/lib/domain/quad-hedge/spread-points";
import { SPREAD_ZONE_LABEL_RU } from "@/lib/domain/quad-hedge/spread-percentile-analytics";
import { SPREAD_LAB_SIGNAL_LABEL } from "@/lib/domain/quad-hedge/spread-trend-analytics";
import type { QuadHedgeAnalyticsResult } from "@/lib/domain/quad-hedge";
import type { QuadHedgeSpreadUnitMode, QuadHedgeViewMode } from "@/lib/domain/quad-hedge/types";
import { viewModeToPairKey } from "@/lib/domain/quad-hedge/types";
import { cn } from "@/lib/utils/cn";

function pairLabel(viewMode: QuadHedgeViewMode): string {
  if (viewMode === "SI-EU") return "SI–EU";
  if (viewMode === "SI-CN") return "SI–CN";
  if (viewMode === "EU-CN") return "EU–CN";
  return "—";
}

const STATUS_TONE: Record<string, string> = {
  NORMAL: "text-slate-400",
  FLAT: "text-slate-500",
  EXPANDING: "text-amber-300/90",
  EXTREME: "text-violet-300/90",
  STRONG_EXTREME: "text-rose-300/90",
  PULLBACK: "text-cyan-300/90",
  RETEST: "text-violet-200/80",
  NO_DATA: "text-slate-600",
};

function holdLabel(bars: number, zone: string): string {
  if (bars <= 0) return "—";
  const zoneRu = zone === "extreme" ? "extreme" : zone === "watch" ? "watch" : "";
  return `${bars} св.${zoneRu ? ` · ${zoneRu}` : ""}`;
}

export function QuadHedgeSpreadStrip({
  analytics,
  viewMode,
  spreadUnitMode,
  isLoading,
  className,
}: {
  analytics: QuadHedgeAnalyticsResult | null;
  viewMode: QuadHedgeViewMode;
  spreadUnitMode: QuadHedgeSpreadUnitMode;
  isLoading?: boolean;
  className?: string;
}) {
  const pairKey = viewModeToPairKey(viewMode);
  const spreadPts =
    spreadUnitMode === "points" && pairKey
      ? analytics?.spreadPoints.find((s) => s.pairKey === pairKey)
      : null;

  if (isLoading) {
    return (
      <LabGlassPanel depth={10} className={cn("px-3 py-2", className)}>
        <p className="text-[10px] text-slate-500">Spread…</p>
      </LabGlassPanel>
    );
  }

  if (!spreadPts || spreadPts.status !== "ok") {
    if (spreadUnitMode !== "points") return null;
    return (
      <LabGlassPanel depth={10} className={cn("px-3 py-2", className)}>
        <p className="text-[10px] text-slate-500">
          {pairLabel(viewMode)}: {spreadPts?.interpretation ?? "недостаточно точек"}
        </p>
      </LabGlassPanel>
    );
  }

  const lastExtremeVal =
    spreadPts.lastExtreme?.value ??
    spreadPts.windowExtremeValue ??
    (spreadPts.lastExtremeType === "high"
      ? spreadPts.maxSpreadPoints
      : spreadPts.minSpreadPoints);

  const collapse =
    spreadPts.collapseFromExtremePoints != null
      ? formatSpreadPoints(spreadPts.collapseFromExtremePoints)
      : spreadPts.distanceFromExtremeSigned != null
        ? formatSpreadPoints(spreadPts.distanceFromExtremeSigned)
        : "—";

  const labStatus = spreadPts.labSignalStatus ?? "NORMAL";
  const zone = spreadPts.currentZone ?? "noise";
  const percentileLabel =
    spreadPts.percentileAbs != null
      ? `${spreadPts.percentileAbs}%`
      : spreadPts.percentileReliable
        ? "—"
        : "n/a";
  const lastExtremeTime = spreadPts.lastExtremeAt ?? spreadPts.lastExtreme?.time ?? null;
  const lastExtremeTimeLabel = lastExtremeTime
    ? new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Europe/Moscow",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(lastExtremeTime))
    : "—";

  return (
    <div className={cn("space-y-1.5", className)}>
      <LabGlassPanel
        depth={10}
        className="border-violet-500/12 bg-slate-950/55 px-3 py-2 backdrop-blur-md"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
          <span className="text-cyan-300/95">
            spread: {formatSpreadPoints(spreadPts.currentSpreadPoints)}
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-300">
            перцентиль: {percentileLabel}
            {!spreadPts.percentileReliable ? (
              <span className="text-slate-600"> (fixed)</span>
            ) : null}
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-amber-300/85">
            зона: {SPREAD_ZONE_LABEL_RU[zone]}
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-300">схлопывание: {collapse}</span>
          <span className="text-slate-700">·</span>
          <span className="text-violet-300/85">
            экстремум: {formatSpreadPoints(lastExtremeVal)} · {lastExtremeTimeLabel}
          </span>
          {spreadPts.retestCount != null && spreadPts.retestCount > 0 ? (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-violet-200/80">retest ×{spreadPts.retestCount}</span>
            </>
          ) : null}
          <span className="text-slate-700">·</span>
          <span className="text-amber-300/85">
            тенденция: {SPREAD_TREND_LABEL_RU[spreadPts.trend]}
          </span>
          <span className="text-slate-700">·</span>
          <span className="text-slate-400">
            длительность: {holdLabel(spreadPts.holdDurationBars, spreadPts.holdZone)}
          </span>
          <span className="text-slate-700">·</span>
          <span className={cn("font-semibold tracking-wide", STATUS_TONE[labStatus])}>
            {SPREAD_LAB_SIGNAL_LABEL[labStatus]}
          </span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          {spreadPts.interpretation}
        </p>
      </LabGlassPanel>

      {spreadPts.trendEvents.length > 0 ? (
        <SpreadLabEventTape events={spreadPts.trendEvents} />
      ) : null}
    </div>
  );
}
