"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FuturesFamilyTable } from "@/components/screener/futures-family-table";
import { FuturesAllTable } from "@/components/screener/futures-all-table";
import { ScreenerPageHeader, ScreenerPanel } from "@/components/screener/screener-page-chrome";
import { MarketStatusStrip } from "@/components/screener/market-now/market-status-strip";
import { MarketKpiCard } from "@/components/screener/market-now/market-kpi-card";
import { ScreenerPresetChips } from "@/components/screener/screener-preset-chips";
import { InstrumentQuickInspector } from "@/components/screener/instrument-quick-inspector";
import { cn } from "@/lib/utils/cn";
import { useScreenerQuery, isScreenerInitialLoading } from "@/lib/hooks/use-screener-query";
import {
  FUTURES_SCREENER_PRESETS,
  applyFuturesPreset,
  type FuturesPresetId,
} from "@/lib/domain/screener-presets";
import { buildFuturesBaseMap, inferFutureMarketSegment } from "@/lib/domain/screener-overview";
import { resolveScreenerEmptyState } from "@/lib/domain/screener-empty-state";

type FuturesViewMode = "groups" | "all";

export function FuturesScreenerPage() {
  const futuresQuery = useScreenerQuery("future");
  const isInitialLoading = isScreenerInitialLoading(futuresQuery);
  const allRows = futuresQuery.data?.rows ?? [];
  const status = futuresQuery.data?.status;
  const diagnostics = futuresQuery.data?.diagnostics;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [focusedTicker, setFocusedTicker] = React.useState<string | null>(null);

  const viewParam = searchParams.get("view");
  const mode: FuturesViewMode = viewParam === "groups" ? "groups" : "all";
  const presetParam = searchParams.get("preset") as FuturesPresetId | null;
  const activePreset = FUTURES_SCREENER_PRESETS.some((p) => p.id === presetParam) ? presetParam : null;

  const rows = React.useMemo(() => {
    if (!activePreset) return allRows;
    return applyFuturesPreset(allRows, activePreset);
  }, [allRows, activePreset]);

  const baseMap = React.useMemo(() => buildFuturesBaseMap(allRows), [allRows]);

  const presetCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const preset of FUTURES_SCREENER_PRESETS) {
      counts[preset.id] = applyFuturesPreset(allRows, preset.id).length;
    }
    return counts;
  }, [allRows]);

  const kpiActive = allRows.filter((r) => (r.turnover ?? 0) > 0 && (r.tradesCount ?? 0) > 50).length;
  const kpiFx = allRows.filter((r) => inferFutureMarketSegment(baseMap.get(r.ticker) ?? "", r.ticker) === "Валюта").length;
  const kpiIndex = allRows.filter((r) => inferFutureMarketSegment(baseMap.get(r.ticker) ?? "", r.ticker) === "Индекс").length;
  const kpiCommodity = allRows.filter((r) => {
    const seg = inferFutureMarketSegment(baseMap.get(r.ticker) ?? "", r.ticker);
    return seg === "Нефть" || seg === "Металл";
  }).length;

  const selectedRow = rows.find((r) => r.ticker === focusedTicker) ?? null;

  const emptyState = resolveScreenerEmptyState({
    isLoading: isInitialLoading,
    error: Boolean(futuresQuery.error),
    status,
    diagnostics,
    visibleCount: rows.length,
    apiRowCount: allRows.length,
  });

  React.useEffect(() => {
    if (!viewParam) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("view", "all");
      router.replace(`${pathname}?${next.toString()}`);
    }
  }, [pathname, router, searchParams, viewParam]);

  function setMode(nextMode: FuturesViewMode) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", nextMode);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function setPreset(id: FuturesPresetId) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("preset", id);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function resetPreset() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("preset");
    router.replace(next.size ? `${pathname}?${next.toString()}` : pathname);
  }

  return (
    <div className="space-y-2">
      <ScreenerPageHeader
        title="Рынок · Фьючерсы"
        right={
          <MarketStatusStrip
            status={status}
            diagnostics={diagnostics}
            isLoading={isInitialLoading}
            visibleCount={rows.length}
            instrumentLabel="контрактов"
          />
        }
      >
        <div className="inline-flex rounded-lg border border-lab-border-soft bg-lab-surface-1 p-0.5">
          <button
            type="button"
            onClick={() => setMode("all")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs transition",
              mode === "all"
                ? "lab-chip-active border-transparent bg-lab-cyan/12 text-lab-cyan shadow-none"
                : "text-lab-text-muted hover:text-lab-text-main",
            )}
          >
            Все
          </button>
          <button
            type="button"
            onClick={() => setMode("groups")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs transition",
              mode === "groups"
                ? "lab-chip-active border-transparent bg-lab-cyan/12 text-lab-cyan shadow-none"
                : "text-lab-text-muted hover:text-lab-text-main",
            )}
          >
            Группы
          </button>
        </div>
      </ScreenerPageHeader>

      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-5">
        <MarketKpiCard label="Активные" value={String(kpiActive)} tone="in_play" />
        <MarketKpiCard label="Топ оборота" value={allRows[0]?.ticker ?? "—"} tone="money" />
        <MarketKpiCard label="Валютные" value={String(kpiFx)} />
        <MarketKpiCard label="Индексные" value={String(kpiIndex)} />
        <MarketKpiCard label="Сырьё" value={String(kpiCommodity)} />
      </div>

      <ScreenerPanel className="py-1.5">
        <ScreenerPresetChips
          presets={FUTURES_SCREENER_PRESETS}
          activeId={activePreset}
          counts={presetCounts}
          onSelect={setPreset}
          onReset={resetPreset}
        />
      </ScreenerPanel>

      {emptyState && allRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-lab-border px-4 py-8 text-center">
          <p className="text-sm text-lab-muted">{emptyState.title}</p>
          <p className="mt-1 text-xs text-lab-dim">{emptyState.text}</p>
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div>
            {mode === "groups" ? (
              <FuturesFamilyTable rows={rows} />
            ) : (
              <FuturesAllTable
                rows={rows}
                onRowSelect={setFocusedTicker}
                highlightedTicker={focusedTicker}
              />
            )}
          </div>
          <InstrumentQuickInspector
            row={selectedRow}
            assetClass="future"
            onClose={() => setFocusedTicker(null)}
          />
        </div>
      )}
    </div>
  );
}
