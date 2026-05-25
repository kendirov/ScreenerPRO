"use client";

import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { CorrelationOverviewResponse } from "@/lib/domain/correlation-api";
import { buildOverviewKpis } from "@/lib/domain/correlation-api-display";
import { cn } from "@/lib/utils/cn";

export function CorrelationKpiStrip({
  overview,
  className,
}: {
  overview: CorrelationOverviewResponse;
  className?: string;
}) {
  const kpis = buildOverviewKpis(overview);

  return (
    <LabGlassPanel depth={10} className={cn("p-3", className)}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          title="Факторов активно"
          value={kpis.activeFactors > 0 ? String(kpis.activeFactors) : "—"}
          caption={kpis.activeFactors > 0 ? "из 6 факторных линз" : "ждём свечи MOEX"}
          tone="cyan"
        />
        <KpiTile
          title="Инструментов проверено"
          value={kpis.instrumentsAnalyzed > 0 ? String(kpis.instrumentsAnalyzed) : "—"}
          caption={kpis.instrumentsAnalyzed > 0 ? "топ по ликвидности TQBR" : "скринер пуст"}
          tone="violet"
        />
        <KpiTile
          title="Сильных связей"
          value={kpis.strongLinks > 0 ? String(kpis.strongLinks) : "—"}
          caption={kpis.strongLinks > 0 ? "corr60 выше порога" : "связей не выделено"}
          tone="green"
        />
        <KpiTile
          title="Разрывов связи"
          value={kpis.breaks > 0 ? String(kpis.breaks) : "—"}
          caption={kpis.breaks > 0 ? "corr20 vs corr60 расходятся" : "разрывов нет"}
          tone="amber"
        />
      </div>
    </LabGlassPanel>
  );
}

function KpiTile({
  title,
  value,
  caption,
  tone,
}: {
  title: string;
  value: string;
  caption: string;
  tone: "cyan" | "violet" | "green" | "amber";
}) {
  const border = {
    cyan: "border-lab-cyan/25",
    violet: "border-lab-violet/25",
    green: "border-lab-green/25",
    amber: "border-lab-amber/25",
  }[tone];

  const line = {
    cyan: "from-lab-cyan/70 via-lab-cyan/20 to-transparent",
    violet: "from-lab-violet/70 via-lab-violet/20 to-transparent",
    green: "from-lab-green/70 via-lab-green/20 to-transparent",
    amber: "from-lab-amber/70 via-lab-amber/20 to-transparent",
  }[tone];

  const valueClass = {
    cyan: "text-lab-cyan",
    violet: "text-lab-violet",
    green: "text-lab-green",
    amber: "text-lab-amber",
  }[tone];

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-lab-surface-soft px-3 py-2.5", border)}>
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80", line)} aria-hidden />
      <p className="text-[10px] uppercase tracking-[0.12em] text-lab-dim">{title}</p>
      <p className={cn("lab-number mt-1 text-2xl font-semibold tracking-tight tabular-nums", valueClass)}>{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-lab-muted">{caption}</p>
    </div>
  );
}
