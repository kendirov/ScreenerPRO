"use client";

import { LabSectionHeading } from "@/components/lab/lab-ui";
import { buildInflationMarketImpactBrief,
  INFLATION_IMPACT_DIRECTION_LABELS,
  INFLATION_IMPACT_SENSITIVITY_LABELS,
  type InflationImpactDirection,
  type InflationMarketImpact,
} from "@/lib/domain/weekly-inflation-market-impact";
import type { WeeklyInflationDashboard } from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

export function InflationMarketImpact({
  dashboard,
  className,
}: {
  dashboard: WeeklyInflationDashboard;
  className?: string;
}) {
  const brief = buildInflationMarketImpactBrief(dashboard);
  const hasData = dashboard.points.some((p) => p.headlinePct != null);
  if (!hasData) return null;

  return (
    <section className={cn("lab-glass-panel p-4", className)}>
      <LabSectionHeading>Что это значит для рынка</LabSectionHeading>
      <p className="mb-4 text-[11px] leading-relaxed text-lab-muted">
        Сценарии для эфира — не торговая рекомендация.
      </p>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {brief.impacts.map((impact) => (
          <ImpactCard key={impact.asset} impact={impact} />
        ))}
      </div>
    </section>
  );
}

function ImpactCard({ impact }: { impact: InflationMarketImpact }) {
  const tone = resolveDirectionTone(impact.direction);

  return (
    <div className={cn("rounded-xl border px-3 py-3", tone.border, tone.bg)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-lab-text">{impact.title}</p>
        <div className="flex flex-wrap gap-1">
          <span className={cn("lab-chip px-1.5 py-0.5 text-[9px]", tone.chip)}>
            {INFLATION_IMPACT_DIRECTION_LABELS[impact.direction]}
          </span>
          <span className="lab-chip px-1.5 py-0.5 text-[9px] text-lab-muted">
            чувствительность: {INFLATION_IMPACT_SENSITIVITY_LABELS[impact.sensitivity]}
          </span>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-lab-muted">{impact.explanation}</p>

      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-[0.1em] text-lab-dim">Что смотреть</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {impact.watchInstruments.map((ticker) => (
            <span key={ticker} className="rounded-md border border-lab-border/70 bg-lab-bg-deep/50 px-1.5 py-0.5 font-mono text-[10px] text-lab-cyan">
              {ticker}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function resolveDirectionTone(direction: InflationImpactDirection): {
  border: string;
  bg: string;
  text: string;
  chip: string;
} {
  switch (direction) {
    case "supports-easing":
      return {
        border: "border-lab-cyan/25",
        bg: "bg-lab-cyan/5",
        text: "text-lab-cyan",
        chip: "border-lab-cyan/30 bg-lab-cyan/10 text-lab-cyan",
      };
    case "supports-tightness":
      return {
        border: "border-lab-red/25",
        bg: "bg-lab-red/5",
        text: "text-lab-red",
        chip: "border-lab-red/30 bg-lab-red/10 text-lab-red",
      };
    case "shock":
      return {
        border: "border-lab-amber/30",
        bg: "bg-lab-amber/8",
        text: "text-lab-amber",
        chip: "border-lab-amber/35 bg-lab-amber/10 text-lab-amber",
      };
    default:
      return {
        border: "border-lab-violet/25",
        bg: "bg-lab-violet/5",
        text: "text-lab-violet",
        chip: "border-lab-violet/30 bg-lab-violet/10 text-lab-violet",
      };
  }
}
