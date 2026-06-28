"use client";

import type { ScreenerDataStatus } from "@screenerpro/shared";
import { cn } from "@/lib/utils/cn";

type CompactStatus = "live" | "dev-fallback" | "off" | "error" | "stale" | "loading" | "unknown";

function resolveCompactStatus(status?: ScreenerDataStatus | null, isLoading?: boolean): CompactStatus {
  if (isLoading) return "loading";
  if (!status) return "unknown";
  if (status.source === "off" || status.fallbackReason === "data-disabled") return "off";
  if (status.isDemo || status.source === "fallback" || status.source === "demo") return "dev-fallback";
  if (status.staleCache) return "stale";
  if (
    status.source === "moex" &&
    !status.isDemo &&
    status.stockRows === 0 &&
    status.fallbackReason != null
  ) {
    return "error";
  }
  if (status.source === "moex" && !status.isDemo && status.stockRows > 0) return "live";
  return "unknown";
}

const STATUS_LABEL: Record<CompactStatus, string> = {
  live: "LIVE",
  "dev-fallback": "DEV FALLBACK · это не рынок",
  off: "OFF · данные отключены",
  error: "ERROR · MOEX недоступен",
  stale: "КЭШ",
  loading: "…",
  unknown: "—",
};

const STATUS_CLASS: Record<CompactStatus, string> = {
  live: "text-emerald-300/90",
  "dev-fallback": "text-amber-200/90",
  off: "text-slate-400",
  error: "text-rose-300/90",
  stale: "text-cyan-200/80",
  loading: "text-slate-500",
  unknown: "text-slate-500",
};

export function DataQualityCompact({
  status,
  isLoading,
  visibleCount,
  universeCount,
  className,
}: {
  status?: ScreenerDataStatus | null;
  isLoading?: boolean;
  visibleCount?: number;
  universeCount?: number;
  className?: string;
}) {
  const compact = resolveCompactStatus(status, isLoading);
  const showUpdated =
    !isLoading &&
    status &&
    compact !== "off" &&
    compact !== "error" &&
    (compact === "live" || compact === "stale" || compact === "dev-fallback");
  const updatedLabel =
    showUpdated && status
      ? new Date(status.fetchTimestamp || status.generatedAt).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  const parts: string[] = [STATUS_LABEL[compact]];
  if (
    typeof visibleCount === "number" &&
    typeof universeCount === "number" &&
    !isLoading &&
    compact !== "off" &&
    compact !== "error"
  ) {
    parts.push(`${visibleCount} из ${universeCount}`);
  } else if (typeof universeCount === "number" && !isLoading && compact !== "off" && compact !== "error") {
    parts.push(`${universeCount} бумаг`);
  }
  if (updatedLabel) parts.push(updatedLabel);

  return (
    <div className={cn("font-mono text-[10px] tabular-nums", className)}>
      <span className={cn("uppercase tracking-wide", STATUS_CLASS[compact])}>{parts.join(" · ")}</span>
    </div>
  );
}
