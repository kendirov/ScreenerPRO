"use client";

import { Database } from "lucide-react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import {
  PREPARATION_SOURCE_STATUS_LABELS,
  PREPARATION_SOURCE_TYPE_LABELS,
  sourcesWithMoexStatus,
  type PreparationSource,
  type PreparationSourceStatus,
} from "@/lib/domain/preparation-sources";
import { summarizePreparationCandlesDiagnostics } from "@/lib/domain/market-data-status";
import type { PreparationCandlesResponse, ResolvedPreparationInstrument } from "@/lib/domain/preparation-watchlist";
import { cn } from "@/lib/utils/cn";

const STATUS_CLASS: Record<PreparationSourceStatus, string> = {
  connected: "lab-chip-live",
  manual: "border-lab-cyan/30 bg-lab-cyan/8 text-lab-cyan",
  planned: "border-lab-violet/30 bg-lab-violet/8 text-lab-violet",
  disabled: "border-lab-border text-lab-dim bg-lab-surface-2/40",
  experimental: "border-lab-amber/35 bg-lab-amber/10 text-lab-amber",
};

export function PreparationSourcePanel({
  isLiveMoex,
  candlesResponse,
  candlesLoading,
  watchlist = [],
  className,
}: {
  isLiveMoex: boolean;
  candlesResponse?: PreparationCandlesResponse;
  candlesLoading?: boolean;
  watchlist?: ResolvedPreparationInstrument[];
  className?: string;
}) {
  const sources = sourcesWithMoexStatus(isLiveMoex);
  const candlesDiagnostics = summarizePreparationCandlesDiagnostics(
    candlesResponse,
    watchlist,
    candlesLoading,
  );

  return (
    <section className={cn("lab-glass-panel relative overflow-hidden p-3", className)}>
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-30" aria-hidden />
      <LabSectionHeading className="mb-1 flex items-center gap-1.5 text-lab-cyan/90">
        <Database className="h-3.5 w-3.5" />
        Источники
      </LabSectionHeading>
      <p className="text-[11px] text-lab-muted">
        Реестр календарей и обзоров. Автопарсинг сайтов и Telegram не подключаем — только ручной
        перенос.
      </p>

      <div className="mt-2 rounded-md border border-lab-cyan/20 bg-lab-cyan/5 px-2.5 py-2">
        <p className="font-mono text-[10px] leading-relaxed text-lab-muted">
          {candlesLoading ? "MOEX ISS: загрузка свечей…" : candlesDiagnostics.summaryLine}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        {sources.map((source) => (
          <SourceRow key={source.id} source={source} />
        ))}
      </div>
    </section>
  );
}

function SourceRow({ source }: { source: PreparationSource }) {
  return (
    <div className="lab-glass-card border border-lab-border/70 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-lab-text">{source.title}</p>
          <p className="mt-0.5 text-[10px] text-lab-dim">
            {PREPARATION_SOURCE_TYPE_LABELS[source.type]}
            {source.url ? (
              <>
                {" · "}
                <span className="font-mono">{source.url.replace(/^https?:\/\//, "")}</span>
              </>
            ) : null}
          </p>
        </div>
        <span className={cn("lab-status-chip px-1.5 py-px text-[9px]", STATUS_CLASS[source.status])}>
          {PREPARATION_SOURCE_STATUS_LABELS[source.status]}
        </span>
      </div>

      <dl className="mt-2 grid gap-1.5 text-[10px]">
        <div>
          <dt className="text-lab-dim">Что даёт</dt>
          <dd className="text-lab-muted">{source.provides}</dd>
        </div>
        <div>
          <dt className="text-lab-dim">Ограничение</dt>
          <dd className="text-lab-muted">{source.limitation}</dd>
        </div>
      </dl>
    </div>
  );
}
