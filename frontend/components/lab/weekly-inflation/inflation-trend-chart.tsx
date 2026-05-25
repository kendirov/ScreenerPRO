"use client";

import * as React from "react";
import { LabSectionHeading } from "@/components/lab/lab-ui";
import {
  ChartTooltip,
  chartPointToTooltip,
  classifyBarTone,
  INFLATION_BAR_COLORS,
  type ChartTooltipState,
} from "@/components/lab/weekly-inflation/inflation-chart-utils";
import {
  buildWeeklyInflationChartSeries,
  formatInflationPct,
  formatPeriodLabel,
  WEEKLY_INFLATION_NORMAL_ZONE,
  WEEKLY_INFLATION_SOURCE_LABELS,
  type WeeklyInflationDashboardMetrics,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

export function InflationTrendChart({
  points,
  metrics,
  className,
}: {
  points: WeeklyInflationPoint[];
  metrics: WeeklyInflationDashboardMetrics;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = React.useState<ChartTooltipState | null>(null);

  const series = React.useMemo(() => buildWeeklyInflationChartSeries(points), [points]);
  if (series.length === 0) return null;

  const values = series.map((s) => s.headlinePct);
  const avg4Line = series.map((s) => s.avg4w).filter((v): v is number => v != null);
  const yMin = Math.min(0, ...values, WEEKLY_INFLATION_NORMAL_ZONE.min - 0.02);
  const yMax = Math.max(...values, WEEKLY_INFLATION_NORMAL_ZONE.max, 0.01) + 0.02;
  const yRange = yMax - yMin || 0.01;

  const width = Math.max(640, series.length * 44 + 80);
  const height = 240;
  const padX = 36;
  const padY = 28;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const barGap = 8;
  const barWidth = Math.max(12, (chartW - barGap * (series.length - 1)) / series.length);

  const yScale = (value: number) => padY + chartH - ((value - yMin) / yRange) * chartH;
  const baselineY = yScale(0);

  const normalTop = yScale(WEEKLY_INFLATION_NORMAL_ZONE.max);
  const normalBottom = yScale(WEEKLY_INFLATION_NORMAL_ZONE.min);
  const lastIndex = series.length - 1;

  const avg4Path = series
    .map((item, index) => {
      if (item.avg4w == null) return null;
      const x = padX + index * (barWidth + barGap) + barWidth / 2;
      const y = yScale(item.avg4w);
      return { x, y };
    })
    .filter((p): p is { x: number; y: number } => p != null)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const showTooltip = (item: (typeof series)[number], event: React.MouseEvent<SVGElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const period = formatPeriodLabel(item.point) ?? `${item.point.periodStart} — ${item.point.periodEnd}`;
    setTooltip(
      chartPointToTooltip(
        item,
        rect,
        event.clientX,
        event.clientY,
        period,
        WEEKLY_INFLATION_SOURCE_LABELS[item.point.source],
      ),
    );
  };

  return (
    <section className={cn("lab-glass-panel p-4", className)}>
      <LabSectionHeading>Недельный тренд</LabSectionHeading>
      <p className="mb-3 text-[11px] text-lab-muted">
        {series.length} нед. · столбцы headline · линия 4w avg · зона «условно нормально»
        {metrics.avg4w != null ? ` · текущий 4w avg ${formatInflationPct(metrics.avg4w)}` : ""}
      </p>

      <div ref={containerRef} className="relative overflow-x-auto">
        <ChartTooltip tooltip={tooltip} />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-full"
          role="img"
          aria-label="Столбчатый график недельной инфляции"
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id="normal-zone-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(139,92,246,0.12)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0.04)" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padY + chartH * t;
            const label = (yMax - t * yRange).toFixed(2);
            return (
              <g key={t}>
                <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="rgba(148,163,184,0.1)" strokeDasharray="4 4" />
                <text x={padX - 6} y={y + 3} textAnchor="end" className="fill-lab-dim text-[9px]">
                  {label}%
                </text>
              </g>
            );
          })}

          <rect
            x={padX}
            y={normalTop}
            width={chartW}
            height={Math.max(normalBottom - normalTop, 1)}
            fill="url(#normal-zone-fill)"
            rx="4"
          />
          <text x={width - padX} y={normalTop + 12} textAnchor="end" className="fill-lab-violet/70 text-[9px]">
            условно нормально
          </text>

          <line x1={padX} x2={width - padX} y1={baselineY} y2={baselineY} stroke="rgba(148,163,184,0.25)" />

          {series.map((item, index) => {
            const prev = index > 0 ? series[index - 1]!.headlinePct : null;
            const tone = classifyBarTone(item.headlinePct, prev);
            const colors = INFLATION_BAR_COLORS[tone];
            const x = padX + index * (barWidth + barGap);
            const barTop = yScale(item.headlinePct);
            const barHeight = Math.max(baselineY - barTop, 2);
            const isLast = index === lastIndex;

            return (
              <g key={item.point.id}>
                <rect
                  x={x}
                  y={barTop}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill={colors.fill}
                  stroke={isLast ? "#fbbf24" : colors.stroke}
                  strokeWidth={isLast ? 2.5 : 1}
                  style={{ filter: isLast ? `drop-shadow(0 0 8px ${colors.glow})` : undefined }}
                  onMouseEnter={(e) => showTooltip(item, e)}
                  onMouseMove={(e) => showTooltip(item, e)}
                />
                <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" className="fill-lab-dim text-[9px]">
                  {item.point.periodEnd.slice(5)}
                </text>
              </g>
            );
          })}

          {avg4Path ? (
            <path d={avg4Path} fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeDasharray="6 4" />
          ) : null}
        </svg>

        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-lab-muted">
          <LegendDot color="#22d3ee" label="замедление" />
          <LegendDot color="#f59e0b" label="умеренное давление" />
          <LegendDot color="#fb7185" label="ускорение" />
          <LegendDot color="#8b5cf6" label="нейтрально" />
          <LegendDot color="#fbbf24" label="4w avg" dashed />
        </div>
      </div>
    </section>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: dashed ? "transparent" : color,
          border: dashed ? `2px dashed ${color}` : undefined,
        }}
      />
      {label}
    </span>
  );
}
