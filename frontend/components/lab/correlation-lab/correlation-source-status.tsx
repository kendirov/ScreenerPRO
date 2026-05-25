"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import type { CorrelationLabSourcesResponse, CorrelationSourceAdapter } from "@/lib/domain/correlation-lab";
import { useCorrelationLabSources } from "@/lib/hooks/use-correlation-lab";
import { cn } from "@/lib/utils/cn";

const ROLE_LABELS = {
  candles: "свечи",
  correlations: "корреляции",
  reference: "справочник",
  external: "внешний",
} as const;

const STATUS_LABELS = {
  connected: "подключён",
  experimental: "эксперимент",
  planned: "в плане",
  unavailable: "недоступен",
} as const;

export function CorrelationSourceStatus({ embedded = false }: { embedded?: boolean }) {
  const query = useCorrelationLabSources();

  return (
    <div className={cn(embedded ? "space-y-3 px-1 py-2" : "lab-glass-panel p-4")}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <LabSectionHeading className="mb-0">Источники данных</LabSectionHeading>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="inline-flex items-center gap-1 rounded-lg border border-lab-border px-2 py-1 text-[11px] text-lab-muted hover:text-lab-text"
        >
          {query.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          обновить
        </button>
      </div>

      {query.data?.warnings?.length ? (
        <ul className="space-y-1 rounded-xl border border-lab-amber/20 bg-lab-amber/5 px-3 py-2 text-[11px] text-lab-muted">
          {query.data.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-2 lg:grid-cols-2">
        {(query.data?.adapters ?? []).map((adapter) => (
          <AdapterCard key={adapter.id} adapter={adapter} />
        ))}
      </div>

      {!query.data && query.isLoading ? (
        <p className="text-sm text-lab-text-dim">Загрузка статуса источников…</p>
      ) : null}
    </div>
  );
}

function AdapterCard({ adapter }: { adapter: CorrelationSourceAdapter }) {
  const tone = resolveTone(adapter.status);

  return (
    <div className={cn("rounded-xl border px-3 py-3", tone.border, tone.bg)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-lab-text-main">{adapter.title}</p>
        <div className="flex gap-1">
          <span className={cn("lab-chip px-2 py-0.5 text-[10px]", tone.chip)}>{STATUS_LABELS[adapter.status]}</span>
          <span className="lab-chip px-2 py-0.5 text-[10px] text-lab-muted">{ROLE_LABELS[adapter.role]}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-lab-muted">{adapter.description}</p>
      <p className="mt-1.5 text-[10px] text-lab-text-dim">Ограничение: {adapter.limitation}</p>
    </div>
  );
}

function resolveTone(status: CorrelationSourceAdapter["status"]) {
  switch (status) {
    case "connected":
      return {
        border: "border-lab-cyan/25",
        bg: "bg-lab-cyan/5",
        chip: "border-lab-cyan/30 bg-lab-cyan/10 text-lab-cyan",
      };
    case "experimental":
      return {
        border: "border-lab-amber/25",
        bg: "bg-lab-amber/5",
        chip: "border-lab-amber/30 bg-lab-amber/10 text-lab-amber",
      };
    case "planned":
      return {
        border: "border-lab-violet/20",
        bg: "bg-lab-violet/5",
        chip: "border-lab-violet/25 text-lab-violet",
      };
    default:
      return {
        border: "border-lab-border",
        bg: "bg-lab-bg-deep/30",
        chip: "text-lab-muted",
      };
  }
}

export type { CorrelationLabSourcesResponse };
