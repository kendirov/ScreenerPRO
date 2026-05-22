"use client";

import * as React from "react";
import { ClusterFootprintCell } from "@/components/lab/orderflow-simulator/cluster-footprint-cell";
import { ClusterWhatToWatch } from "@/components/lab/orderflow-simulator/cluster-what-to-watch";
import { detectAbsorptionSignals } from "@/lib/domain/orderflow-absorption";
import { pricesEqual } from "@/lib/domain/order-book-ladder-model";
import {
  absorptionAtPrice,
  buildFootprintGrid,
  DEFAULT_IMBALANCE_RATIO,
  FOOTPRINT_MODE_LABELS,
  type FootprintDisplayMode,
} from "@/lib/domain/footprint-model";
import type { SimCandle, SimClusterCell, SimOrderBookLevel } from "@/lib/domain/orderflow-simulator";
import { pulseForFootprintCell, pulseIntensity, type ClusterPulse } from "@/lib/domain/tape-bubbles-model";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

export type { FootprintChartMarker } from "@/lib/domain/footprint-model";
export { buildFootprintChartMarkers } from "@/lib/domain/footprint-model";

type ClusterPanelProps = {
  clusters: SimClusterCell[];
  levels?: SimOrderBookLevel[];
  currentPrice?: number;
  candles?: SimCandle[];
  clusterPulses?: ClusterPulse[];
  showTeachingHints?: boolean;
  lesson?: boolean;
  presentation?: boolean;
  terminal?: boolean;
  className?: string;
};

