"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import {
  HistoryCaption,
  RealSparkline,
  SignalAura,
  hasRealSparklineHistory,
  inferToneFromChange,
} from "@/components/screener/mini-sparkline";
import { cn } from "@/lib/utils/cn";

export function InstrumentCardVisual({
  row,
  sparklineValues,
  variant = "backdrop",
  showCaption = true,
  captionClassName,
}: {
  row: ScreenerRow;
  sparklineValues?: number[] | null;
  variant?: "inline" | "backdrop";
  showCaption?: boolean;
  captionClassName?: string;
}) {
  const hasHistory = hasRealSparklineHistory(sparklineValues);

  return (
    <>
      {hasHistory ? (
        <RealSparkline
          variant={variant}
          values={sparklineValues}
          tone={inferToneFromChange(row.percentChange)}
        />
      ) : (
        <SignalAura
          variant={variant}
          metrics={{
            changePct: row.percentChange,
            turnover: row.turnover,
            tradesCount: row.tradesCount,
            rangePct: row.metrics.dayRangePct,
            seed: row.ticker,
          }}
          tone={inferToneFromChange(row.percentChange)}
        />
      )}
      {showCaption ? (
        <HistoryCaption hasHistory={hasHistory} className={cn("absolute right-3 top-3 z-10", captionClassName)} />
      ) : null}
    </>
  );
}
