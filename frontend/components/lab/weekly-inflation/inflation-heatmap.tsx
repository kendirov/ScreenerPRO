"use client";

import * as React from "react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import { resolveHeatFill } from "@/components/lab/weekly-inflation/inflation-chart-utils";
import {
  formatInflationPct,
  formatPeriodLabel,
  groupPointsByMonth,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

export function InflationHeatmap({
  points,
  className,
}: {
  points: WeeklyInflationPoint[];
  className?: string;
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);

  const chartPoints = points.filter((p) => p.headlinePct != null && !Number.isNaN(p.headlinePct));
  if (chartPoints.length === 0) return null;

  const values = chartPoints.map((p) => p.headlinePct as number);
  const globalMin = Math.min(...values);
  const globalMax = Math.max(...values);
  const monthGroups = groupPointsByMonth(chartPoints);
  const hovered = chartPoints.find((p) => p.id === hoveredId) ?? null;

  return (
    <section className={cn("lab-glass-panel p-4", className)}>
      <LabSectionHeading>Тепловая карта недель</LabSectionHeading>
      <p className="mb-3 text-[11px] text-lab-muted">
        Каждая ячейка — одна неделя. Цвет отражает силу headline. Наведите для деталей.
      </p>

      {hovered ? (
        <div className="mb-3 rounded-lg border border-lab-violet/25 bg-lab-bg-deep/70 px-3 py-2 text-[11px]">
          <span className="text-lab-text">{formatPeriodLabel(hovered) ?? hovered.periodEnd}</span>
          <span className="text-lab-muted"> · </span>
          <span className="font-mono text-lab-amber">{formatInflationPct(hovered.headlinePct)}</span>
        </div>
      ) : (
        <p className="mb-3 text-[10px] text-lab-dim">Наведите на ячейку недели</p>
      )}

      <div className="space-y-4">
        {monthGroups.map((group) => (
          <div key={group.monthKey}>
            <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-lab-dim">{group.label}</p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
              {group.points.map((point) => {
                const value = point.headlinePct as number;
                const fill = resolveHeatFill(value, globalMin, globalMax);
                const active = hoveredId === point.id;
                return (
                  <button
                    key={point.id}
                    type="button"
                    className={cn(
                      "aspect-square rounded-lg border transition-transform",
                      active ? "scale-105 border-lab-amber/60 ring-2 ring-lab-amber/30" : "border-lab-border/60",
                    )}
                    style={{ background: fill }}
                    title={`${formatPeriodLabel(point) ?? point.periodEnd}: ${formatInflationPct(point.headlinePct)}`}
                    onMouseEnter={() => setHoveredId(point.id)}
                    onFocus={() => setHoveredId(point.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onBlur={() => setHoveredId(null)}
                  >
                    <span className="sr-only">
                      {point.periodEnd}: {formatInflationPct(point.headlinePct)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-lab-muted">
        <span>слабее</span>
        <div className="flex gap-1">
          {[0.2, 0.45, 0.7, 1].map((t) => (
            <span
              key={t}
              className="h-3 w-8 rounded-sm border border-lab-border/40"
              style={{
                background: resolveHeatFill(globalMin + (globalMax - globalMin) * t, globalMin, globalMax),
              }}
            />
          ))}
        </div>
        <span>сильнее</span>
      </div>
    </section>
  );
}
