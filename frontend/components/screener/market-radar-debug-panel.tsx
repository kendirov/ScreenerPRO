"use client";

import * as React from "react";
import type { MarketRadarDebugSnapshot } from "@/lib/domain/market-radar-debug";

export function MarketRadarDebugPanel() {
  const [snapshot, setSnapshot] = React.useState<MarketRadarDebugSnapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(process.env.NODE_ENV === "development");

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/dev/market-radar-debug");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as MarketRadarDebugSnapshot;
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-amber-200/90">Market Radar debug</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Dev-only. Top-30 по обороту — scores, gates, списки. На /screener/stocks также{" "}
            <code className="text-slate-400">?debugRadar=1</code> → console.table.
          </p>
        </div>
        {snapshot ? (
          <p className="font-mono text-[10px] text-slate-500">{snapshot.generatedAt}</p>
        ) : null}
      </div>

      {loading ? <p className="mt-3 text-xs text-slate-500">Загрузка radar debug…</p> : null}
      {error ? <p className="mt-3 text-xs text-rose-300/90">{error}</p> : null}

      {snapshot ? (
        <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap text-[11px] text-slate-300">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
