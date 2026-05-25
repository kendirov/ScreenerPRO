import Link from "next/link";
import { ArrowUpRight, Percent, PlusCircle } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { useWeeklyInflationBrief } from "@/lib/hooks/use-weekly-inflation-brief";
import { cn } from "@/lib/utils/cn";

export function PreparationInflationLabCard({ className }: { className?: string }) {
  const brief = useWeeklyInflationBrief();

  return (
    <LabGlassPanel depth={10} variant="hot" className={cn("relative overflow-hidden px-3 py-2.5", className)}>
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-40" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Percent className="h-3.5 w-3.5 text-lab-violet" />
            <p className="text-sm font-semibold text-lab-text">Недельная инфляция</p>
            <span className="lab-chip lab-chip-lab px-1.5 py-px text-[8px]">LAB</span>
          </div>

          {!brief.hasData ? (
            <p className="mt-2 text-[11px] text-lab-amber">данные не загружены</p>
          ) : (
            <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Последняя неделя" value={brief.headlineLabel} hint={brief.periodLabel} />
              <Metric label="4w avg" value={brief.avg4wLabel} />
              <Metric label="Annualized 4w" value={brief.annualized4wLabel} />
              <Metric label="Режим" value={brief.regimeLabel} accent />
            </dl>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          {!brief.hasData ? (
            <Link
              href="/lab/weekly-inflation"
              className="inline-flex items-center gap-1 rounded-lg border border-lab-amber/35 bg-lab-amber/10 px-2.5 py-1.5 text-[11px] text-lab-text hover:bg-lab-amber/15"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Добавить данные
            </Link>
          ) : null}
          <Link
            href="/lab/weekly-inflation"
            className="inline-flex items-center gap-1 rounded-lg border border-lab-violet/30 bg-lab-violet/10 px-2.5 py-1.5 text-[11px] text-lab-text hover:bg-lab-violet/15"
          >
            {brief.hasData ? "Открыть" : "Лаборатория"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </LabGlassPanel>
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
      <dt className="text-[9px] uppercase tracking-[0.1em] text-lab-dim">{label}</dt>
      <dd className={cn("lab-number mt-0.5 text-sm font-semibold", accent ? "text-lab-violet" : "text-lab-text")}>
        {value}
      </dd>
      {hint ? <dd className="mt-0.5 text-[9px] text-lab-muted">{hint}</dd> : null}
    </div>
  );
}
