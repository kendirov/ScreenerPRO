"use client";

import * as React from "react";
import type { StrategyBrowserParityDiagnostics } from "@/lib/strategies/strategy-chart-browser-parity";
import type { StrategyChartRuntimeDiagnostics } from "@/lib/strategies/strategy-chart-runtime-diagnostics";
import { cn } from "@/lib/utils/cn";

function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "yes" : "no";
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = iso.match(/T(\d{2}):(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}:${match[3]}` : "—";
}

function DiagnosticSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="font-mono text-[9px] uppercase tracking-wide text-violet-400/90">{title}</p>
      <div className="space-y-0.5 font-mono text-[10px] leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-zinc-600">{label}</span> {value}
    </p>
  );
}

function logicalRange(diagnostics: StrategyChartRuntimeDiagnostics): string {
  const range = diagnostics.visibleLogicalRange;
  if (!range) return "—";
  return `from ${range.from.toFixed(2)} to ${range.to.toFixed(2)}`;
}

type StrategyChartBrowserParityDebugPanelProps = {
  parity: StrategyBrowserParityDiagnostics;
  runtime: StrategyChartRuntimeDiagnostics;
  onResetState: () => void;
  onReloadFresh: () => void;
  className?: string;
};

export function StrategyChartBrowserParityDebugPanel({
  parity,
  runtime,
  onResetState,
  onReloadFresh,
  className,
}: StrategyChartBrowserParityDebugPanelProps) {
  const riskEntries = parity.localStorageEntries.filter((entry) => entry.chartRisk && entry.present);
  const runtimeVersionMismatch = parity.runtimeVersion !== parity.expectedRuntimeVersion;

  return (
    <div
      className={cn(
        "space-y-2 rounded border border-violet-900/35 bg-violet-950/10 px-2.5 py-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-violet-200/90">
          Browser parity diagnostics
        </p>
        <span className="font-mono text-[9px] text-zinc-600">
          {parity.collectedAt ? formatTime(parity.collectedAt) : "—"}
        </span>
      </div>

      {parity.staleBundleWarning ? (
        <p className="rounded border border-rose-500/40 bg-rose-950/50 px-2 py-1.5 font-mono text-[10px] text-rose-200">
          {parity.staleBundleWarning}
        </p>
      ) : null}

      {runtimeVersionMismatch ? (
        <p className="rounded border border-rose-500/40 bg-rose-950/50 px-2 py-1.5 font-mono text-[10px] text-rose-200">
          Runtime version mismatch. Browser state may be stale.
        </p>
      ) : null}

      {riskEntries.length > 0 ? (
        <p className="rounded border border-amber-600/35 bg-amber-950/40 px-2 py-1.5 font-mono text-[10px] text-amber-100/90">
          Chart-risk localStorage keys present: {riskEntries.map((entry) => entry.key).join(", ")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onResetState}
          className="rounded border border-rose-800/45 bg-rose-950/25 px-2 py-1 font-mono text-[10px] text-rose-100 transition hover:border-rose-600/55"
        >
          Reset Strategy Lab state
        </button>
        <button
          type="button"
          onClick={onReloadFresh}
          className="rounded border border-violet-800/45 bg-violet-950/25 px-2 py-1 font-mono text-[10px] text-violet-100 transition hover:border-violet-600/55"
        >
          Reload chart fresh
        </button>
      </div>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <DiagnosticSection title="Browser / bundle">
          <DiagnosticRow label="userAgent" value={parity.userAgent} />
          <DiagnosticRow label="current URL" value={parity.currentUrl} />
          <DiagnosticRow label="devicePixelRatio" value={String(parity.devicePixelRatio)} />
          <DiagnosticRow label="runtimeSessionId" value={parity.runtimeSessionId} />
          <DiagnosticRow label="runtime version" value={parity.runtimeVersion} />
          <DiagnosticRow label="expected version" value={parity.expectedRuntimeVersion} />
          <DiagnosticRow label="bundle mountedAt" value={parity.bundleMountedAt || "—"} />
          <DiagnosticRow label="bundle version" value={parity.bundleVersion} />
          <DiagnosticRow label="chart component version" value={parity.chartComponentVersion} />
          <DiagnosticRow
            label="chart version registered"
            value={yesNo(parity.chartComponentVersionRegistered)}
          />
          <DiagnosticRow label="registered chart version" value={parity.registeredChartVersion ?? "—"} />
        </DiagnosticSection>

        <DiagnosticSection title="React lifecycle">
          <DiagnosticRow label="route mountedAt" value={parity.routeMountedAt || "—"} />
          <DiagnosticRow label="page mount count" value={String(parity.routeMountCount)} />
          <DiagnosticRow label="chart mount count" value={String(parity.chartMountCount)} />
          <DiagnosticRow label="chartReadyRevision" value={String(parity.chartReadyRevision)} />
          <DiagnosticRow label="dataRevision" value={String(parity.dataRevision)} />
          <DiagnosticRow label="candles version/hash" value={parity.candlesVersionHash} />
          <DiagnosticRow label="overlays enabled" value={yesNo(parity.overlaysEnabled)} />
        </DiagnosticSection>

        <DiagnosticSection title="setData / series">
          <DiagnosticRow label="chart created" value={yesNo(runtime.chartCreated)} />
          <DiagnosticRow label="series created" value={yesNo(runtime.candlestickSeriesCreated)} />
          <DiagnosticRow label="setDataCallCount" value={String(parity.setDataCallCount)} />
          <DiagnosticRow label="lastSetDataAt" value={parity.lastSetDataAt ?? "—"} />
          <DiagnosticRow label="lastSetDataReason" value={parity.lastSetDataReason ?? "—"} />
          <DiagnosticRow label="seriesDataLength" value={String(runtime.seriesDataLength ?? "—")} />
          <DiagnosticRow label="visibleLogicalRange" value={logicalRange(runtime)} />
          <DiagnosticRow label="lastValueData.noData" value={yesNo(runtime.lastValueDataNoData)} />
        </DiagnosticSection>

        <DiagnosticSection title="Layout / canvas">
          <DiagnosticRow
            label="container CSS size"
            value={`${runtime.containerWidth}×${runtime.containerHeight}`}
          />
          <DiagnosticRow
            label="canvas bitmap size"
            value={`${runtime.canvasBitmapWidth ?? "—"}×${runtime.canvasBitmapHeight ?? "—"}`}
          />
          <DiagnosticRow
            label="canvas CSS size"
            value={`${runtime.canvasCssWidth != null ? Math.round(runtime.canvasCssWidth) : "—"}×${runtime.canvasCssHeight != null ? Math.round(runtime.canvasCssHeight) : "—"}`}
          />
        </DiagnosticSection>

        <DiagnosticSection title="localStorage (strategy)">
          {parity.localStorageEntries.length === 0 ? (
            <p className="text-zinc-600">no strategy keys</p>
          ) : (
            parity.localStorageEntries.map((entry) => (
              <p
                key={entry.key}
                className={cn(
                  entry.chartRisk && entry.present && "text-amber-200/90",
                  !entry.present && "text-zinc-600",
                )}
              >
                <span className={entry.chartRisk ? "text-amber-400/80" : "text-zinc-600"}>
                  {entry.key}
                </span>{" "}
                {entry.present ? (entry.value ?? "null") : "(absent)"}
                {entry.note ? <span className="text-zinc-600"> · {entry.note}</span> : null}
              </p>
            ))
          )}
        </DiagnosticSection>
      </div>
    </div>
  );
}
