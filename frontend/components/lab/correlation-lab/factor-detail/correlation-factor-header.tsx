"use client";

import { StatusChip } from "@/components/ui/metrics-minimalism";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { CorrelationApiFactorId, CorrelationApiInterval, CorrelationApiPeriod, CorrelationDataStatus } from "@/lib/domain/correlation-api";
import {
  CORRELATION_DATA_STATUS_UI,
  type CorrelationFactorTheme,
  formatUpdatedAt,
} from "@/lib/domain/correlation-api-display";
import { formatFactorProxyFromMeta, formatIntervalLabel, formatPeriodLabel } from "@/lib/domain/correlation-factor-detail-display";
import { cn } from "@/lib/utils/cn";

export function CorrelationFactorHeader({
  title,
  meaning,
  theme,
  factorId,
  proxyTicker,
  period,
  interval,
  updatedAt,
  dataStatus,
}: {
  title: string;
  meaning: string;
  theme: CorrelationFactorTheme;
  factorId: CorrelationApiFactorId;
  proxyTicker: string | null;
  period: CorrelationApiPeriod;
  interval: CorrelationApiInterval;
  updatedAt: string | null;
  dataStatus: CorrelationDataStatus;
}) {
  const statusUi = CORRELATION_DATA_STATUS_UI[dataStatus];

  return (
    <LabGlassPanel depth={20} className={cn("relative overflow-hidden p-4", theme.border, theme.bg)}>
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-90", theme.line)} aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={cn("text-xl font-semibold tracking-tight", theme.accent)}>{title}</h1>
            <span className="lab-status-chip lab-chip-lab px-1.5 py-0.5 text-[9px]">LAB</span>
            <span className="lab-status-chip lab-chip-dev px-1.5 py-0.5 text-[9px]">ЧЕРН.</span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-lab-muted">{meaning}</p>
          <p className="mt-2 font-mono text-[11px] text-lab-text-dim">
            {formatFactorProxyFromMeta(factorId, proxyTicker)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <StatusChip label={statusUi.label} tone={statusUi.tone} className="text-[9px] uppercase" />
          <p className="font-mono text-[10px] text-lab-text-dim">
            {formatPeriodLabel(period)} · {formatIntervalLabel(interval)} · доходности
          </p>
          {updatedAt ? (
            <p className="font-mono text-[10px] text-lab-text-dim">обновлено {formatUpdatedAt(updatedAt)}</p>
          ) : null}
        </div>
      </div>
    </LabGlassPanel>
  );
}
