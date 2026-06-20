"use client";

import * as React from "react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { StatusChip } from "@/components/ui/metrics-minimalism";
import type { CbrReactionChartGridModel } from "@/lib/domain/cbr-rate-chart-model";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import {
  buildReactionMatrixFromChartSlots,
  formatReactionPct,
  formatVolumeRatio,
} from "@/lib/domain/cbr-rate-reaction";
import { CBR_COMPACT_PATTERN_INCOMPLETE, CBR_COMPACT_PATTERN_NO_DATA } from "@/lib/domain/cbr-rate-reaction-metrics";
import {
  matrixRowsForReplayMode,
  pickCompactMatrixRows,
  resolveCompactMatrixPattern,
} from "@/lib/domain/cbr-rate-replay";
import type { CbrInstrumentReactionMetrics } from "@/lib/domain/cbr-rate-reaction-metrics";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import { CBR_REPLAY_MODE_LABELS } from "@/lib/cbr/cbr-replay-market-mode";
import { cn } from "@/lib/utils/cn";

const COLS = ["5м", "30м", "15:00+", "день", "объём", "паттерн"] as const;

export function CbrCompactReactionMatrix({
  event,
  chartModel,
}: {
  event: CbrRateEvent;
  chartModel?: CbrReactionChartGridModel | null;
}) {
  const allRows = React.useMemo(() => {
    if (!chartModel || chartModel.eventId !== event.id) return [];
    return buildReactionMatrixFromChartSlots(chartModel.slots, event.date);
  }, [chartModel, event.id, event.date]);

  const replayMode = chartModel?.replayMode ?? "equities";
  const matrixSpecs = matrixRowsForReplayMode(replayMode);

  const rows = React.useMemo(
    () => pickCompactMatrixRows(allRows, chartModel ?? null, replayMode),
    [allRows, chartModel, replayMode],
  );

  const loading = chartModel == null || chartModel.eventId !== event.id;

  if (event.status === "upcoming") {
    return (
      <LabGlassPanel depth={10} className="px-3 py-2">
        <p className="text-[10px] text-lab-muted">Матрица реакции — после заседания.</p>
      </LabGlassPanel>
    );
  }

  return (
    <LabGlassPanel depth={10} className="overflow-x-auto p-0">
      <div className="border-b border-lab-border/30 px-2.5 py-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-lab-dim">
          Матрица · {CBR_REPLAY_MODE_LABELS[replayMode]} · только MOEX
        </p>
      </div>
      <table className="w-full min-w-[480px] border-collapse text-left">
        <thead>
          <tr className="border-b border-lab-border/40 text-[8px] uppercase tracking-[0.1em] text-lab-dim">
            <th className="px-2.5 py-1.5 font-medium"> </th>
            {COLS.map((col) => (
              <th
                key={col}
                className={cn(
                  "px-1.5 py-1.5 font-medium",
                  col === "паттерн" ? "pl-2" : "text-right",
                )}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrixSpecs.map((spec, i) => {
            const slot = chartModel?.slots.find((s) => s.id === spec.slotId);
            const label = slot?.title ?? spec.label;
            return (
              <CompactRow
                key={spec.slotId}
                label={label}
                row={rows[i]}
                loading={loading}
                allRows={allRows}
              />
            );
          })}
        </tbody>
      </table>
    </LabGlassPanel>
  );
}

function CompactRow({
  label,
  row,
  loading,
  allRows,
}: {
  label: string;
  row: CbrInstrumentReactionMetrics | null;
  loading: boolean;
  allRows: CbrInstrumentReactionMetrics[];
}) {
  const pattern = resolveCompactMatrixPattern(row, loading, allRows);
  const noData = pattern === CBR_COMPACT_PATTERN_NO_DATA;
  const incomplete = pattern === CBR_COMPACT_PATTERN_INCOMPLETE;

  return (
    <tr className="border-b border-lab-border/25 last:border-0 hover:bg-white/[0.02]">
      <td className="whitespace-nowrap px-2.5 py-1 font-mono text-[10px] font-medium text-lab-text">
        {label}
      </td>
      {loading ? (
        <td colSpan={6} className="px-2 py-1 text-[10px] text-lab-dim">
          …
        </td>
      ) : noData ? (
        <>
          <td colSpan={5} className="px-1.5 py-1 text-right text-[10px] text-lab-dim">
            —
          </td>
          <td className="px-2 py-1">
            <PatternBadge label={pattern} muted noData />
          </td>
        </>
      ) : (
        <>
          <PctCell value={row!.reaction5mPct} />
          <PctCell value={row!.reaction30mPct} />
          <PctCell value={row!.reactionPostPressPct} />
          <PctCell value={row!.reactionDayPct} emphasize />
          <td className="px-1.5 py-1 text-right font-mono text-[10px] tabular-nums text-lab-muted">
            {formatVolumeRatio(row!.volumeRatio)}
          </td>
          <td className="px-2 py-1">
            <PatternBadge label={pattern} muted={pattern === "—" || incomplete} incomplete={incomplete} />
          </td>
        </>
      )}
    </tr>
  );
}

function PctCell({ value, emphasize }: { value: number | null; emphasize?: boolean }) {
  const tone =
    value != null && value > 0
      ? "text-emerald-300/90"
      : value != null && value < 0
        ? "text-rose-300/90"
        : "text-lab-muted";

  return (
    <td
      className={cn(
        "whitespace-nowrap px-1.5 py-1 text-right font-mono tabular-nums",
        emphasize ? "text-[10px] font-semibold" : "text-[10px]",
        tone,
      )}
    >
      {formatReactionPct(value)}
    </td>
  );
}

function PatternBadge({
  label,
  muted,
  noData,
  incomplete,
}: {
  label: string;
  muted?: boolean;
  noData?: boolean;
  incomplete?: boolean;
}) {
  if (label === "…") {
    return <span className="text-[10px] text-lab-dim">…</span>;
  }
  if (label === "—") {
    return <span className="text-[10px] text-lab-dim">—</span>;
  }
  if (noData || label === CBR_COMPACT_PATTERN_NO_DATA) {
    return (
      <span className="text-[9px] text-lab-dim">{CBR_COMPACT_PATTERN_NO_DATA}</span>
    );
  }
  if (incomplete || label === CBR_COMPACT_PATTERN_INCOMPLETE) {
    return (
      <StatusChip
        label="INCOMPLETE"
        tone="amber"
        className="text-[7px] font-normal normal-case tracking-normal"
      />
    );
  }
  return (
    <StatusChip
      label={label}
      tone="muted"
      className={cn(
        "max-w-[9rem] truncate text-[7px] font-normal normal-case tracking-normal",
        muted && "opacity-80",
      )}
    />
  );
}

/** @deprecated use CbrCompactReactionMatrix */
export const CbrRateReactionMatrix = CbrCompactReactionMatrix;
