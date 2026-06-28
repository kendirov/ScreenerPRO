"use client";

import type { PreparationDataQualityStatus } from "@/lib/preparation/preparation-types";
import { cn } from "@/lib/utils/cn";

const STATUS_LABEL: Record<PreparationDataQualityStatus, string> = {
  live: "LIVE",
  partial: "PARTIAL",
  degraded: "DEGRADED",
  manual: "MANUAL",
  error: "ERROR",
  loading: "…",
};

const STATUS_CLASS: Record<PreparationDataQualityStatus, string> = {
  live: "text-emerald-300/90",
  partial: "text-cyan-200/85",
  degraded: "text-amber-200/90",
  manual: "text-violet-300/85",
  error: "text-rose-300/90",
  loading: "text-slate-500",
};

export function PreparationDataQuality({
  status,
  updatedAt,
  sourceCount,
  className,
}: {
  status: PreparationDataQualityStatus;
  updatedAt?: string;
  sourceCount?: number;
  className?: string;
}) {
  const parts = [STATUS_LABEL[status]];
  if (typeof sourceCount === "number") parts.push(`${sourceCount} src`);
  if (updatedAt && status !== "loading" && status !== "error") {
    parts.push(
      new Date(updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    );
  }

  return (
    <div className={cn("font-mono text-[10px] tabular-nums uppercase tracking-wide", className)}>
      <span className={STATUS_CLASS[status]}>{parts.join(" · ")}</span>
    </div>
  );
}
