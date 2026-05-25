"use client";

import * as React from "react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import { ChartTooltip, type ChartTooltipState } from "@/components/lab/weekly-inflation/inflation-chart-utils";
import {
  buildAnnualizedSeries,
  CBR_INFLATION_TARGET_PCT,
  formatInflationPct,
  formatPeriodLabel,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

export function InflationAnnualizedChart({
  points,
  className,
}: {
  points: WeeklyInflationPoint[];
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = React.useState<ChartTooltipState | null>(null);

  const series = React.useMemo(() => buildAnnualizedSeries(points), [points]);
  const validLatest = series.map((s) => s.annualizedLatest).filter((v): v is number => v != null);
  const valid4w = series.map((s) => s.annualized4w).filter((v): v is number => v != null);

  if (series.length === 0 || (validLatest.length === 0 && valid4w.length === 0)) return null;

  const allValues = [...validLatest, ...valid4w, CBR_INFLATION_TARGET_PCT];
  const yMin = Math.min(...allValues, 0) - 1;
  const yMax = Math.max(...allValues, CBR_INFLATION_TARGET_PCT + 2);
  const yRange = yMax - yMin || 1;

  const width = Math.max(640, series.length * 44 + 80);
  const height = 220;
  const padX = 36;
  const padY = 24;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const xAt = (index: number) => padX + (index / Math.max(series.length - 1, 1)) * chartW;
  const yScale = (value: number) => padY + chartH - ((value - yMin) / yRange) * chartH;
  const targetY = yScale(CBR_INFLATION_TARGET_PCT);

  const buildPath = (key: "annualizedLatest" | "annualized4w") =>
    series
      .map((item, index) => {
        const value = item[key];
        if (value == null) return null;
        return { x: xAt(index), y: yScale(value), item, value };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);

  const latestPath = buildPath("annualizedLatest");
  const avg4Path = buildPath("annualized4w");

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <section className={cn("lab-glass-panel p-4", className)}>
      <LabSectionHeading>Годовой темп против цели</LabSectionHeading>
      <p className="mb-3 text-[11px] leading-relaxed text-lab-muted">
        Годовой темп из недельной инфляции — это не прогноз, а пересчёт текущего темпа в годовой масштаб.
      </p>

      <div ref={containerRef} className="relative overflow-x-auto">
        <ChartTooltip tooltip={tooltip} />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-full"
          role="img"
          aria-label="Годовой темп инфляции против цели ЦБ"
          onMouseLeave={() => setTooltip(null)}
        >
          <rect
            x={padX}
            y={padY}
            width={chartW}
            height={Math.max(targetY - padY, 0)}
            fill="rgba(34,211,238,0.06)"
          />
          <rect
            x={padX}
            y={targetY}
            width={chartW}
            height={Math.max(padY + chartH - targetY, 0)}
            fill="rgba(251,113,133,0.06)"
          />

          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padY + chartH * t;
            const label = (yMax - t * yRange).toFixed(1);
            return (
              <g key={t}>
                <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="rgba(148,163,184,0.1)" strokeDasharray="4 4" />
                <text x={padX - 6} y={y + 3} textAnchor="end" className="fill-lab-dim text-[9px]">
                  {label}%
                </text>
              </g>
            );
          })}

          <line
            x1={padX}
            x2={width - padX}
            y1={targetY}
            y2={targetY}
            stroke="#8b5cf6"
            strokeWidth="1.5"
            strokeDasharray="8 5"
          />
          <text x={width - padX} y={targetY - 6} textAnchor="end" className="fill-lab-violet text-[9px]">
            цель ЦБ {CBR_INFLATION_TARGET_PCT}%
          </text>

          {avg4Path.length > 0 ? (
            <path d={toPath(avg4Path)} fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeDasharray="6 4" />
          ) : null}
          {latestPath.length > 0 ? (
            <path d={toPath(latestPath)} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
          ) : null}

          {latestPath.map(({ x, y, item, value }) => (
            <circle
              key={`latest-${item.point.id}`}
              cx={x}
              cy={y}
              r="4"
              fill="#22d3ee"
              stroke="#0f172a"
              strokeWidth="1.5"
              onMouseEnter={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                setTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  title: formatPeriodLabel(item.point) ?? item.point.periodEnd,
                  lines: [
                    `Annualized latest: ${formatInflationPct(value)}`,
                    item.annualized4w != null
                      ? `Annualized 4w: ${formatInflationPct(item.annualized4w)}`
                      : "Annualized 4w: недостаточно истории",
                    `Цель ЦБ: ${CBR_INFLATION_TARGET_PCT}%`,
                  ],
                });
              }}
              onMouseMove={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                setTooltip((prev) =>
                  prev
                    ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
                    : null,
                );
              }}
            />
          ))}
        </svg>

        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-lab-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-lab-cyan" />
            annualized latest
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-lab-amber" />
            annualized 4w avg
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-lab-cyan/20" />
            ниже цели
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-lab-red/20" />
            выше цели
          </span>
        </div>
      </div>
    </section>
  );
}
