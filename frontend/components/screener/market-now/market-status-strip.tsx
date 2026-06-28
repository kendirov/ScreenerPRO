"use client";

import type { ScreenerApiResponse, ScreenerDataStatus } from "@screenerpro/shared";
import { DataQualityBadge } from "@/components/screener/data-quality-badge";
import { cn } from "@/lib/utils/cn";

const MARKET_STATUS_LABEL: Record<string, string> = {
  open: "открыт",
  closed: "закрыт",
  halted: "останов",
  auction: "аукцион",
  unknown: "—",
};

export function MarketStatusStrip({
  status,
  diagnostics,
  isLoading,
  visibleCount,
  instrumentLabel = "инструментов",
  className,
}: {
  status?: ScreenerDataStatus | null;
  diagnostics?: ScreenerApiResponse["diagnostics"];
  isLoading?: boolean;
  visibleCount?: number;
  instrumentLabel?: string;
  className?: string;
}) {
  const updatedLabel = status
    ? new Date(status.fetchTimestamp || status.generatedAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const marketStatus = diagnostics?.marketStatus ?? status?.marketStatus ?? null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} aria-label="Статус рыночных данных">
      <DataQualityBadge status={status} isLoading={isLoading} />
      {status?.staleCache ? (
        <span className="lab-status-chip lab-chip-draft text-[9px]">кэш MOEX</span>
      ) : null}
      {updatedLabel ? (
        <span className="font-mono text-[10px] tabular-nums text-lab-text-dim">обновлено {updatedLabel}</span>
      ) : null}
      {marketStatus ? (
        <span className="font-mono text-[10px] text-lab-text-dim">
          рынок {MARKET_STATUS_LABEL[marketStatus] ?? marketStatus}
        </span>
      ) : null}
      {typeof visibleCount === "number" && !isLoading ? (
        <span className="font-mono text-[10px] tabular-nums text-lab-text-dim">
          · {visibleCount} {instrumentLabel}
        </span>
      ) : isLoading ? (
        <span className="font-mono text-[10px] text-lab-text-dim">· загрузка данных…</span>
      ) : null}
      {diagnostics && diagnostics.rowsBeforeFilter > 0 && diagnostics.rowsAfterFilter === 0 ? (
        <span className="text-[10px] text-amber-200/90">фильтр скрыл все</span>
      ) : null}
    </div>
  );
}
