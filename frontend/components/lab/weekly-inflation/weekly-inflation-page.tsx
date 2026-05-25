"use client";

import * as React from "react";
import { LabPageShell } from "@/components/lab/lab-page-shell";
import { LabEmptyState } from "@/components/lab/lab-ui";
import { PreparationCollapsibleSection } from "@/components/lab/preparation/preparation-collapsible-section";
import { InflationAnnualizedChart } from "@/components/lab/weekly-inflation/inflation-annualized-chart";
import { InflationCategoryContribution } from "@/components/lab/weekly-inflation/inflation-category-contribution";
import { InflationDataSourcesGuide } from "@/components/lab/weekly-inflation/inflation-data-sources-guide";
import { InflationHeatmap } from "@/components/lab/weekly-inflation/inflation-heatmap";
import { formatInflationHeadlineSummary, InflationKpiStrip } from "@/components/lab/weekly-inflation/inflation-kpi-strip";
import { InflationManualImport } from "@/components/lab/weekly-inflation/inflation-manual-import";
import { InflationMarketImpact } from "@/components/lab/weekly-inflation/inflation-market-impact";
import { InflationOfficialPublication } from "@/components/lab/weekly-inflation/inflation-official-publication";
import { InflationQuickWeekForm } from "@/components/lab/weekly-inflation/inflation-quick-week-form";
import { InflationRecentWeeksTable } from "@/components/lab/weekly-inflation/inflation-recent-weeks-table";
import { InflationSourceStatus } from "@/components/lab/weekly-inflation/inflation-source-status";
import { InflationTrendChart } from "@/components/lab/weekly-inflation/inflation-trend-chart";
import {
  buildWeeklyInflationDashboard,
  clearManualPointsStorage,
  downloadWeeklyInflationCsvTemplate,
  extractCategoryComparison,
  formatPeriodLabel,
  hasManualPoints,
  loadOfficialPublicationFromStorage,
  mergeWeeklyInflationPoints,
  removeWeeklyInflationPoint,
  saveOfficialPublicationToStorage,
  sortWeeklyInflationPoints,
  WEEKLY_INFLATION_SOURCE_LABELS,
  type WeeklyInflationOfficialPublication,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";
import {
  loadWeeklyInflationPoints,
  saveWeeklyInflationPoints,
} from "@/lib/domain/weekly-inflation-storage";

const PAGE_DESCRIPTION = "Недельная инфляция РФ для брифинга: цифра, тренд и сценарий для рынка.";

const EMPTY_MESSAGE =
  "данные не загружены. Загрузите CSV вручную или проверьте экспериментальный источник Росстат/ЕМИСС.";

export function WeeklyInflationPage() {
  const [points, setPoints] = React.useState<WeeklyInflationPoint[]>([]);
  const [officialPublication, setOfficialPublication] = React.useState<WeeklyInflationOfficialPublication | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const [dataLoadOpen, setDataLoadOpen] = React.useState(false);

  const dataLoadSectionRef = React.useRef<HTMLDivElement>(null);
  const csvSectionRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    setPoints(loadWeeklyInflationPoints());
    setOfficialPublication(loadOfficialPublicationFromStorage());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    saveWeeklyInflationPoints(points);
  }, [points, hydrated]);

  const dashboard = React.useMemo(() => buildWeeklyInflationDashboard(points), [points]);
  const hasData = dashboard.points.some((p) => p.headlinePct != null);

  React.useEffect(() => {
    if (!hydrated) return;
    setDataLoadOpen(!hasData);
  }, [hydrated, hasData]);
  const showManualBadge = hasManualPoints(points);

  const primarySource = dashboard.latest?.source ?? "manual";
  const updatedLabel = dashboard.latest
    ? formatPeriodLabel(dashboard.latest) ?? dashboard.latest.periodEnd
    : "—";

  const pills = React.useMemo(() => {
    const items = [
      { label: "DRAFT", tone: "meta" as const },
      { label: "LAB", tone: "accent" as const },
      { label: `источник: ${WEEKLY_INFLATION_SOURCE_LABELS[primarySource]}`, tone: "source" as const },
      { label: `обновлено: ${updatedLabel}`, tone: "time" as const },
    ];
    if (showManualBadge) {
      items.push({ label: "ручные данные", tone: "meta" as const });
    }
    if (officialPublication?.verifiedManually) {
      items.push({ label: "проверено вручную", tone: "source" as const });
    }
    return items;
  }, [primarySource, updatedLabel, showManualBadge, officialPublication?.verifiedManually]);

  const sorted = sortWeeklyInflationPoints(dashboard.points);
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.length >= 2 ? sorted.at(-2)! : null;
  const categoryRows = extractCategoryComparison(latest, previous);
  const headlineSummary = formatInflationHeadlineSummary(dashboard);

  const scrollToDataLoad = React.useCallback((focus?: "official-url" | "csv") => {
    setDataLoadOpen(true);
    window.setTimeout(() => {
      dataLoadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focus === "official-url") {
        document.getElementById("weekly-inflation-official-url")?.focus();
      } else if (focus === "csv") {
        csvSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  }, []);

  const handlePointsChange = (next: WeeklyInflationPoint[]) => {
    setPoints(next);
  };

  const handleClear = () => {
    setPoints([]);
    clearManualPointsStorage();
  };

  const handleDeleteWeek = (periodEnd: string) => {
    setPoints((prev) => removeWeeklyInflationPoint(prev, periodEnd));
  };

  const handleSaveOfficialPublication = (next: WeeklyInflationOfficialPublication) => {
    setOfficialPublication(next);
    saveOfficialPublicationToStorage(next);
  };

  const handleApplyFetchedPoints = (incoming: WeeklyInflationPoint[]) => {
    setPoints((prev) => mergeWeeklyInflationPoints(prev, incoming));
  };

  if (!hydrated) {
    return null;
  }

  return (
    <LabPageShell title="Инфляционная лаборатория" description={PAGE_DESCRIPTION} pills={pills}>
      <div className="space-y-3">
        <InflationKpiStrip dashboard={dashboard} />

        {hasData ? (
          <div className="lab-glass-panel border-lab-violet/20 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-lab-dim">Вывод</p>
            <p className="mt-1 text-sm leading-snug text-lab-text">{headlineSummary}</p>
          </div>
        ) : (
          <LabEmptyState message={EMPTY_MESSAGE} className="min-h-[min(28vh,240px)]" />
        )}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
          <InflationDataSourcesGuide
            onInsertOfficialUrl={() => scrollToDataLoad("official-url")}
            onOpenCsvImport={() => scrollToDataLoad("csv")}
            onDownloadTemplate={downloadWeeklyInflationCsvTemplate}
          />
          <InflationQuickWeekForm points={points} onPointsChange={handlePointsChange} />
        </div>

        <InflationRecentWeeksTable
          points={points}
          officialPublication={officialPublication}
          onDeleteWeek={handleDeleteWeek}
        />

        {hasData ? (
          <>
            <InflationTrendChart points={dashboard.points} metrics={dashboard.metrics} />
            <InflationAnnualizedChart points={dashboard.points} />
            <InflationHeatmap points={dashboard.points} />
            <InflationCategoryContribution categories={categoryRows} />
            <InflationMarketImpact dashboard={dashboard} />
          </>
        ) : null}

        {showManualBadge ? (
          <div className="rounded-xl border border-lab-amber/25 bg-lab-amber/8 px-3 py-2 text-sm text-lab-amber">
            Ручные данные. Сверьте с официальным источником перед эфиром.
          </div>
        ) : null}

        <InflationSourceStatus
          dashboard={dashboard}
          officialPublication={officialPublication}
          onApplyFetchedPoints={handleApplyFetchedPoints}
        />

        <div ref={dataLoadSectionRef}>
          <PreparationCollapsibleSection
            title="Загрузка данных"
            subtitle="CSV · официальная ссылка · localStorage"
            accent="violet"
            defaultOpen={!hasData}
            open={dataLoadOpen}
            onOpenChange={setDataLoadOpen}
            badge={points.length > 0 ? `${points.length} нед.` : undefined}
          >
            <InflationOfficialPublication
              publication={officialPublication}
              onSave={handleSaveOfficialPublication}
              urlInputId="weekly-inflation-official-url"
            />
            <InflationManualImport
              points={points}
              onPointsChange={handlePointsChange}
              onClear={handleClear}
              embedded
              csvSectionRef={csvSectionRef}
            />
          </PreparationCollapsibleSection>
        </div>
      </div>
    </LabPageShell>
  );
}
