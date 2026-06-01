"use client";

import type { ScreenerDataStatus } from "@screenerpro/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

type QualityTone = "live" | "partial" | "warn" | "demo" | "muted";

const TONE_CLASS: Record<QualityTone, string> = {
  live: "border-emerald-500/35 bg-emerald-950/40 text-emerald-200/95",
  partial: "border-amber-500/35 bg-amber-950/35 text-amber-100/95",
  warn: "border-cyan-500/28 bg-cyan-950/30 text-cyan-100/90",
  demo: "border-amber-500/40 bg-amber-950/45 text-amber-100",
  muted: "border-white/10 bg-slate-900/55 text-slate-400",
};

function QualityChip({
  label,
  tone,
  title,
  technical,
}: {
  label: string;
  tone: QualityTone;
  title?: string;
  technical?: string;
}) {
  const chip = (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );

  if (!technical) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[240px] font-mono text-[10px] text-lab-text-dim">
        {technical}
      </TooltipContent>
    </Tooltip>
  );
}

/** Человекочитаемый статус качества данных вместо degraded / baseline skipped. */
export function DataQualityBadge({
  status,
  isLoading,
  className,
}: {
  status?: ScreenerDataStatus | null;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <QualityChip label="загрузка…" tone="muted" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <QualityChip label="нет статуса" tone="muted" technical="API не вернул status" />
      </div>
    );
  }

  const isDemo = status.isDemo || status.source === "demo";
  const technical = [
    status.degraded ? "degraded" : null,
    status.baselineStatus !== "ok" ? `baseline: ${status.baselineStatus}` : null,
    status.fallbackReason,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Качество данных">
      {isDemo ? (
        <QualityChip
          label="резервные данные"
          tone="demo"
          title="Не реальный рынок MOEX"
          technical={technical || "source: demo"}
        />
      ) : (
        <>
          <QualityChip label="LIVE" tone="live" title="Поток с биржи в реальном времени" />
          <QualityChip label="MOEX ISS" tone="live" title="Источник — Московская биржа" />
        </>
      )}

      {!isDemo && status.degraded && status.baselineStatus === "skipped" ? (
        <QualityChip
          label="без исторической базы"
          tone="warn"
          title="Сравнение с прошлыми сессиями недоступно локально"
          technical={technical}
        />
      ) : null}

      {!isDemo && status.degraded && status.baselineStatus !== "skipped" ? (
        <QualityChip
          label="данные частичные"
          tone="partial"
          title="Часть метрик без полной истории"
          technical={technical}
        />
      ) : null}

      {!isDemo && !status.degraded && status.baselineStatus !== "ok" ? (
        <QualityChip
          label="данные частичные"
          tone="partial"
          technical={`baseline: ${status.baselineStatus}`}
        />
      ) : null}
    </div>
  );
}
