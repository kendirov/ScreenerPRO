"use client";

import * as React from "react";
import type { ScreenerApiResponse } from "@screenerpro/shared";
import type { StocksRadarDiagnostics } from "@/lib/screener/stocks-radar";

export function ScreenerDevDebugPanel({
  endpoint,
  response,
  rowsBeforeFilter,
  rowsAfterFilter,
  breadthAudit,
  errorMessage,
}: {
  endpoint: string;
  response?: ScreenerApiResponse | null;
  rowsBeforeFilter?: number;
  rowsAfterFilter?: number;
  breadthAudit?: StocksRadarDiagnostics | null;
  errorMessage?: string | null;
}) {
  const [healthMode, setHealthMode] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/screener/health", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { moexDataMode?: string }) => {
        if (!cancelled) setHealthMode(data.moexDataMode ?? null);
      })
      .catch(() => {
        if (!cancelled) setHealthMode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [response?.status?.source]);

  if (process.env.NODE_ENV !== "development") return null;

  const status = response?.status;
  const diagnostics = response?.diagnostics;
  const firstError = diagnostics?.errors?.[0] ?? errorMessage ?? null;
  const audit = breadthAudit;

  return (
    <div className="mt-2 rounded-lg border border-dashed border-amber-500/30 bg-amber-950/20 px-3 py-2 font-mono text-[10px] text-amber-100/90">
      <p className="mb-1 text-[9px] uppercase tracking-wide text-amber-300/80">dev · screener pipeline</p>
      <div className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-4">
        <span>MOEX_DATA_MODE: {healthMode ?? "—"}</span>
        <span>endpoint: {endpoint}</span>
        <span>status.source: {status?.source ?? "—"}</span>
        <span>isDemo: {String(status?.isDemo ?? false)}</span>
        <span>api rawRows: {audit?.rawRows ?? rowsBeforeFilter ?? "—"}</span>
        <span>afterAssetClass: {audit?.afterAssetClass ?? "—"}</span>
        <span>afterTickerShape: {audit?.afterTickerShapeFilter ?? "—"}</span>
        <span>afterBondFundExcl: {audit?.afterBondFundExclusion ?? "—"}</span>
        <span>validStockUniverse: {audit?.universeCount ?? "—"}</span>
        <span>visibleRows: {rowsAfterFilter ?? "—"}</span>
        <span>excludedBondLike: {audit?.excludedBondLike ?? "—"}</span>
        <span>excludedFunds: {audit?.excludedFunds ?? "—"}</span>
        <span>rising: {audit?.risingCount ?? "—"}</span>
        <span>falling: {audit?.fallingCount ?? "—"}</span>
        <span>flat: {audit?.flatCount ?? "—"}</span>
        <span>breadth sum: {audit?.sum ?? "—"}</span>
        <span>filteredIlliquid: {audit?.filteredIlliquidCount ?? "—"}</span>
        <span>duplicatesRemoved: {audit?.duplicatesRemoved ?? 0}</span>
        <span>invalidRowsRemoved: {audit?.invalidRowsRemoved ?? 0}</span>
        {audit?.excludedExamples?.length ? (
          <span className="sm:col-span-2 lg:col-span-4">
            excluded: {audit.excludedExamples.slice(0, 5).map((e) => `${e.ticker}(${e.reason})`).join(", ")}
          </span>
        ) : null}
        {audit?.breadthMismatch ? (
          <span className="text-rose-300 sm:col-span-2 lg:col-span-4">⚠ breadth sum !== universeCount</span>
        ) : (
          <span className="text-emerald-300/80">breadth ok: sum === universeCount</span>
        )}
        {audit?.marketBreadth ? (
          <>
            <span className="sm:col-span-2 lg:col-span-4 text-[9px] uppercase tracking-wide text-amber-300/70">
              marketBreadth
            </span>
            <span>mb universe: {audit.marketBreadth.universeCount}</span>
            <span>mb rising: {audit.marketBreadth.rising}</span>
            <span>mb falling: {audit.marketBreadth.falling}</span>
            <span>mb flat: {audit.marketBreadth.flat}</span>
            <span>mb sum: {audit.marketBreadth.sum}</span>
          </>
        ) : null}
        {audit?.indexBreadth ? (
          <>
            <span className="sm:col-span-2 lg:col-span-4 text-[9px] uppercase tracking-wide text-amber-300/70">
              indexBreadth
            </span>
            <span>idx source: {audit.indexBreadth.source}</span>
            <span>idx components: {audit.indexBreadth.componentsCount}</span>
            <span>idx matched: {audit.indexBreadth.matchedCount}</span>
            <span>idx rising: {audit.indexBreadth.rising}</span>
            <span>idx falling: {audit.indexBreadth.falling}</span>
            <span>idx flat: {audit.indexBreadth.flat}</span>
            <span>idx sum: {audit.indexBreadth.sum}</span>
            {audit.indexBreadth.sum !== audit.indexBreadth.matchedCount ? (
              <span className="text-rose-300 sm:col-span-2">⚠ index sum !== matchedCount</span>
            ) : (
              <span className="text-emerald-300/80">index ok: sum === matchedCount</span>
            )}
            {audit.indexBreadth.missingTickers.length ? (
              <span className="sm:col-span-2 lg:col-span-4">
                idx missing: {audit.indexBreadth.missingTickers.join(", ")}
              </span>
            ) : null}
          </>
        ) : null}
        <span className="sm:col-span-2 lg:col-span-4">first error: {firstError ?? "—"}</span>
      </div>
    </div>
  );
}
