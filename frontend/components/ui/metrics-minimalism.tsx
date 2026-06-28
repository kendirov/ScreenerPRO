"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDataSourceLabel } from "@/lib/domain/screener-overview";
import { cn } from "@/lib/utils/cn";

/** Поле считается «пустым» для UI — не показываем 0 на поверхности. */
export function hasMetricValue(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value > 0;
}

export function metricDisplayOrDash(value: number | null | undefined, format: (v: number) => string): string {
  if (!hasMetricValue(value) && value !== 0) return "—";
  if (value === 0) return "—";
  return format(value!);
}

export type StatusChipTone = "live" | "warn" | "muted" | "meta" | "cyan" | "amber" | "rose" | "neutral";

const STATUS_CHIP_TONE: Record<StatusChipTone, string> = {
  live: "lab-chip-live",
  warn: "border-lab-amber/40 bg-lab-amber/8 text-lab-amber",
  muted: "lab-chip-dev text-lab-muted",
  meta: "lab-chip-dev",
  cyan: "border-cyan-700/35 bg-cyan-950/25 text-cyan-200/90",
  amber: "border-amber-700/35 bg-amber-950/28 text-amber-200/90",
  rose: "border-rose-800/35 bg-rose-950/28 text-rose-200/90",
  neutral: "border-slate-700/45 bg-slate-900/40 text-slate-300/85",
};

export function StatusChip({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: StatusChipTone;
  className?: string;
}) {
  return (
    <span className={cn("lab-status-chip shrink-0 px-1.5 py-0.5 text-[10px]", STATUS_CHIP_TONE[tone], className)}>
      {label}
    </span>
  );
}

export type DataStatusKind = "live" | "partial" | "fallback" | "loading" | "no-data";

const DATA_STATUS_LABEL: Record<DataStatusKind, string> = {
  live: "MOEX ISS",
  partial: "частично",
  fallback: "резерв",
  loading: "загрузка…",
  "no-data": "нет данных",
};

const DATA_STATUS_TONE: Record<DataStatusKind, StatusChipTone> = {
  live: "live",
  partial: "warn",
  fallback: "warn",
  loading: "muted",
  "no-data": "muted",
};

export function DataStatusBadge({
  kind,
  label,
  className,
}: {
  kind: DataStatusKind;
  label?: string;
  className?: string;
}) {
  return <StatusChip label={label ?? DATA_STATUS_LABEL[kind]} tone={DATA_STATUS_TONE[kind]} className={className} />;
}

/** Маппинг source из `/api/screener` → badge. */
export function screenerSourceToDataStatus(
  source: string | undefined,
  options?: { isLoading?: boolean; fallbackReason?: string | null; degraded?: boolean; isDemo?: boolean },
): { kind: DataStatusKind; label: string } {
  if (options?.isLoading) return { kind: "loading", label: "загрузка…" };
  if (source === "moex") {
    if (options?.degraded) return { kind: "partial", label: "MOEX ISS · без baseline" };
    return { kind: "live", label: formatDataSourceLabel("moex") };
  }
  if (source === "off") return { kind: "no-data", label: "данные отключены" };
  if (source === "fallback" || source === "demo" || options?.isDemo) {
    return {
      kind: "fallback",
      label: options?.fallbackReason === "explicit-dev-fallback" ? "DEV · учебный набор" : "резервные данные",
    };
  }
  return { kind: "no-data", label: "нет данных" };
}

export function MetricTooltipRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <dt className="text-lab-text-dim">{label}</dt>
      <dd className="lab-number text-right text-lab-text-main">{value}</dd>
    </div>
  );
}

export function MetricTooltipPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5 p-2.5", className)}>
      {title ? <p className="text-xs font-semibold text-lab-text-main">{title}</p> : null}
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

export function MetricTooltip({
  trigger,
  title,
  children,
  side = "bottom",
}: {
  trigger: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-[15rem]">
        <MetricTooltipPanel title={title}>{children}</MetricTooltipPanel>
      </TooltipContent>
    </Tooltip>
  );
}

export function CompactMetric({
  value,
  detail,
  className,
  valueClassName,
}: {
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  const surface = (
    <span className={cn("lab-number font-mono tabular-nums text-[12px] text-lab-text-main", valueClassName, className)}>
      {value}
    </span>
  );

  if (!detail) return surface;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block cursor-default text-right transition hover:text-lab-cyan/90">{surface}</span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="max-w-[14rem] border-lab-border bg-lab-bg-deep/95 px-2.5 py-2 text-[11px] text-lab-text-main"
      >
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}
