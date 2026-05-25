"use client";

import * as React from "react";
import { AxisMarketMap } from "@/components/lab/market-map/axis-market-map";
import { FlowMapSummaryBar } from "@/components/lab/market-map/flow-map-summary";
import { MarketFlowMap } from "@/components/lab/market-map/market-flow-map";
import { GravityMarketMap } from "@/components/lab/market-map/gravity-market-map";
import { LabPageShell } from "@/components/lab/lab-page-shell";
import {
  buildLabSourcePills,
  LabErrorState,
  LabLoadingState,
  LAB_INSTRUMENT_LIMIT,
} from "@/components/lab/lab-ui";
import { MarketMapSummaryBar } from "@/components/lab/market-map-summary";
import { buildMarketFlowNodes, buildMarketFlowSummary, hasFlowYesterdayComparison, type FlowCompareMode } from "@/lib/domain/market-flow-map";
import { stockRowsToMarketLabNodes } from "@/lib/domain/market-lab";
import {
  buildMarketMapSummary,
  buildMarketMapTiles,
  MARKET_MAP_MODE_LABELS,
  selectMarketMapTiles,
  type MarketMapMode,
} from "@/lib/domain/market-map";
import { useMarketFlowYesterdayQuery } from "@/lib/hooks/use-market-flow-yesterday-query";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { yesterdayItemsToMap } from "@/lib/domain/market-flow-map";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/cn";

type MarketMapViewMode = "flows" | "coordinates" | "bubbles";

const VIEW_MODE_LABELS: Record<MarketMapViewMode, string> = {
  flows: "Потоки",
  coordinates: "Координаты",
  bubbles: "Пузырьки",
};

export function MarketMapPage() {
  const [viewMode, setViewMode] = React.useState<MarketMapViewMode>("flows");
  const [sizeMode, setSizeMode] = React.useState<MarketMapMode>("turnover");
  const query = useScreenerQuery("stock");

  const allTiles = React.useMemo(() => buildMarketMapTiles(query.data?.rows ?? []), [query.data?.rows]);
  const visibleTiles = React.useMemo(
    () => selectMarketMapTiles(allTiles, viewMode === "bubbles" ? sizeMode : "turnover"),
    [allTiles, sizeMode, viewMode],
  );
  const summary = React.useMemo(() => buildMarketMapSummary(allTiles), [allTiles]);

  const flowTickerCandidates = React.useMemo(() => {
    return [...allTiles]
      .sort((a, b) => (b.turnoverRub ?? 0) - (a.turnoverRub ?? 0))
      .slice(0, LAB_INSTRUMENT_LIMIT)
      .map((tile) => tile.ticker);
  }, [allTiles]);

  const yesterdayQuery = useMarketFlowYesterdayQuery(flowTickerCandidates, viewMode === "flows");

  const yesterdayMap = React.useMemo(
    () => yesterdayItemsToMap(yesterdayQuery.data?.items ?? []),
    [yesterdayQuery.data?.items],
  );

  const flowNodes = React.useMemo(() => {
    const rows = query.data?.rows ?? [];
    if (viewMode !== "flows") {
      return buildMarketFlowNodes(rows, undefined, LAB_INSTRUMENT_LIMIT);
    }
    return buildMarketFlowNodes(rows, yesterdayMap.size ? yesterdayMap : undefined, LAB_INSTRUMENT_LIMIT);
  }, [query.data?.rows, viewMode, yesterdayMap]);

  const flowSummary = React.useMemo(() => buildMarketFlowSummary(flowNodes), [flowNodes]);

  const yesterdayAvailable = React.useMemo(() => hasFlowYesterdayComparison(flowNodes), [flowNodes]);
  const [compareMode, setCompareMode] = React.useState<FlowCompareMode>("today");
  const userPickedCompare = React.useRef(false);

  React.useEffect(() => {
    if (userPickedCompare.current || yesterdayQuery.isLoading) return;
    setCompareMode(yesterdayAvailable ? "vs-yesterday" : "today");
  }, [yesterdayAvailable, yesterdayQuery.isLoading]);

  const handleCompareModeChange = React.useCallback((mode: FlowCompareMode) => {
    userPickedCompare.current = true;
    setCompareMode(mode);
  }, []);

  const coordinateNodes = React.useMemo(() => {
    const tickers = new Set(visibleTiles.map((tile) => tile.ticker));
    return stockRowsToMarketLabNodes(query.data?.rows ?? []).filter((node) => tickers.has(node.ticker));
  }, [query.data?.rows, visibleTiles]);

  const onMapCount =
    viewMode === "flows" ? flowNodes.length : viewMode === "coordinates" ? coordinateNodes.length : visibleTiles.length;

  const pills = buildLabSourcePills(query.data?.status, `на карте ${onMapCount}`);

  const viewModeControl = (
    <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as MarketMapViewMode)}>
      <TabsList className="h-9 w-fit rounded-lg border border-white/5 bg-black/35 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {(Object.keys(VIEW_MODE_LABELS) as MarketMapViewMode[]).map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className={cn(
              "rounded-md px-3 text-xs text-slate-400 data-[state=active]:bg-violet-950/50 data-[state=active]:text-violet-100",
            )}
          >
            {VIEW_MODE_LABELS[key]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  const sizeModeControl =
    viewMode === "bubbles" ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Размер пузыря</span>
        <Tabs value={sizeMode} onValueChange={(value) => setSizeMode(value as MarketMapMode)}>
          <TabsList className="h-8 rounded-lg border border-white/5 bg-black/25 p-0.5">
            {(Object.keys(MARKET_MAP_MODE_LABELS) as MarketMapMode[]).map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="h-7 rounded-md px-2.5 text-[11px] text-slate-500 data-[state=active]:bg-slate-800/80 data-[state=active]:text-slate-100"
              >
                {MARKET_MAP_MODE_LABELS[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    ) : null;

  return (
    <LabPageShell
      title="Карта потоков · Карта рынка"
      description="Деньги, движение и сдвиги относительно вчера — интрадей-обзор MOEX"
      pills={pills}
      modeControl={
        <div className="space-y-3">
          {viewModeControl}
          {sizeModeControl}
        </div>
      }
    >
      {viewMode === "flows" ? <FlowMapSummaryBar summary={flowSummary} /> : null}
      {viewMode === "bubbles" || viewMode === "coordinates" ? <MarketMapSummaryBar summary={summary} /> : null}

      {query.isLoading ? (
        <LabLoadingState message="Загрузка данных скринера…" />
      ) : query.isError ? (
        <LabErrorState message="Не удалось загрузить данные скринера. Повторите позже." />
      ) : (
        <>
          {viewMode === "flows" ? (
            <MarketFlowMap
              nodes={flowNodes}
              yesterdayLoading={yesterdayQuery.isLoading || yesterdayQuery.isFetching}
              compareMode={compareMode}
              onCompareModeChange={handleCompareModeChange}
              yesterdayAvailable={yesterdayAvailable}
            />
          ) : null}
          {viewMode === "bubbles" ? <GravityMarketMap tiles={visibleTiles} sizeMode={sizeMode} /> : null}
          {viewMode === "coordinates" ? <AxisMarketMap nodes={coordinateNodes} /> : null}
        </>
      )}
    </LabPageShell>
  );
}
