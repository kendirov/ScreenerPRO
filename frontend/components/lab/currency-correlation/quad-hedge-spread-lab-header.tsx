"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { QuadHedgeIntradayResponse } from "@/lib/domain/quad-hedge/analytics";
import type { QuadHedgeAnalyticsResult } from "@/lib/domain/quad-hedge";
import {
  SPREAD_LAB_DISPLAY_INTERVAL,
  spreadLabHistoryDepthLabel,
  type SpreadLabHistoryDepth,
} from "@/lib/domain/quad-hedge/spread-lab-config";
import { count5mCandlesInLeg } from "@/lib/domain/quad-hedge/spread-lab-history";
import type { QuadHedgeViewMode } from "@/lib/domain/quad-hedge/types";
import { cn } from "@/lib/utils/cn";

function pairLabel(viewMode: QuadHedgeViewMode): string {
  if (viewMode === "SI-CN") return "SI–CN";
  if (viewMode === "SI-EU") return "SI–EU";
  if (viewMode === "EU-CN") return "EU–CN";
  return viewMode;
}

function legTicker(
  intraday: QuadHedgeIntradayResponse | undefined,
  legId: "SI" | "EU" | "CN",
): string {
  const leg = intraday?.legs.find((l) => l.legId === legId);
  return leg?.ticker ?? "—";
}

function leg5mCandles(
  intraday: QuadHedgeIntradayResponse | undefined,
  analytics: QuadHedgeAnalyticsResult | null,
  legId: "SI" | "EU" | "CN",
  displayInterval: number,
): number {
  const leg = intraday?.legs.find((l) => l.legId === legId);
  if (leg?.points.length) {
    return count5mCandlesInLeg(leg.points, displayInterval);
  }
  const diag = analytics?.focusPairDiagnostics;
  if (legId === diag?.legA) return diag.legACandles;
  if (legId === diag?.legB) return diag.legBCandles;
  return 0;
}

export function QuadHedgeSpreadLabHeader({
  viewMode,
  analytics,
  intraday,
  historyDepth,
  displayIntervalMinutes = SPREAD_LAB_DISPLAY_INTERVAL,
  isLoading,
  className,
}: {
  viewMode: QuadHedgeViewMode;
  analytics: QuadHedgeAnalyticsResult | null;
  intraday: QuadHedgeIntradayResponse | undefined;
  historyDepth: SpreadLabHistoryDepth;
  displayIntervalMinutes?: number;
  isLoading?: boolean;
  className?: string;
}) {
  const legA = viewMode === "SI-CN" || viewMode === "SI-EU" ? "SI" : "EU";
  const legB = viewMode === "SI-CN" ? "CN" : viewMode === "SI-EU" ? "EU" : "CN";

  const tickerA = legTicker(intraday, legA);
  const tickerB = legTicker(intraday, legB);
  const candlesA = leg5mCandles(intraday, analytics, legA, displayIntervalMinutes);
  const candlesB = leg5mCandles(intraday, analytics, legB, displayIntervalMinutes);
  const candleCount = Math.max(candlesA, candlesB, analytics?.focusPairDiagnostics?.alignedPoints ?? 0);
  const depthLabel = spreadLabHistoryDepthLabel(historyDepth);
  const sessionsFound = analytics?.history.tradingSessions.length ?? 0;

  return (
    <LabGlassPanel
      depth={10}
      className={cn(
        "border-cyan-500/10 bg-slate-950/50 px-3 py-2 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[11px]">
        <span className="text-cyan-200/90">{pairLabel(viewMode)}</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">{displayIntervalMinutes}м</span>
        <span className="text-slate-600">·</span>
        <span className="text-amber-300/85">{isLoading ? "…" : depthLabel}</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-300">
          {tickerA} / {tickerB}
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-500">
          {isLoading ? "…" : `${candleCount} свечей`}
        </span>
        {!isLoading && sessionsFound > 0 ? (
          <>
            <span className="text-slate-600">·</span>
            <span className="text-slate-600">{sessionsFound} сесс.</span>
          </>
        ) : null}
      </div>
      {analytics?.focusPairDiagnostics && !isLoading ? (
        <p className="mt-0.5 text-[9px] text-slate-600">
          aligned {analytics.focusPairDiagnostics.alignedPoints} · spread{" "}
          {analytics.focusPairDiagnostics.spreadFinitePoints} п.
        </p>
      ) : null}
      {intraday?.intervalNotice ? (
        <p className="mt-0.5 text-[9px] text-amber-400/70">{intraday.intervalNotice}</p>
      ) : null}
    </LabGlassPanel>
  );
}

export function formatSpreadLabEmptyState(
  analytics: QuadHedgeAnalyticsResult | null,
  intraday: QuadHedgeIntradayResponse | undefined,
  viewMode: QuadHedgeViewMode,
  historyDepth: SpreadLabHistoryDepth,
): string {
  const diag = analytics?.focusPairDiagnostics;
  const legA = viewMode === "SI-CN" || viewMode === "SI-EU" ? "SI" : "EU";
  const legB = viewMode === "SI-CN" ? "CN" : viewMode === "SI-EU" ? "EU" : "CN";

  const aCandles = diag?.legACandles ?? intraday?.legs.find((l) => l.legId === legA)?.points.length ?? 0;
  const bCandles = diag?.legBCandles ?? intraday?.legs.find((l) => l.legId === legB)?.points.length ?? 0;
  const aligned = diag?.alignedPoints ?? 0;
  const spread = diag?.spreadFinitePoints ?? 0;
  const sessions = analytics?.history.tradingSessions.length ?? 0;
  const reason = diag?.reason ?? analytics?.focusSpreadPoints?.interpretation ?? "неизвестная причина";

  if (historyDepth !== "MAX" && (aligned < 2 || sessions < (historyDepth === "1S" ? 1 : historyDepth === "3S" ? 3 : 7))) {
    return [
      `История ${spreadLabHistoryDepthLabel(historyDepth)} недоступна через текущий MOEX ISS запрос.`,
      `Получено ${Math.max(aCandles, bCandles)} свечей, сессий ${sessions}.`,
      "Для стабильной истории нужен local collector.",
    ].join("\n");
  }

  return [
    `${legA} candles: ${aCandles}`,
    `${legB} candles: ${bCandles}`,
    `aligned points: ${aligned}`,
    `spread points: ${spread}`,
    `причина: ${reason}`,
  ].join("\n");
}
