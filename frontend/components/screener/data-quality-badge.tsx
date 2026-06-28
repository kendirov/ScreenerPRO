"use client";

import type { ScreenerDataStatus } from "@screenerpro/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

type QualityTone = "live" | "partial" | "warn" | "demo" | "muted" | "error";

const TONE_CLASS: Record<QualityTone, string> = {
  live: "border-emerald-500/35 bg-emerald-950/40 text-emerald-200/95",
  partial: "border-amber-500/35 bg-amber-950/35 text-amber-100/95",
  warn: "border-cyan-500/28 bg-cyan-950/30 text-cyan-100/90",
  demo: "border-amber-500/40 bg-amber-950/45 text-amber-100",
  muted: "border-white/10 bg-slate-900/55 text-slate-400",
  error: "border-rose-500/35 bg-rose-950/40 text-rose-100/95",
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

  const isOff = status.source === "off";
  const isExplicitFallback =
    status.fallbackReason === "explicit-dev-fallback" || status.source === "fallback";
  const isDemo = status.isDemo || status.source === "demo" || isExplicitFallback;
  const isStale = status.staleCache === true;
  const hasRows = status.stockRows + status.futuresRows > 0;
  const isLiveOk = !isDemo && !isOff && !isStale && hasRows && status.source === "moex";
  const isEmptyLiveError =
    !isDemo &&
    !isOff &&
    !isStale &&
    !hasRows &&
    status.fallbackReason != null &&
    status.fallbackReason !== "data-disabled";
  const technical = [
    status.degraded ? "degraded" : null,
    status.baselineStatus !== "ok" ? `baseline: ${status.baselineStatus}` : null,
    status.fallbackReason,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Качество данных">
      {isOff ? (
        <>
          <QualityChip label="данные отключены" tone="muted" title={status.message ?? "MOEX_DATA_MODE=off"} />
          <QualityChip label="off" tone="muted" technical={technical || "source: off"} />
        </>
      ) : isDemo ? (
        <>
          <QualityChip
            label={isExplicitFallback ? "DEV · учебный набор" : "DEMO · учебный набор"}
            tone="demo"
            title={
              isExplicitFallback
                ? "MOEX_DATA_MODE=fallback — не live-рынок"
                : "Резервный учебный набор, не live MOEX"
            }
            technical={technical || `source: ${status.source}`}
          />
        </>
      ) : isStale ? (
        <>
          <QualityChip label="кэш MOEX" tone="partial" title={status.message ?? "Последний успешный live-снимок"} />
          <QualityChip label="не live" tone="warn" title="MOEX временно недоступен" />
        </>
      ) : isEmptyLiveError ? (
        <>
          <QualityChip
            label="ошибка данных"
            tone="error"
            title={status.message ?? "MOEX ISS недоступен"}
            technical={technical}
          />
          <QualityChip label="live недоступен" tone="muted" title="Нет live-строк с биржи" />
        </>
      ) : isLiveOk ? (
        <>
          <QualityChip label="LIVE" tone="live" title="Поток с биржи в реальном времени" />
          <QualityChip label="MOEX ISS" tone="live" title="Источник — Московская биржа" />
        </>
      ) : (
        <QualityChip label="нет данных" tone="muted" title={status.message ?? undefined} technical={technical} />
      )}

      {isLiveOk && status.degraded && status.baselineStatus === "skipped" ? (
        <QualityChip
          label="без исторической базы"
          tone="warn"
          title="Сравнение с прошлыми сессиями недоступно локально"
          technical={technical}
        />
      ) : null}

      {isLiveOk && status.degraded && status.baselineStatus !== "skipped" ? (
        <QualityChip
          label="данные частичные"
          tone="partial"
          title="Часть метрик без полной истории"
          technical={technical}
        />
      ) : null}

      {isLiveOk && !status.degraded && status.baselineStatus !== "ok" ? (
        <QualityChip
          label="данные частичные"
          tone="partial"
          technical={`baseline: ${status.baselineStatus}`}
        />
      ) : null}
    </div>
  );
}
