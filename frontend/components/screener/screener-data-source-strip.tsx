"use client";

import type { ScreenerDataStatus } from "@screenerpro/shared";
import { DataQualityBadge } from "@/components/screener/data-quality-badge";
import { cn } from "@/lib/utils/cn";

/** Compact production guard: human-readable data quality + update time. */
export function ScreenerDataSourceStrip({
  status,
  isLoading,
  visibleCount,
}: {
  status?: ScreenerDataStatus | null;
  isLoading?: boolean;
  visibleCount?: number;
}) {
  const updatedLabel = status
    ? new Date(status.generatedAt || status.fetchTimestamp).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2")} aria-label="Источник рыночных данных">
      <DataQualityBadge status={status} isLoading={isLoading} />

      {updatedLabel ? (
        <span className="font-mono text-[10px] tabular-nums text-lab-text-dim" title="Время ответа API">
          {updatedLabel}
        </span>
      ) : null}

      {typeof visibleCount === "number" ? (
        <span className="font-mono text-[10px] tabular-nums text-lab-text-dim">· {visibleCount} в таблице</span>
      ) : null}

      {status && status.stockRows > 0 && status.stockRows <= 5 && !status.isDemo && status.source !== "demo" ? (
        <span
          className="rounded-md border border-amber-500/35 bg-amber-950/35 px-2 py-0.5 text-[10px] text-amber-100/95"
          title="Подозрительно мало бумаг — проверьте /api/screener/health"
        >
          мало бумаг в API
        </span>
      ) : null}
    </div>
  );
}
