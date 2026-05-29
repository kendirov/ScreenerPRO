"use client";

import type { ScreenerDataStatus } from "@screenerpro/shared";
import { cn } from "@/lib/utils/cn";

function Chip({
  label,
  tone,
  title,
}: {
  label: string;
  tone: "live" | "demo" | "warn" | "muted";
  title?: string;
}) {
  const toneClass =
    tone === "live"
      ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.12)]"
      : tone === "demo"
        ? "border-amber-400/45 bg-amber-500/18 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.18)]"
        : tone === "warn"
          ? "border-cyan-500/30 bg-cyan-950/30 text-cyan-200/90"
          : "border-lab-border-soft/60 bg-lab-surface-1/40 text-lab-text-dim";

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        toneClass,
      )}
    >
      {label}
    </span>
  );
}

/** Compact production guard: visible MOEX vs DEMO and baseline/degraded state. */
export function ScreenerDataSourceStrip({
  status,
  isLoading,
  visibleCount,
}: {
  status?: ScreenerDataStatus | null;
  isLoading?: boolean;
  visibleCount?: number;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
        <Chip label="загрузка…" tone="muted" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip label="нет статуса" tone="muted" title="API не вернул status" />
      </div>
    );
  }

  const isDemo = status.isDemo || status.source === "demo";
  const updatedLabel = new Date(status.generatedAt || status.fetchTimestamp).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Источник рыночных данных">
      {isDemo ? (
        <Chip label="DEMO DATA" tone="demo" title="Резервные данные — не реальный рынок MOEX" />
      ) : (
        <>
          <Chip label="MOEX ISS" tone="live" title="Живые котировки с Московской биржи" />
          <Chip label="LIVE" tone="live" />
        </>
      )}

      {status.degraded ? (
        <Chip
          label="degraded"
          tone="warn"
          title={`baseline: ${status.baselineStatus} — часть метрик без локальной истории`}
        />
      ) : null}

      {!isDemo && status.baselineStatus !== "ok" ? (
        <Chip label={`baseline ${status.baselineStatus}`} tone="muted" />
      ) : null}

      <span className="font-mono text-[10px] tabular-nums text-lab-text-dim" title="Время ответа API">
        {updatedLabel}
      </span>

      {typeof visibleCount === "number" ? (
        <span className="font-mono text-[10px] tabular-nums text-lab-text-dim">· {visibleCount} в таблице</span>
      ) : null}

      {status.stockRows > 0 && status.stockRows <= 5 && !isDemo ? (
        <Chip
          label={`всего ${status.stockRows} в API`}
          tone="warn"
          title="Подозрительно мало бумаг — проверьте /api/screener/health"
        />
      ) : null}
    </div>
  );
}