const MODE_OPTIONS: FootprintDisplayMode[] = ["volume", "delta", "split", "imbalance"];

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ClusterPanelBody({
  clusters,
  levels,
  currentPrice,
  candles,
  clusterPulses,
  showTeachingHints,
  lesson,
  presentation,
  terminal,
}: Omit<ClusterPanelProps, "className">) {
  const [mode, setMode] = React.useState<FootprintDisplayMode>("volume");
  const imbalanceRatio = DEFAULT_IMBALANCE_RATIO;
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const maxColumns = lesson ? 12 : terminal ? 10 : 10;
  const maxRows = lesson ? 20 : terminal ? 14 : 16;

  const grid = React.useMemo(() => buildFootprintGrid(clusters, maxColumns, maxRows), [clusters, maxColumns, maxRows]);
  const latestBucket = grid.timestamps[grid.timestamps.length - 1];

  const absorptions = React.useMemo(
    () => detectAbsorptionSignals(clusters, levels ?? [], currentPrice ?? 0, candles ?? []),
    [clusters, levels, currentPrice, candles],
  );

  const activePulses = clusterPulses?.filter((p) => p.until > nowMs) ?? [];

  const toggleClass = (active: boolean) =>
    cn(
      "rounded border px-1.5 py-0.5 font-mono transition",
      lesson ? "text-[10px]" : "text-[9px]",
      active
        ? "border-violet-500/35 bg-violet-950/45 text-violet-100"
        : "border-white/[0.07] text-slate-500 hover:text-slate-300",
    );

  const cellMinH = lesson ? "min-h-[48px]" : terminal ? "min-h-[34px]" : "min-h-[40px]";

  return (
    <>
      {showTeachingHints && !presentation ? <ClusterWhatToWatch className="mx-2 mt-2" /> : null}

      {showTeachingHints && absorptions.length > 0 ? (
        <p className="mx-2 mt-2 rounded border border-cyan-500/20 bg-cyan-950/25 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-cyan-100/90">
          Прошёл объём, но цена не ушла дальше — уровень удержали. Метка «абсорбция» — учебная эвристика
          симулятора, не сигнал MOEX.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1 border-b border-indigo-500/10 bg-[#030508] px-2 py-1">
        <span className="text-[9px] uppercase tracking-wider text-slate-600">Режим</span>
        {MODE_OPTIONS.map((m) => (
          <button key={m} type="button" className={toggleClass(mode === m)} onClick={() => setMode(m)}>
            {FOOTPRINT_MODE_LABELS[m]}
          </button>
        ))}
        {mode === "imbalance" ? (
          <span className="ml-auto font-mono text-[9px] text-slate-500">порог {imbalanceRatio}×</span>
        ) : null}
      </div>

      <div className={cn("min-h-0 flex-1 overflow-auto p-2", lesson && "p-3")}>
        {clusters.length === 0 ? (
          <p className="py-4 text-center font-mono text-xs text-slate-600">Кластера появятся после сделок</p>
        ) : (
          <div
            className="inline-grid gap-px"
            style={{
              gridTemplateColumns: `52px repeat(${grid.timestamps.length}, minmax(${lesson ? 64 : 56}px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-[2] bg-[#020408] px-1 py-1 text-[9px] text-slate-600">Цена</div>
            {grid.timestamps.map((ts) => (
              <div
                key={ts}
                className="bg-[#020408] px-1 py-1 text-center font-mono text-[9px] tabular-nums text-slate-500"
              >
                {formatTime(ts)}
              </div>
            ))}

            {grid.prices.map((price) => (
              <div key={`row-${price}`} className="contents">
                <div
                  className={cn(
                    "sticky left-0 z-[2] bg-[#020408] px-1 py-1 font-mono tabular-nums text-slate-400",
                    lesson ? "text-[11px]" : "text-[10px]",
                    pricesEqual(price, currentPrice ?? 0) && "text-cyan-300",
                  )}
                >
                  {formatPrice(price)}
                </div>
                {grid.timestamps.map((ts) => {
                  const cell = grid.cellMap.get(`${ts}-${price}`);
                  if (!cell) {
                    return <div key={`${ts}-${price}`} className={cn(cellMinH, "bg-slate-950/50")} />;
                  }

                  const pulse = pulseForFootprintCell(price, ts, activePulses, latestBucket);
                  const absorption = absorptionAtPrice(absorptions, price, ts) ?? absorptionAtPrice(absorptions, price);

                  return (
                    <ClusterFootprintCell
                      key={`${ts}-${price}`}
                      cell={cell}
                      mode={mode}
                      maxVolume={grid.maxVolume}
                      maxAbsDelta={grid.maxAbsDelta}
                      imbalanceRatio={imbalanceRatio}
                      absorption={absorption}
                      pulsing={Boolean(pulse)}
                      pulseStrength={pulse ? pulseIntensity(pulse) : 0}
                      compact={terminal && !lesson}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {absorptions.length > 0 && !showTeachingHints ? (
        <div className="border-t border-cyan-500/15 bg-cyan-950/15 px-2 py-1 font-mono text-[9px] text-cyan-200/85">
          Абсорбция: {absorptions.map((a) => `${formatPrice(a.price)} · ${a.shortLabel}`).join(" · ")}
        </div>
      ) : null}
    </>
  );
}

export function ClusterPanel({
  clusters,
  levels = [],
  currentPrice = 0,
  candles = [],
  clusterPulses = [],
  showTeachingHints = false,
  lesson = false,
  presentation = false,
  terminal = false,
  className,
}: ClusterPanelProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  const panelClass = cn(
    "orderflow-terminal-panel flex min-h-0 flex-col overflow-hidden",
    terminal ? "rounded-none border-0 bg-[#020408]" : "rounded-lg border border-white/[0.06] bg-[#060a14]",
    className,
  );

  const headerTitle = terminal || presentation ? "Footprint" : "Кластера / footprint";

  const body = (
    <ClusterPanelBody
      clusters={clusters}
      levels={levels}
      currentPrice={currentPrice}
      candles={candles}
      clusterPulses={clusterPulses}
      showTeachingHints={showTeachingHints}
      lesson={lesson}
      presentation={presentation}
      terminal={terminal}
    />
  );

  if (terminal && !presentation) {
    return (
      <div className={panelClass}>
        <div className="flex shrink-0 items-center justify-between border-b border-indigo-500/10 bg-[#030508] px-2 py-0.5">
          <span className="orderflow-pane-header border-0 px-0 py-0">Кластера</span>
          <button
            type="button"
            className="rounded border border-white/[0.08] px-1.5 py-0.5 font-mono text-[9px] text-slate-500 hover:text-slate-300"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "Показать" : "Скрыть"}
          </button>
        </div>
        {!collapsed ? body : null}
      </div>
    );
  }

  return (
    <div className={panelClass}>
      <div className={cn(terminal || presentation ? "orderflow-pane-header" : "border-b border-white/[0.05] px-3 py-2")}>
        <h3 className={cn(!terminal && !presentation && "text-xs font-medium uppercase tracking-[0.12em] text-slate-400")}>
          {headerTitle}
        </h3>
        {!terminal && !presentation ? (
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">
            строки = цены · колонки = временные бакеты · не MOEX
          </p>
        ) : null}
      </div>
      {body}
    </div>
  );
}
