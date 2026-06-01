"use client";

import {
  signalStateLabelRu,
  tradeBiasLabelRu,
  type QuadHedgeAnalyticsResult,
} from "@/lib/domain/quad-hedge";

/** Компактная диагностика сигналов (свёрнута по умолчанию — не меняет основной layout). */
export function QuadHedgeDiagnosticsPanel({
  analytics,
}: {
  analytics: QuadHedgeAnalyticsResult | null;
}) {
  if (!analytics) return null;

  const focusZ = analytics.zScores.find((z) => z.pairKey === analytics.focusPair);
  const focusSpread = analytics.spreads.find((s) => s.pairKey === analytics.focusPair);

  return (
    <details className="rounded-lg border border-white/[0.05] bg-slate-950/30 px-2 py-1">
      <summary className="cursor-pointer select-none py-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">
        Квадрохедж · сигналы
      </summary>
      <div className="space-y-1.5 pb-2 pt-1 font-mono text-[10px] text-slate-400">
        <p className="text-slate-300">{analytics.headline}</p>
        <p>
          <span className="text-slate-600">state </span>
          {signalStateLabelRu(analytics.signalState)}
          <span className="text-slate-600"> · bias </span>
          {tradeBiasLabelRu(analytics.tradeBias)}
          {analytics.divergenceScore != null ? (
            <>
              <span className="text-slate-600"> · score </span>
              {analytics.divergenceScore}
            </>
          ) : null}
        </p>
        {focusZ?.current != null ? (
          <p>
            <span className="text-slate-600">z </span>
            {focusZ.current.toFixed(2)}
            {focusSpread?.current != null ? (
              <>
                <span className="text-slate-600"> · spread </span>
                {focusSpread.current.toFixed(2)} pp
              </>
            ) : null}
          </p>
        ) : null}
        <p className="text-slate-500">{analytics.interpretation}</p>
        <p className="text-slate-600">
          quality {analytics.dataQuality.score}/100 ·{" "}
          {analytics.dataQuality.canComputeSignals ? "signals OK" : "diagnostics only"}
        </p>
        {analytics.warnings.length > 0 ? (
          <ul className="list-inside list-disc text-amber-300/80">
            {analytics.warnings.slice(0, 4).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
