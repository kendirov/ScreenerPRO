"use client";

import * as React from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { LabPageShell } from "@/components/lab/lab-page-shell";
import { CorrelationFactorGrid } from "@/components/lab/correlation-lab/correlation-factor-grid";
import { CorrelationFactorInspector } from "@/components/lab/correlation-lab/correlation-factor-inspector";
import { CorrelationKpiStrip } from "@/components/lab/correlation-lab/correlation-kpi-strip";
import { CorrelationSourceStatus } from "@/components/lab/correlation-lab/correlation-source-status";
import { LabEmptyState, LabErrorState, LabLoadingState } from "@/components/lab/lab-ui";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { PreparationCollapsibleSection } from "@/components/lab/preparation/preparation-collapsible-section";
import type { CorrelationApiFactorId } from "@/lib/domain/correlation-api";
import { isOverviewEmpty } from "@/lib/domain/correlation-api-display";
import { useCorrelationOverview } from "@/lib/hooks/use-correlation-lab";

const PAGE_DESCRIPTION =
  "Кто связан с индексом, рублём, нефтью, золотом и внешним фоном";

export function CorrelationLabPage() {
  const overviewQuery = useCorrelationOverview();
  const [selectedId, setSelectedId] = React.useState<CorrelationApiFactorId | null>(null);
  const [sourcesOpen, setSourcesOpen] = React.useState(false);
  const inspectorRef = React.useRef<HTMLDivElement>(null);

  const overview = overviewQuery.data;
  const selectedFactor = overview?.factors.find((f) => f.id === selectedId) ?? null;

  const handleOpenFactor = React.useCallback((id: CorrelationApiFactorId) => {
    setSelectedId(id);
    window.setTimeout(() => {
      inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, []);

  const handleCheckSource = React.useCallback(() => {
    setSourcesOpen(true);
    window.setTimeout(() => {
      document.getElementById("correlation-sources")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  const pills = React.useMemo(
    () => [
      { label: "ЧЕРН.", tone: "meta" as const },
      { label: "LAB", tone: "accent" as const },
      { label: "MOEX ISS", tone: "source" as const },
      { label: "доходности", tone: "time" as const },
    ],
    [],
  );

  return (
    <LabPageShell title="Матрица связей" description={PAGE_DESCRIPTION} pills={pills}>
      <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => overviewQuery.refetch()}
          disabled={overviewQuery.isFetching}
          className="inline-flex items-center gap-1.5 rounded-lg border border-lab-border px-2.5 py-1.5 text-[11px] text-lab-muted transition hover:text-lab-text"
        >
          {overviewQuery.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          обновить расчёт
        </button>
      </div>

      {overviewQuery.isLoading ? (
        <LabLoadingState message="Считаем связи по свечам MOEX ISS…" />
      ) : null}

      {overviewQuery.isError ? (
        <LabErrorState
          message={
            overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Не удалось построить матрицу — повторите позже"
          }
        />
      ) : null}

      {overview && isOverviewEmpty(overview) && !overviewQuery.isLoading ? (
        <LabGlassPanel depth={30} className="relative overflow-hidden px-6 py-10 text-center">
          <div className="lab-accent-line absolute inset-x-0 top-0 opacity-45" aria-hidden />
          <div className="relative mx-auto max-w-lg">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-lab-violet/30 bg-lab-violet/10 shadow-[var(--lab-glow-violet)]">
              <Search className="h-7 w-7 text-lab-violet" />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-lab-text">История недостаточна</h2>
            <p className="mt-2 text-sm leading-relaxed text-lab-muted">
              Нужны свечи фактора и акций. MOEX ISS не вернул достаточно дневных close для ликвидных бумаг — без
              подстановки фейковых рядов.
            </p>
            <button
              type="button"
              onClick={handleCheckSource}
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-lab-cyan/35 bg-lab-cyan/12 px-3.5 py-2 text-sm text-lab-text shadow-[var(--lab-glow-cyan)] transition hover:bg-lab-cyan/18"
            >
              <Search className="h-4 w-4" />
              Проверить источник
            </button>
          </div>
        </LabGlassPanel>
      ) : null}

      {overview && !isOverviewEmpty(overview) && !overviewQuery.isLoading ? (
        <>
          {overview.warnings.length ? (
            <ul className="mb-3 space-y-1 rounded-xl border border-lab-amber/20 bg-lab-amber/5 px-3 py-2 text-[11px] text-lab-muted">
              {overview.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          ) : null}

          <CorrelationKpiStrip overview={overview} className="mb-3" />

          <CorrelationFactorGrid
            overview={overview}
            selectedId={selectedId}
            onOpenFactor={handleOpenFactor}
            onCheckSource={handleCheckSource}
          />

          <div ref={inspectorRef} className="mt-4">
            <CorrelationFactorInspector factor={selectedFactor} />
          </div>
        </>
      ) : null}

      <PreparationCollapsibleSection
        title="Источник данных"
        open={sourcesOpen}
        onOpenChange={setSourcesOpen}
        className="mt-4"
      >
        <div id="correlation-sources">
          <CorrelationSourceStatus embedded />
        </div>
      </PreparationCollapsibleSection>
    </LabPageShell>
  );
}
