"use client";

import * as React from "react";
import { AxisMarketMap } from "@/components/lab/market-map/axis-market-map";
import { GravityMarketMap } from "@/components/lab/market-map/gravity-market-map";
import { LabModePlaceholder, LabPageShell } from "@/components/lab/lab-page-shell";
import {
  buildLabSourcePills,
  LabErrorState,
  LabLoadingState,
  LAB_INSTRUMENT_LIMIT,
} from "@/components/lab/lab-ui";
import { MarketMapSummaryBar } from "@/components/lab/market-map-summary";
import { stockRowsToMarketLabNodes } from "@/lib/domain/market-lab";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildMarketMapSummary,
  buildMarketMapTiles,
  MARKET_MAP_MODE_LABELS,
  selectMarketMapTiles,
  type MarketMapMode,
} from "@/lib/domain/market-map";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { cn } from "@/lib/utils/cn";

type MarketMapViewMode = "bubbles" | "coordinates" | "signals";

const VIEW_MODE_LABELS: Record<MarketMapViewMode, string> = {
  bubbles: "Пузырьки",
  coordinates: "Координаты",
  signals: "Сигналы",
};

export function MarketMapPage() {
  const [viewMode, setViewMode] = React.useState<MarketMapViewMode>("bubbles");
  const [sizeMode, setSizeMode] = React.useState<MarketMapMode>("turnover");
  const query = useScreenerQuery("stock");

  const allTiles = React.useMemo(() => buildMarketMapTiles(query.data?.rows ?? []), [query.data?.rows]);
  const visibleTiles = React.useMemo(
    () => selectMarketMapTiles(allTiles, viewMode === "bubbles" ? sizeMode : "turnover"),
    [allTiles, sizeMode, viewMode],
  );
  const summary = React.useMemo(() => buildMarketMapSummary(allTiles), [allTiles]);

  const coordinateNodes = React.useMemo(() => {
    const tickers = new Set(visibleTiles.map((tile) => tile.ticker));
    return stockRowsToMarketLabNodes(query.data?.rows ?? []).filter((node) => tickers.has(node.ticker));
  }, [query.data?.rows, visibleTiles]);

  const onMapCount = viewMode === "coordinates" ? coordinateNodes.length : visibleTiles.length;
  const pills = buildLabSourcePills(query.data?.status, `на карте ${onMapCount} · лимит ${LAB_INSTRUMENT_LIMIT}`);

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
      title="Карта рынка"
      description="Карта оборота, движения и денежного импульса по акциям MOEX"
      pills={pills}
      modeControl={
        <div className="space-y-3">
          {viewModeControl}
          {sizeModeControl}
        </div>
      }
    >
      {viewMode === "bubbles" || viewMode === "coordinates" ? <MarketMapSummaryBar summary={summary} /> : null}

      {query.isLoading ? (
        <LabLoadingState message="Загрузка данных скринера…" />
      ) : query.isError ? (
        <LabErrorState message="Не удалось загрузить данные скринера. Повторите позже." />
      ) : (
        <>
          {viewMode === "bubbles" ? <GravityMarketMap tiles={visibleTiles} sizeMode={sizeMode} /> : null}
          {viewMode === "coordinates" ? <AxisMarketMap nodes={coordinateNodes} /> : null}
          {viewMode === "signals" ? (
            <LabModePlaceholder
              title="Режим «Сигналы»"
              description="Слой торговых сигналов и in-play на карте рынка. Компонент в разработке."
            />
          ) : null}
        </>
      )}
    </LabPageShell>
  );
}
