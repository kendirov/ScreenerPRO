"use client";

import {
  calcMomentumDirection,
  CBR_INFLATION_TARGET_PCT,
  formatDeviationPp,
  formatInflationPct,
  formatPeriodLabel,
  INFLATION_REGIME_LABELS,
  WEEKLY_INFLATION_SOURCE_LABELS,
  type WeeklyInflationDashboard,
} from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

export function InflationKpiStrip({
  dashboard,
  className,
}: {
  dashboard: WeeklyInflationDashboard;
  className?: string;
}) {
  const { latest, metrics } = dashboard;
  const momentum = calcMomentumDirection(dashboard.points);
  const sourceLabel = latest ? WEEKLY_INFLATION_SOURCE_LABELS[latest.source] : "—";

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5", className)}>
      <KpiTile
        title="Последняя неделя"
        value={formatKpiValue(latest?.headlinePct ?? null)}
        caption={
          latest
            ? `${formatPeriodLabel(latest) ?? latest.periodEnd} · ${sourceLabel}`
            : "Добавьте неделю вручную"
        }
        tone={resolveInflationTone(latest?.headlinePct ?? null)}
      />
      <KpiTile
        title="4-недельный импульс"
        value={metrics.avg4w != null ? formatInflationPct(metrics.avg4w) : "Нужна история"}
        caption={resolveMomentumCaption(momentum, metrics.avg4w != null)}
        tone={resolveMomentumTone(momentum)}
      />
      <KpiTile
        title="Годовой из недели"
        value={formatKpiValue(metrics.annualizedLatest)}
        caption={metrics.annualizedLatest != null ? "из последней недели" : "Нужна история"}
        tone={resolveTargetTone(metrics.gapToTarget)}
      />
      <KpiTile
        title="Годовой из 4w"
        value={formatKpiValue(metrics.annualized4w)}
        caption={metrics.annualized4w != null ? "из 4-нед. среднего" : "Нужна история"}
        tone={resolveTargetTone(metrics.gapToTarget)}
      />
      <KpiTile
        title="Отклонение от 4%"
        value={metrics.gapToTarget != null ? formatDeviationPp(metrics.gapToTarget) : "—"}
        caption={resolveGapCaption(metrics.gapToTarget)}
        tone={resolveTargetTone(metrics.gapToTarget)}
      />
    </div>
  );
}

function formatKpiValue(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return formatInflationPct(value);
}

function resolveMomentumCaption(
  momentum: ReturnType<typeof calcMomentumDirection>,
  hasAvg4w: boolean,
): string {
  if (!hasAvg4w) return `Нужно 4+ нед. · цель ${CBR_INFLATION_TARGET_PCT}%`;
  if (momentum === "acceleration") return "Давление усиливается";
  if (momentum === "deceleration") return "Замедление";
  if (momentum === "neutral") return "Без сдвига";
  return "Нужна история для направления";
}

function resolveGapCaption(gap: number | null): string {
  if (gap == null) return "Нужна история";
  if (gap > 0.5) return "Выше цели 4%";
  if (gap < -0.5) return "Темп ниже цели";
  return "Вблизи цели 4%";
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
  tone: "red" | "green" | "violet" | "neutral";
}) {
  const border = {
    red: "border-lab-red/30",
    green: "border-lab-cyan/25",
    violet: "border-lab-violet/30",
    neutral: "border-lab-border",
  }[tone];

  const line = {
    red: "from-lab-red/70 via-lab-amber/30 to-transparent",
    green: "from-lab-cyan/60 via-lab-cyan/20 to-transparent",
    violet: "from-lab-violet/60 via-lab-violet/20 to-transparent",
    neutral: "from-lab-muted/40 to-transparent",
  }[tone];

  const valueClass = {
    red: "text-lab-red",
    green: "text-lab-cyan",
    violet: "text-lab-violet",
    neutral: "text-lab-text",
  }[tone];

  return (
    <div className={cn("lab-glass-card relative overflow-hidden border px-3 py-2.5", border)}>
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80", line)} aria-hidden />
      <p className="lab-type-caption text-[10px] uppercase tracking-[0.12em] text-lab-dim">{title}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums tracking-tight", valueClass)}>{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-lab-muted">{caption}</p>
    </div>
  );
}

function resolveInflationTone(value: number | null): "red" | "green" | "violet" | "neutral" {
  if (value == null) return "neutral";
  if (value >= 0.15) return "red";
  if (value <= 0.05) return "green";
  return "violet";
}

function resolveMomentumTone(
  direction: ReturnType<typeof calcMomentumDirection>,
): "red" | "green" | "violet" | "neutral" {
  if (direction === "acceleration") return "red";
  if (direction === "deceleration") return "green";
  if (direction === "neutral") return "violet";
  return "neutral";
}

function resolveTargetTone(deviation: number | null): "red" | "green" | "violet" | "neutral" {
  if (deviation == null) return "neutral";
  if (deviation > 0.5) return "red";
  if (deviation < -0.5) return "green";
  return "violet";
}

/** Краткий вывод для верхнего экрана */
export function formatInflationHeadlineSummary(dashboard: WeeklyInflationDashboard): string {
  const { metrics } = dashboard;
  if (!dashboard.latest?.headlinePct) {
    return "данные не загружены. Добавьте недели вручную или подключите источник позже.";
  }
  const regime = INFLATION_REGIME_LABELS[metrics.regime];
  const gap = metrics.gapToTarget;
  if (gap != null && gap < -0.5) return `${regime} · темп ниже цели 4%`;
  if (gap != null && gap > 0.5) return `${regime} · давление усиливается`;
  return `${regime} · смотрите 4w импульс и категории`;
}
