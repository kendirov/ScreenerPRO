"use client";

import * as React from "react";
import { LabPageShell } from "@/components/lab/lab-page-shell";
import { PreparationCollapsibleSection } from "@/components/lab/preparation/preparation-collapsible-section";
import { InflationAnnualizedChart } from "@/components/lab/weekly-inflation/inflation-annualized-chart";
import { InflationBriefingBridge } from "@/components/lab/weekly-inflation/inflation-briefing-bridge";
import { InflationCategoryContribution } from "@/components/lab/weekly-inflation/inflation-category-contribution";
import { InflationDataSourcesGuide } from "@/components/lab/weekly-inflation/inflation-data-sources-guide";
import { InflationHeatmap } from "@/components/lab/weekly-inflation/inflation-heatmap";
import { InflationHeroPanel } from "@/components/lab/weekly-inflation/inflation-hero-panel";
import { InflationKpiStrip } from "@/components/lab/weekly-inflation/inflation-kpi-strip";
import { InflationManualImport } from "@/components/lab/weekly-inflation/inflation-manual-import";
import { InflationMarketImpact } from "@/components/lab/weekly-inflation/inflation-market-impact";
import { InflationOfficialPublication } from "@/components/lab/weekly-inflation/inflation-official-publication";
import { InflationQuickWeekForm } from "@/components/lab/weekly-inflation/inflation-quick-week-form";
import { InflationRecentWeeksTable } from "@/components/lab/weekly-inflation/inflation-recent-weeks-table";
import { InflationSourceStatus } from "@/components/lab/weekly-inflation/inflation-source-status";
import {
  buildWeeklyInflationDashboard,
  clearManualPointsStorage,
  downloadWeeklyInflationCsvTemplate,
  extractCategoryComparison,
  hasManualPoints,
  loadOfficialPublicationFromStorage,
  mergeWeeklyInflationPoints,
  removeWeeklyInflationPoint,
  saveOfficialPublicationToStorage,
  sortWeeklyInflationPoints,
  type WeeklyInflationOfficialPublication,
  type WeeklyInflationPoint,
} from "@/lib/domain/weekly-inflation";
import {
  loadWeeklyInflationPoints,
  saveWeeklyInflationPoints,
} from "@/lib/domain/weekly-inflation-storage";

const PAGE_DESCRIPTION =
  "Недельная инфляция РФ: темп, импульс, цель ЦБ 4% и рыночный режим";

export function WeeklyInflationPage() {
  const [points, setPoints] = React.useState<WeeklyInflationPoint[]>([]);
  const [officialPublication, setOfficialPublication] = React.useState<WeeklyInflationOfficialPublication | null>(null);
  const [hydrated, setHydrated] = React.useState(false);
  const [csvImportOpen, setCsvImportOpen] = React.useState(false);
  const [weeksTableOpen, setWeeksTableOpen] = React.useState(false);
  const [sourceStatusOpen, setSourceStatusOpen] = React.useState(false);

  const quickFormRef = React.useRef<HTMLFormElement>(null);
  const sourcesSectionRef = React.useRef<HTMLDivElement>(null);
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
  const showManualBadge = hasManualPoints(points);

  React.useEffect(() => {
    if (!hydrated) return;
    setWeeksTableOpen(hasData);
  }, [hydrated, hasData]);

  const sourceBadgeLabel = hasData
    ? showManualBadge
      ? "источник: ручной"
      : "источник: загружен"
    : "источник: не загружен";

  const pills = React.useMemo(() => {
    const items = [
      { label: "ЧЕРНОВИК", tone: "meta" as const },
      { label: "LAB", tone: "accent" as const },
      { label: sourceBadgeLabel, tone: "source" as const },
      { label: "ЦБ 4%", tone: "time" as const },
    ];
    if (officialPublication?.verifiedManually) {
      items.push({ label: "проверено вручную", tone: "source" as const });
    }
    return items;
  }, [sourceBadgeLabel, officialPublication?.verifiedManually]);

  const sorted = sortWeeklyInflationPoints(dashboard.points);
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.length >= 2 ? sorted.at(-2)! : null;
  const categoryRows = extractCategoryComparison(latest, previous);

  const scrollToQuickForm = React.useCallback(() => {
    quickFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      quickFormRef.current?.querySelector<HTMLInputElement>('input[type="date"]')?.focus();
    }, 200);
  }, []);

  const scrollToSources = React.useCallback(() => {
    sourcesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToCsvImport = React.useCallback(() => {
    setCsvImportOpen(true);
    window.setTimeout(() => {
      csvSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

        <InflationHeroPanel
          hasData={hasData}
          dashboard={dashboard}
          onAddWeek={scrollToQuickForm}
          onImportCsv={scrollToCsvImport}
          onShowSources={scrollToSources}
        />

        <InflationQuickWeekForm
          formRef={quickFormRef}
          points={points}
          onPointsChange={handlePointsChange}
        />

        <div ref={sourcesSectionRef}>
          <InflationDataSourcesGuide
            onInsertOfficialUrl={() => {
              setCsvImportOpen(true);
              window.setTimeout(() => {
                document.getElementById("weekly-inflation-official-url")?.focus();
              }, 120);
            }}
            onOpenCsvImport={scrollToCsvImport}
            onDownloadTemplate={downloadWeeklyInflationCsvTemplate}
          />
        </div>

        <InflationBriefingBridge hasData={hasData} />

        {hasData ? (
          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <InflationAnnualizedChart points={dashboard.points} />
              <InflationHeatmap points={dashboard.points} />
            </div>
            <InflationCategoryContribution categories={categoryRows} />
          </div>
        ) : null}

        <InflationMarketImpact dashboard={dashboard} />

        {showManualBadge ? (
          <div className="rounded-xl border border-lab-amber/25 bg-lab-amber/8 px-3 py-2 text-sm text-lab-amber">
            Ручные данные. Сверьте с официальным источником перед эфиром.
          </div>
        ) : null}

        <PreparationCollapsibleSection
          title="Последние недели"
          subtitle="Компактный список · до 10 строк"
          accent="cyan"
          defaultOpen={hasData}
          open={weeksTableOpen}
          onOpenChange={setWeeksTableOpen}
          badge={points.length > 0 ? `${points.length} нед.` : undefined}
        >
          <InflationRecentWeeksTable
            points={points}
            officialPublication={officialPublication}
            onDeleteWeek={handleDeleteWeek}
            embedded
          />
        </PreparationCollapsibleSection>

        <PreparationCollapsibleSection
          title="Расширенный импорт CSV"
          subtitle="Полный ряд · drag/drop · official URL"
          accent="violet"
          defaultOpen={false}
          open={csvImportOpen}
          onOpenChange={setCsvImportOpen}
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

        <PreparationCollapsibleSection
          title="Статус источников"
          subtitle="Росстат / Fedstat · эксперимент"
          accent="amber"
          defaultOpen={false}
          open={sourceStatusOpen}
          onOpenChange={setSourceStatusOpen}
        >
          <InflationSourceStatus
            dashboard={dashboard}
            officialPublication={officialPublication}
            onApplyFetchedPoints={handleApplyFetchedPoints}
            embedded
          />
        </PreparationCollapsibleSection>
      </div>
    </LabPageShell>
  );
}
