"use client";

import type { ReactNode } from "react";
import type { LabStatusPill } from "@/components/lab/lab-page-shell";
import { formatDataSourceLabel } from "@/lib/domain/screener-overview";
import { cn } from "@/lib/utils/cn";

export const LAB_INSTRUMENT_LIMIT = 60;

export const LAB_EMPTY_DATA_MESSAGE =
  "Нет данных для отображения. Проверьте подключение к MOEX ISS или повторите позже.";

const stateShell =
  "rounded-xl border border-dashed border-white/[0.08] bg-slate-950/45 px-6 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm";

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
        "mb-2 px-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-600",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function LabLoadingState({ message = "Загрузка данных…" }: { message?: string }) {
  return (
    <div className={cn(stateShell, "min-h-[min(40vh,360px)] flex items-center justify-center")}>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function LabErrorState({ message }: { message: string }) {
  return (
    <div
      className={cn(
        stateShell,
        "min-h-[min(40vh,360px)] flex items-center justify-center border-rose-500/20 bg-rose-950/20",
      )}
    >
      <p className="max-w-md text-sm text-rose-300/90">{message}</p>
    </div>
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
    <div
      className={cn(
        stateShell,
        "min-h-[min(52vh,420px)] flex flex-col items-center justify-center",
        className,
      )}
    >
      <p className="max-w-md text-sm leading-relaxed text-slate-500">{message}</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-violet-400/45">нет данных</p>
    </div>
  );
}
