"use client";

import { Database, FileSpreadsheet, PlusCircle, Search } from "lucide-react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { InflationTrendChart } from "@/components/lab/weekly-inflation/inflation-trend-chart";
import { formatInflationHeadlineSummary } from "@/components/lab/weekly-inflation/inflation-kpi-strip";
import type { WeeklyInflationDashboard } from "@/lib/domain/weekly-inflation";
import { cn } from "@/lib/utils/cn";

export function InflationHeroPanel({
  hasData,
  dashboard,
  onAddWeek,
  onImportCsv,
  onShowSources,
  className,
}: {
  hasData: boolean;
  dashboard: WeeklyInflationDashboard;
  onAddWeek: () => void;
  onImportCsv: () => void;
  onShowSources: () => void;
  className?: string;
}) {
  if (hasData) {
    const summary = formatInflationHeadlineSummary(dashboard);

    return (
      <LabGlassPanel depth={30} variant="hot" className={cn("relative overflow-hidden p-0", className)}>
        <div className="lab-accent-line absolute inset-x-0 top-0 opacity-55" aria-hidden />
        <div className="relative border-b border-lab-border/60 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-lab-dim">Главный график</p>
          <p className="mt-1 text-sm leading-snug text-lab-text">{summary}</p>
          <p className="mt-1 font-mono text-[10px] text-lab-muted">
            Столбцы — недельный темп · линия — 4w avg · подсветка — последняя неделя
          </p>
        </div>
        <InflationTrendChart
          points={dashboard.points}
          metrics={dashboard.metrics}
          embedded
          className="rounded-none border-0 bg-transparent shadow-none"
        />
      </LabGlassPanel>
    );
  }

  return (
    <LabGlassPanel depth={30} className={cn("relative overflow-hidden px-6 py-10 text-center", className)}>
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-45" aria-hidden />
      <div className="relative mx-auto max-w-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lab-violet/30 bg-lab-violet/10 shadow-[var(--lab-glow-violet)]">
          <Database className="h-7 w-7 text-lab-violet" />
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-lab-text">Данные не загружены</h2>
        <p className="mt-2 text-sm leading-relaxed text-lab-muted">
          Добавьте последнюю неделю вручную или импортируйте CSV. Графики и рыночная интерпретация появятся
          только после вашего ввода — без подстановки фейковых рядов.
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-lab-dim">
          KPI пересчитаются · брифинг на /lab/preparation увидит неделю
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <HeroButton icon={PlusCircle} onClick={onAddWeek} primary>
            Добавить неделю
          </HeroButton>
          <HeroButton icon={FileSpreadsheet} onClick={onImportCsv}>
            Импорт CSV
          </HeroButton>
          <HeroButton icon={Search} onClick={onShowSources}>
            Где взять данные
          </HeroButton>
        </div>
      </div>
    </LabGlassPanel>
  );
}

function HeroButton({
  children,
  onClick,
  icon: Icon,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm transition-colors duration-200",
        primary
          ? "border-lab-cyan/35 bg-lab-cyan/12 text-lab-text shadow-[var(--lab-glow-cyan)] hover:bg-lab-cyan/18"
          : "border-lab-border bg-lab-surface-soft text-lab-muted hover:border-lab-border-strong hover:text-lab-text",
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
