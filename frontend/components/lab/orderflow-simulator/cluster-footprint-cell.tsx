"use client";

import type { AbsorptionSignal } from "@/lib/domain/orderflow-absorption";
import {
  DEFAULT_IMBALANCE_RATIO,
  deltaIntensity,
  imbalanceSide,
  isImbalanced,
  volumeIntensity,
  type FootprintDisplayMode,
} from "@/lib/domain/footprint-model";
import type { SimClusterCell } from "@/lib/domain/orderflow-simulator";
import { cn } from "@/lib/utils/cn";

type ClusterFootprintCellProps = {
  cell: SimClusterCell;
  mode: FootprintDisplayMode;
  maxVolume: number;
  maxAbsDelta: number;
  imbalanceRatio?: number;
  absorption?: AbsorptionSignal;
  pulsing?: boolean;
  pulseStrength?: number;
  compact?: boolean;
};

export function ClusterFootprintCell({
  cell,
  mode,
  maxVolume,
  maxAbsDelta,
  imbalanceRatio = DEFAULT_IMBALANCE_RATIO,
  absorption,
  pulsing = false,
  pulseStrength = 0.5,
  compact = false,
}: ClusterFootprintCellProps) {
  const positive = cell.delta >= 0;
  const volI = volumeIntensity(cell.totalVolume, maxVolume);
  const deltaI = deltaIntensity(cell.delta, maxAbsDelta);
  const imbalanced = isImbalanced(cell, imbalanceRatio);
  const imbSide = imbalanceSide(cell, imbalanceRatio);

  let backgroundColor = "rgba(15,23,42,0.5)";
  let ringClass = "";

  switch (mode) {
    case "volume":
      backgroundColor = `rgba(148,163,184,${0.06 + volI * 0.58})`;
      break;
    case "delta":
      backgroundColor = positive
        ? `rgba(34,197,94,${0.1 + deltaI * 0.62})`
        : `rgba(239,68,68,${0.1 + deltaI * 0.62})`;
      break;
    case "split":
      backgroundColor = "rgba(15,23,42,0.35)";
      break;
    case "imbalance":
      if (imbalanced && imbSide === "buy") {
        backgroundColor = `rgba(34,197,94,${0.14 + volI * 0.45})`;
        ringClass = "ring-1 ring-emerald-400/40";
      } else if (imbalanced && imbSide === "sell") {
        backgroundColor = `rgba(239,68,68,${0.14 + volI * 0.45})`;
        ringClass = "ring-1 ring-rose-400/40";
      } else {
        backgroundColor = `rgba(51,65,85,${0.12 + volI * 0.22})`;
      }
      break;
    default:
      break;
  }

  if (pulsing) {
    const boost = 0.12 + pulseStrength * 0.35;
    backgroundColor = positive
      ? `rgba(34,211,238,${boost})`
      : `rgba(251,191,36,${boost * 0.85})`;
    ringClass = `${ringClass} ring-1 ring-cyan-300/45`.trim();
  }

  if (absorption) {
    ringClass =
      absorption.type === "buyer"
        ? `${ringClass} ring-1 ring-cyan-400/55`.trim()
        : `${ringClass} ring-1 ring-amber-400/50`.trim();
  }

  const textSize = compact ? "text-[7px]" : "text-[8px]";

  return (
    <div
      className={cn(
        "relative flex min-h-[40px] flex-col justify-center overflow-hidden px-0.5 py-0.5 font-mono leading-tight transition-[background-color,box-shadow] duration-200",
        textSize,
        ringClass,
        pulsing && "cluster-cell-pulse",
      )}
      style={{
        backgroundColor,
        ...(pulsing ? { ["--pulse-strength" as string]: pulseStrength } : {}),
      }}
      title={[
        `Покупки: ${cell.buyVolume}`,
        `Продажи: ${cell.sellVolume}`,
        `Всего: ${cell.totalVolume}`,
        `Δ: ${cell.delta > 0 ? "+" : ""}${cell.delta}`,
        absorption?.label,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      {mode === "volume" ? (
        <span className="text-center text-[10px] font-semibold tabular-nums text-slate-100">{cell.totalVolume}</span>
      ) : null}

      {mode === "delta" ? (
        <span
          className={cn(
            "text-center text-[10px] font-semibold tabular-nums",
            positive ? "text-emerald-300" : "text-rose-300",
          )}
        >
          {cell.delta > 0 ? "+" : ""}
          {cell.delta}
        </span>
      ) : null}

      {mode === "split" ? (
        <div className="flex h-full min-h-[36px] w-full flex-col overflow-hidden rounded-sm">
          <div
            className="flex flex-1 items-center justify-center bg-emerald-500/28 text-emerald-100"
            style={{ flex: cell.buyVolume || 1 }}
          >
            <span className="tabular-nums">{cell.buyVolume || "—"}</span>
          </div>
          <div
            className="flex flex-1 items-center justify-center bg-rose-500/28 text-rose-100"
            style={{ flex: cell.sellVolume || 1 }}
          >
            <span className="tabular-nums">{cell.sellVolume || "—"}</span>
          </div>
        </div>
      ) : null}

      {mode === "imbalance" ? (
        <>
          <div className="flex justify-between gap-0.5 tabular-nums">
            <span className={imbSide === "buy" ? "font-semibold text-emerald-300" : "text-emerald-400/70"}>
              {cell.buyVolume}
            </span>
            <span className={imbSide === "sell" ? "font-semibold text-rose-300" : "text-rose-400/70"}>
              {cell.sellVolume}
            </span>
          </div>
          {imbalanced ? (
            <span className="text-center text-[7px] uppercase tracking-wide text-slate-400">3×+</span>
          ) : (
            <span className="text-center text-[7px] text-slate-600">—</span>
          )}
        </>
      ) : null}

      {absorption ? (
        <span
          className={cn(
            "absolute bottom-0 left-0 right-0 truncate bg-black/55 px-0.5 text-center text-[6px] uppercase tracking-wide",
            absorption.type === "buyer" ? "text-cyan-300" : "text-amber-300",
          )}
        >
          абсорбция
        </span>
      ) : null}
    </div>
  );
}
