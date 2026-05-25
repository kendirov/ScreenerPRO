"use client";

import type { ScreenerApiResponse } from "@screenerpro/shared";
import { formatDataSourceLabel } from "@/lib/domain/screener-overview";
import { formatLabFreshness } from "@/components/lab/lab-ui";
import { cn } from "@/lib/utils/cn";

export function PreparationSourceStatus({
  screenerData,
  isLoading,
  isError,
  smartLabStatus,
  className,
}: {
  screenerData?: ScreenerApiResponse;
  isLoading?: boolean;
  isError?: boolean;
  smartLabStatus?: "ok" | "empty" | "error" | "loading";
  className?: string;
}) {
  const source = screenerData?.status?.source;
  const isLiveMoex = source === "moex";

  const smartLabLabel =
    smartLabStatus === "loading"
      ? "Smart-Lab · загрузка…"
      : smartLabStatus === "ok"
        ? "Smart-Lab · эксперимент"
        : smartLabStatus === "empty" || smartLabStatus === "error"
          ? "Smart-Lab · ручной режим"
          : "Smart-Lab · не проверен";

  return (
    <div
      className={cn(
        "lab-glass-card flex flex-wrap items-center gap-2 border border-lab-border/80 px-3 py-2",
        className,
      )}
    >
      <span className="lab-type-caption text-[10px] uppercase tracking-[0.14em] text-lab-dim">Источник</span>

      <StatusChip
        label={isLoading ? "MOEX ISS · загрузка…" : formatDataSourceLabel(isLiveMoex ? "moex" : source)}
        tone={isLiveMoex ? "live" : isError ? "warn" : "muted"}
      />
      <StatusChip
        label={smartLabLabel}
        tone={smartLabStatus === "ok" ? "live" : smartLabStatus === "loading" ? "muted" : "warn"}
      />
      <StatusChip label="Новости · вручную" tone="meta" />
      <StatusChip label="Окно · 5 дней" tone="meta" />

      {screenerData?.status ? (
        <span className="ml-auto font-mono text-[10px] text-lab-dim">
          обновлено {formatLabFreshness(screenerData.status)}
        </span>
      ) : null}
    </div>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "live" | "warn" | "muted" | "meta";
}) {
  const toneClass = {
    live: "lab-chip-live",
    warn: "border-lab-amber/40 bg-lab-amber/8 text-lab-amber",
    muted: "lab-chip-dev text-lab-muted",
    meta: "lab-chip-dev",
  }[tone];

  return (
    <span className={cn("lab-status-chip px-2 py-0.5 text-[10px]", toneClass)}>
      {label}
    </span>
  );
}
