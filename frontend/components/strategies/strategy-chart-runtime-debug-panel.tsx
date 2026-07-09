"use client";

import * as React from "react";
import { formatStrategyCandleTimeMsk } from "@/lib/strategies/strategy-candles-normalizer";
import {
  inferStrategyChartBlankCause,
  type StrategyChartRuntimeDiagnostics,
} from "@/lib/strategies/strategy-chart-runtime-diagnostics";
import { cn } from "@/lib/utils/cn";

function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "yes" : "no";
}

function num(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function candleLine(
  label: string,
  candle: StrategyChartRuntimeDiagnostics["firstCandle"],
): string {
  if (!candle) return `${label}: —`;
  const begin = candle.begin ? ` begin=${candle.begin}` : "";
  return `${label}:${begin} t=${candle.time} (${formatStrategyCandleTimeMsk(candle.time)}) O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close}`;
}

function logicalRange(diagnostics: StrategyChartRuntimeDiagnostics): string {
  const range = diagnostics.visibleLogicalRange;
  if (!range) return "—";
  return `from ${num(range.from, 2)} to ${num(range.to, 2)}`;
}

function visibleRange(diagnostics: StrategyChartRuntimeDiagnostics): string {
  if (diagnostics.visibleRangeFrom == null || diagnostics.visibleRangeTo == null) return "—";
  return `${diagnostics.visibleRangeFrom} → ${diagnostics.visibleRangeTo}`;
}

function formatIsoTime(iso: string | null | undefined): string {
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
      <p className="font-mono text-[9px] uppercase tracking-wide text-cyan-600/80">{title}</p>
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

export function StrategyChartRuntimeDebugPanel({
  diagnostics,
  className,
}: {
  diagnostics: StrategyChartRuntimeDiagnostics;
  className?: string;
}) {
  const cause = inferStrategyChartBlankCause(diagnostics);

  return (
    <div
      className={cn(
        "space-y-2 rounded border border-amber-900/35 bg-amber-950/10 px-2.5 py-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wide text-amber-200/90">
          Chart runtime diagnostics
        </p>
        <div className="flex items-center gap-2 font-mono text-[9px] text-zinc-600">
          <span>source {diagnostics.source}</span>
          <span>{formatIsoTime(diagnostics.collectedAt)}</span>
        </div>
      </div>

      <p className="font-mono text-[10px] text-amber-100/90">
        inferred cause: <span className="text-amber-50">{cause}</span>
      </p>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <DiagnosticSection title="1. Container">
          <DiagnosticRow label="width×height" value={`${diagnostics.containerWidth}×${diagnostics.containerHeight}`} />
          <DiagnosticRow label="container ready" value={yesNo(diagnostics.containerReady)} />
          <DiagnosticRow label="chart created" value={yesNo(diagnostics.chartCreated)} />
          <DiagnosticRow label="chart ready" value={yesNo(diagnostics.chartReady)} />
          <DiagnosticRow label="canvas count" value={String(diagnostics.canvasCount)} />
          <DiagnosticRow
            label="canvas bitmap"
            value={`${diagnostics.canvasBitmapWidth ?? "—"}×${diagnostics.canvasBitmapHeight ?? "—"}`}
          />
          <DiagnosticRow
            label="canvas CSS"
            value={`${num(diagnostics.canvasCssWidth, 0)}×${num(diagnostics.canvasCssHeight, 0)}`}
          />
          <DiagnosticRow
            label="pane size"
            value={`${diagnostics.paneWidth ?? "—"}×${diagnostics.paneHeight ?? "—"}`}
          />
          <DiagnosticRow label="overlay isolation" value={yesNo(diagnostics.overlayIsolation)} />
        </DiagnosticSection>

        <DiagnosticSection title="2. Candlestick series">
          <DiagnosticRow label="candles" value={String(diagnostics.setDataCandlesLength)} />
          <DiagnosticRow label="series created" value={yesNo(diagnostics.candlestickSeriesCreated)} />
          <DiagnosticRow label="series ready" value={yesNo(diagnostics.seriesReady)} />
          <DiagnosticRow label="data ready" value={yesNo(diagnostics.dataReady)} />
          <DiagnosticRow label="data applied" value={yesNo(diagnostics.dataApplied)} />
          <DiagnosticRow label="setData called" value={yesNo(diagnostics.setDataCalled)} />
          <DiagnosticRow label="setDataCallCount" value={String(diagnostics.setDataCallCount)} />
          <DiagnosticRow label="lastSetDataReason" value={diagnostics.lastSetDataReason ?? "—"} />
          <DiagnosticRow label="skippedSetDataReason" value={diagnostics.skippedSetDataReason ?? "—"} />
          <DiagnosticRow label="selfHealAttempts" value={String(diagnostics.selfHealAttempts)} />
          <DiagnosticRow label="recreateAttempts" value={String(diagnostics.recreateAttempts)} />
          <DiagnosticRow label="series.data().length" value={String(diagnostics.seriesDataLength ?? "—")} />
          <DiagnosticRow label="lastValueData noData" value={yesNo(diagnostics.lastValueDataNoData)} />
          <DiagnosticRow label="lastValue price" value={num(diagnostics.lastValuePrice, 2)} />
          <p>{candleLine("first", diagnostics.firstCandle)}</p>
          <p>{candleLine("last", diagnostics.lastCandle)}</p>
        </DiagnosticSection>

        <DiagnosticSection title="3. Time scale">
          <DiagnosticRow label="width×height" value={`${diagnostics.timeScaleWidth ?? "—"}×${diagnostics.timeScaleHeight ?? "—"}`} />
          <DiagnosticRow label="duration minutes" value={String(diagnostics.durationMinutes ?? "—")} />
          <DiagnosticRow label="interval guess sec" value={String(diagnostics.intervalGuessSeconds ?? "—")} />
          <DiagnosticRow label="visibleLogicalRange" value={logicalRange(diagnostics)} />
          <DiagnosticRow label="visibleRange" value={visibleRange(diagnostics)} />
          <DiagnosticRow label="visible preset" value={diagnostics.visiblePreset ?? "—"} />
          <DiagnosticRow
            label="visible bars count"
            value={diagnostics.visibleBarsCount != null ? String(diagnostics.visibleBarsCount) : "—"}
          />
          <DiagnosticRow
            label="first visible time"
            value={
              diagnostics.visibleRangeFrom != null ? String(diagnostics.visibleRangeFrom) : "—"
            }
          />
          <DiagnosticRow
            label="last visible time"
            value={diagnostics.visibleRangeTo != null ? String(diagnostics.visibleRangeTo) : "—"}
          />
          <DiagnosticRow
            label="last applyVisibleRange reason"
            value={diagnostics.lastApplyVisibleRangeReason ?? "—"}
          />
          <DiagnosticRow label="barSpacing" value={num(diagnostics.barSpacing, 2)} />
          <DiagnosticRow label="userZoomed" value={yesNo(diagnostics.userZoomed)} />
          <DiagnosticRow label="last fit reason" value={diagnostics.lastFitReason ?? "—"} />
          <DiagnosticRow label="first x" value={num(diagnostics.firstTimeToCoordinate, 1)} />
          <DiagnosticRow label="last x" value={num(diagnostics.lastTimeToCoordinate, 1)} />
          <DiagnosticRow label="fitContent called" value={yesNo(diagnostics.fitContentCalled)} />
        </DiagnosticSection>

        <DiagnosticSection title="4. Price scale">
          <DiagnosticRow label="first open y" value={num(diagnostics.priceToCoordinateFirstOpen, 1)} />
          <DiagnosticRow label="last close y" value={num(diagnostics.priceToCoordinateLastClose, 1)} />
          <DiagnosticRow label="min low y" value={num(diagnostics.priceToCoordinateMinLow, 1)} />
          <DiagnosticRow label="max high y" value={num(diagnostics.priceToCoordinateMaxHigh, 1)} />
        </DiagnosticSection>

        <DiagnosticSection title="5. Overlay layers">
          <DiagnosticRow label="base visible" value={yesNo(diagnostics.baseCandlesVisible)} />
          <DiagnosticRow label="seriesDataLength" value={String(diagnostics.seriesDataLength ?? "—")} />
          <DiagnosticRow label="priceLines" value={String(diagnostics.priceLinesCount)} />
          <DiagnosticRow label="zones" value={String(diagnostics.bufferZonesCount)} />
          <DiagnosticRow label="markers" value={String(diagnostics.markersCount)} />
          <DiagnosticRow label="overlay gate blocked" value={yesNo(diagnostics.overlaysGateBlocked)} />
        </DiagnosticSection>

        <DiagnosticSection title="6. Errors">
          <DiagnosticRow label="createSeries error" value={diagnostics.createSeriesError ?? "—"} />
          <DiagnosticRow label="setData error" value={diagnostics.setDataError ?? "—"} />
          <DiagnosticRow label="invalid time/OHLC" value={String(diagnostics.invalidTimeOhlcCount)} />
          {diagnostics.errors.length > 0 ? (
            <div className="space-y-0.5 text-rose-300/85">
              {diagnostics.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : (
            <p className="text-zinc-600">no errors</p>
          )}
        </DiagnosticSection>
      </div>
    </div>
  );
}
