"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { CorrelationFactorControls } from "@/components/lab/correlation-lab/factor-detail/correlation-factor-controls";
import { CorrelationFactorHeader } from "@/components/lab/correlation-lab/factor-detail/correlation-factor-header";
import { CorrelationLensTabs } from "@/components/lab/correlation-lab/factor-detail/correlation-lens-tabs";
import { CorrelationPairInspector } from "@/components/lab/correlation-lab/factor-detail/correlation-pair-inspector";
import { CorrelationSignalQuadrants } from "@/components/lab/correlation-lab/factor-detail/correlation-signal-quadrants";
import { LabErrorState, LabLoadingState } from "@/components/lab/lab-ui";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import type { CorrelationApiFactorId, CorrelationApiInterval, CorrelationApiPeriod } from "@/lib/domain/correlation-api";
import { CORRELATION_API_FACTORS, parseCorrelationInterval } from "@/lib/domain/correlation-api";
import {
  type CorrelationLensTab,
  type CorrelationSortMode,
  type CorrelationWindowMode,
} from "@/lib/domain/correlation-factor-detail-display";
import { CORRELATION_FACTOR_THEMES, hasFactorData } from "@/lib/domain/correlation-api-display";
import { useCorrelationFactorDetail } from "@/lib/hooks/use-correlation-lab";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { cn } from "@/lib/utils/cn";

export function CorrelationFactorDetailPage({ factorId }: { factorId: CorrelationApiFactorId }) {
  const factorMeta = CORRELATION_API_FACTORS.find((f) => f.id === factorId)!;
  const theme = CORRELATION_FACTOR_THEMES[factorId];

  const [period, setPeriod] = React.useState<CorrelationApiPeriod>(20);
  const [interval, setInterval] = React.useState<CorrelationApiInterval>(24);
  const [windowMode, setWindowMode] = React.useState<CorrelationWindowMode>(60);
  const [sortMode, setSortMode] = React.useState<CorrelationSortMode>("strong");
  const [lensTab, setLensTab] = React.useState<CorrelationLensTab>("lens");
  const [selectedTicker, setSelectedTicker] = React.useState<string | null>(null);

  const effectiveInterval = React.useMemo(
    () => parseCorrelationInterval(String(interval), period),
    [interval, period],
  );

  const detailQuery = useCorrelationFactorDetail(factorId, period, effectiveInterval);
  const screenerQuery = useScreenerQuery("all");

  const turnoverByTicker = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const row of screenerQuery.data?.rows ?? []) {
      if (row.assetClass === "stock") map.set(row.ticker, row.turnover ?? 0);
    }
    return map;
  }, [screenerQuery.data?.rows]);

  const detail = detailQuery.data;
  const hasData = detail ? hasFactorData(detail.meta.dataStatus) : false;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/lab/correlation-lab"
          className="inline-flex items-center gap-1.5 text-[11px] text-lab-muted transition hover:text-lab-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Матрица связей
        </Link>
        <button
          type="button"
          onClick={() => detailQuery.refetch()}
          disabled={detailQuery.isFetching}
          className="inline-flex items-center gap-1.5 rounded-lg border border-lab-border px-2.5 py-1.5 text-[11px] text-lab-muted transition hover:text-lab-text"
        >
          {detailQuery.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          обновить
        </button>
      </div>

      <CorrelationFactorHeader
        title={factorMeta.title}
        meaning={factorMeta.meaning}
        theme={theme}
        proxyTicker={detail?.meta.proxyTicker ?? detail?.factor.proxyTicker ?? null}
        factorId={factorId}
        period={period}
        interval={effectiveInterval}
        updatedAt={detail?.meta.updatedAt ?? null}
        dataStatus={detail?.meta.dataStatus ?? "no-history"}
      />

      <CorrelationFactorControls
        period={period}
        interval={interval}
        windowMode={windowMode}
        sortMode={sortMode}
        onPeriodChange={(p) => {
          setPeriod(p);
          if (p >= 20) setInterval(24);
        }}
        onIntervalChange={setInterval}
        onWindowChange={setWindowMode}
        onSortChange={setSortMode}
        periodLockedInterval={period >= 20}
      />

      {detailQuery.isLoading ? (
        <LabLoadingState message="Загружаем связи по свечам MOEX ISS…" />
      ) : null}

      {detailQuery.isError ? (
        <LabErrorState
          message={
            detailQuery.error instanceof Error ? detailQuery.error.message : "Не удалось загрузить фактор"
          }
        />
      ) : null}

      {detail && !hasData && !detailQuery.isLoading ? (
        <LabGlassPanel depth={20} className="px-6 py-10 text-center">
          <p className="text-lg font-semibold text-lab-text">История недостаточна</p>
          <p className="mt-2 text-sm text-lab-muted">Нужны свечи фактора и акций — без подстановки данных</p>
        </LabGlassPanel>
      ) : null}

      {detail && hasData && !detailQuery.isLoading ? (
        <>
          <CorrelationSignalQuadrants detail={detail} windowMode={windowMode} theme={theme} />

          <div
            className={cn(
              "grid gap-3",
              selectedTicker ? "xl:grid-cols-[minmax(0,1fr)_minmax(320px,520px)]" : "",
            )}
          >
            <CorrelationLensTabs
              detail={detail}
              lensTab={lensTab}
              onLensTabChange={setLensTab}
              sortMode={sortMode}
              windowMode={windowMode}
              theme={theme}
              turnoverByTicker={turnoverByTicker}
              selectedTicker={selectedTicker}
              onSelectTicker={setSelectedTicker}
            />

            {selectedTicker ? (
              <CorrelationPairInspector
                factorId={factorId}
                stock={selectedTicker}
                period={period}
                interval={effectiveInterval}
                theme={theme}
                onClose={() => setSelectedTicker(null)}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
