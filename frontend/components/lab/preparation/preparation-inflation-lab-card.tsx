"use client";

import Link from "next/link";
import { ArrowUpRight, Percent } from "lucide-react";
import { useWeeklyInflationBrief } from "@/lib/hooks/use-weekly-inflation-brief";
import { cn } from "@/lib/utils/cn";

export function PreparationInflationLabCard({ className }: { className?: string }) {
  const brief = useWeeklyInflationBrief();

  return (
    <div
      className={cn(
        "lab-glass-card relative overflow-hidden border border-lab-violet/25 px-3 py-3 shadow-[var(--lab-glow-violet)]",
        className,
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-lab-violet/60 via-lab-violet/20 to-transparent"
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-lab-violet" />
            <p className="text-sm font-medium text-lab-text">Недельная инфляция</p>
          </div>

          {!brief.hasData ? (
            <p className="mt-3 text-[11px] text-lab-amber">данные не загружены</p>
          ) : (
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Последняя неделя" value={brief.headlineLabel} hint={brief.periodLabel} />
              <Metric label="4w avg" value={brief.avg4wLabel} />
              <Metric label="Annualized 4w" value={brief.annualized4wLabel} />
              <Metric label="Режим" value={brief.regimeLabel} accent />
            </dl>
          )}
        </div>

        <Link
          href="/lab/weekly-inflation"
          className="inline-flex items-center gap-1.5 rounded-lg border border-lab-violet/30 bg-lab-violet/10 px-3 py-1.5 text-sm text-lab-text hover:bg-lab-violet/15"
        >
          Открыть лабораторию
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string | null;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.1em] text-lab-dim">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          accent ? "text-lab-violet" : "text-lab-text",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="mt-0.5 text-[10px] text-lab-muted">{hint}</dd> : null}
    </div>
  );
}
