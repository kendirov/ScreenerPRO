"use client";

import { LabSectionHeading } from "@/components/lab/lab-ui";
import { formatInflationPct, type WeeklyInflationCategoryComparisonRow } from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

export function InflationCategoryContribution({
  categories,
  className,
}: {
  categories: WeeklyInflationCategoryComparisonRow[];
  className?: string;
}) {
  if (categories.length === 0) return null;

  const maxAbs = Math.max(
    ...categories.flatMap((c) => [Math.abs(c.currentPct), Math.abs(c.previousPct ?? 0)]),
    0.01,
  );

  return (
    <section className={cn("lab-glass-panel p-4", className)}>
      <LabSectionHeading>Категории · последняя неделя</LabSectionHeading>
      <p className="mb-3 text-[11px] text-lab-muted">
        Горизонтальные бары — текущая неделя. Светлая полоска — предыдущая (если была).
      </p>
      <ul className="space-y-4">
        {categories
          .slice()
          .sort((a, b) => Math.abs(b.currentPct) - Math.abs(a.currentPct))
          .map((cat) => {
            const currentWidth = (Math.abs(cat.currentPct) / maxAbs) * 100;
            const previousWidth =
              cat.previousPct != null ? (Math.abs(cat.previousPct) / maxAbs) * 100 : null;
            const positive = cat.currentPct >= 0;

            return (
              <li key={cat.id}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-lab-text">{cat.label}</span>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-sm tabular-nums">
                    <span className={positive ? "text-lab-red" : "text-lab-cyan"}>
                      {formatInflationPct(cat.currentPct)}
                    </span>
                    {cat.previousPct != null ? (
                      <span className="text-[11px] text-lab-muted">
                        было {formatInflationPct(cat.previousPct)}
                      </span>
                    ) : null}
                    {cat.deltaPct != null ? (
                      <span
                        className={cn(
                          "text-[11px]",
                          cat.deltaPct > 0 ? "text-lab-red" : cat.deltaPct < 0 ? "text-lab-cyan" : "text-lab-muted",
                        )}
                      >
                        Δ {cat.deltaPct >= 0 ? "+" : ""}
                        {cat.deltaPct.toFixed(2)} п.п.
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-lab-bg-deep/80">
                  {previousWidth != null ? (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-lab-muted/25"
                      style={{ width: `${previousWidth}%` }}
                    />
                  ) : null}
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      positive ? "bg-lab-amber/85" : "bg-lab-cyan/75",
                    )}
                    style={{ width: `${currentWidth}%` }}
                  />
                </div>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
