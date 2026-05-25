"use client";

import type { ReactNode } from "react";
import type { LabStatusPill } from "@/components/lab/lab-page-shell";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { formatDataSourceLabel } from "@/lib/domain/screener-overview";
import { cn } from "@/lib/utils/cn";

export const LAB_INSTRUMENT_LIMIT = 60;

export const LAB_EMPTY_DATA_MESSAGE =
  "Нет данных для отображения. Проверьте подключение к MOEX ISS или повторите позже.";

const stateShell = "lab-empty-state rounded-xl";

export function formatLabFreshness(status?: {
  sourceTimestamp?: string | null;
  fetchTimestamp?: string | null;
}): string {
  if (status?.sourceTimestamp) {
    return new Date(status.sourceTimestamp).toLocaleString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (status?.fetchTimestamp) {
    return new Date(status.fetchTimestamp).toLocaleString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "—";
}

export function buildLabSourcePills(
  status?: { source?: string | null; sourceTimestamp?: string | null; fetchTimestamp?: string | null },
  metaLabel?: string,
): LabStatusPill[] {
  const pills: LabStatusPill[] = [
    {
      label: formatDataSourceLabel(
        status?.source === "moex" || status?.source === "demo" ? status.source : undefined,
      ),
      tone: "source",
    },
    { label: `обновлено ${formatLabFreshness(status)}`, tone: "time" },
  ];
  if (metaLabel) pills.push({ label: metaLabel, tone: "meta" });
  return pills;
}

export function LabSectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "mb-2 px-1 text-xs font-medium uppercase tracking-[0.12em] text-lab-text-dim",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function LabLoadingState({ message = "Загрузка данных…" }: { message?: string }) {
  return (
    <LabGlassPanel depth={10} className={cn(stateShell, "min-h-[min(40vh,360px)] border-solid")}>
      <p className="lab-type-caption text-sm">{message}</p>
    </LabGlassPanel>
  );
}

export function LabErrorState({ message }: { message: string }) {
  return (
    <LabGlassPanel
      variant="danger"
      depth={10}
      className={cn(stateShell, "min-h-[min(40vh,360px)] border-solid")}
    >
      <p className="max-w-md text-sm text-lab-red">{message}</p>
    </LabGlassPanel>
  );
}

export function LabEmptyState({
  message = LAB_EMPTY_DATA_MESSAGE,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn(stateShell, className)}>
      <p className="max-w-md text-sm leading-relaxed text-lab-text-muted">{message}</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-lab-violet/70">нет данных</p>
    </div>
  );
}
