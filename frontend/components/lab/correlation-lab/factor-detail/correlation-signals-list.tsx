"use client";

import * as React from "react";
import type { CorrelationDataStatus, CorrelationSignal } from "@/lib/domain/correlation-api";
import type { CorrelationFactorTheme } from "@/lib/domain/correlation-api-display";
import {
  CORRELATION_KIND_LABELS,
  CORRELATION_KIND_REASON,
  pickBeta,
  pickCorr,
  type CorrelationWindowMode,
} from "@/lib/domain/correlation-factor-detail-display";
import { formatBetaCompact, formatCorrelationCompact } from "@/lib/domain/correlation-lab";
import { MetricTooltip, MetricTooltipPanel, MetricTooltipRow } from "@/components/ui/metrics-minimalism";
import { cn } from "@/lib/utils/cn";

export function CorrelationSignalsList({
  signals,
  windowMode,
  theme,
  dataStatus,
  selectedTicker,
  onSelectTicker,
}: {
  signals: CorrelationSignal[];
  windowMode: CorrelationWindowMode;
  theme: CorrelationFactorTheme;
  dataStatus: CorrelationDataStatus;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
}) {
  if (!signals.length) {
    return (
      <p className="py-8 text-center text-sm text-lab-muted">Нет инструментов с достаточной историей</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[11px]">
        <thead>
          <tr className="border-b border-lab-border-soft/30 text-[10px] uppercase tracking-wide text-lab-text-dim">
            <th className="pb-1.5 pr-2 font-medium">Тикер</th>
            <th className="pb-1.5 pr-2 font-medium">Связь</th>
            <th className="pb-1.5 pr-2 text-right font-medium">beta</th>
            <th className="pb-1.5 pr-2 text-right font-medium">разрыв</th>
            <th className="pb-1.5 text-right font-medium">действие</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <SignalRow
              key={signal.ticker}
              signal={signal}
              windowMode={windowMode}
              theme={theme}
              dataStatus={dataStatus}
              selected={selectedTicker === signal.ticker}
              onSelect={() => onSelectTicker(signal.ticker)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignalRow({
  signal,
  windowMode,
  theme,
  dataStatus,
  selected,
  onSelect,
}: {
  signal: CorrelationSignal;
  windowMode: CorrelationWindowMode;
  theme: CorrelationFactorTheme;
  dataStatus: CorrelationDataStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  const corr = pickCorr(signal, windowMode);
  const beta = pickBeta(signal, windowMode);

  return (
    <tr
      className={cn(
        "border-b border-lab-border-soft/15 transition hover:bg-white/[0.02]",
        selected && "bg-lab-cyan/[0.04]",
      )}
    >
      <td className="py-1.5 pr-2">
        <MetricTooltip
          trigger={<span className={cn("cursor-help font-semibold", theme.accent)}>{signal.ticker}</span>}
          title={signal.ticker}
        >
          <MetricTooltipPanel>
            <MetricTooltipRow label="corr20" value={formatCorrelationCompact(signal.corr20)} />
            <MetricTooltipRow label="corr60" value={formatCorrelationCompact(signal.corr60)} />
            <MetricTooltipRow label="corr120" value={formatCorrelationCompact(signal.corr120)} />
            <MetricTooltipRow label="свечей" value={signal.candleCount > 0 ? String(signal.candleCount) : "—"} />
            <MetricTooltipRow label="статус" value={dataStatus} />
            <MetricTooltipRow label="почему" value={CORRELATION_KIND_REASON[signal.kind]} />
          </MetricTooltipPanel>
        </MetricTooltip>
      </td>
      <td className="py-1.5 pr-2">
        <span className="font-mono tabular-nums">{formatCorrelationCompact(corr)}</span>
        <span className="ml-1.5 text-[9px] uppercase text-lab-text-dim">{CORRELATION_KIND_LABELS[signal.kind]}</span>
      </td>
      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatBetaCompact(beta)}</td>
      <td className="py-1.5 pr-2 text-right font-mono tabular-nums">{formatBetaCompact(signal.breakScore)}</td>
      <td className="py-1.5 text-right">
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide transition",
            selected ? theme.chip : "border-lab-border-soft/50 text-lab-muted hover:text-lab-text",
          )}
        >
          {selected ? "открыто" : "смотреть"}
        </button>
      </td>
    </tr>
  );
}
