"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { ScreenerBenchmark, ScreenerDataStatus, ScreenerRow } from "@screenerpro/shared";
import {
  buildRadarBoard,
  resolveRadarLiquidityTag,
  rowHasHistoricalBaseline,
} from "@/lib/domain/market-radar-selectors";
import type { MarketRadarReasonKey } from "@/lib/domain/market-radar-config";
import { RADAR_SECTION } from "@/lib/domain/radar-ui-labels";
import { RADAR_DISPLAY_LIMITS } from "@/components/screener/radar-display-limits";
import { RadarColumnShell } from "@/components/screener/radar-column-shell";
import { RadarHeader } from "@/components/screener/radar-header";
import { RadarMiniRow } from "@/components/screener/radar-mini-row";
import { RadarShotsColumn } from "@/components/screener/radar-shots-column";
import { RadarWorklistColumn } from "@/components/screener/radar-worklist-column";
import { ScreenerDateModeMessages, historicalFeatureMessage } from "@/lib/domain/screener-date-mode";
import { readMarketRadarDebugFromSearchParams, useMarketRadarDebugConsole } from "@/lib/hooks/use-market-radar-debug";

export function MarketRadar({
  rows,
  allRows,
  dataStatus,
  benchmarks,
  isLive = true,
  selectedTicker,
  onTickerSelect,
}: {
  rows: ScreenerRow[];
  allRows?: ScreenerRow[];
  dataStatus?: ScreenerDataStatus | null;
  benchmarks?: ScreenerBenchmark[];
  isLive?: boolean;
  selectedTicker?: string | null;
  onTickerSelect?: (ticker: string) => void;
}) {
  const stockRows = rows.filter((row) => row.assetClass === "stock");
  const stockUniverse = (allRows ?? rows).filter((row) => row.assetClass === "stock");
  const isHistorical = dataStatus?.dataMode === "historical";
  const radarRows = isHistorical ? stockUniverse : stockRows;
  const searchParams = useSearchParams();
  const debugRadar = readMarketRadarDebugFromSearchParams(searchParams);

  useMarketRadarDebugConsole(stockUniverse, radarRows, debugRadar);

  const board = React.useMemo(
    () => buildRadarBoard(stockUniverse, radarRows),
    [stockUniverse, radarRows],
  );

  const liquidity = board.liquidity.slice(0, RADAR_DISPLAY_LIMITS.liquidity);
  const inPlay = board.inPlay;
  const active = board.active.slice(0, Math.max(0, RADAR_DISPLAY_LIMITS.active - inPlay.length));
  const activeCandidateCount = board.active.length;
  const shots = board.volatility.slice(0, RADAR_DISPLAY_LIMITS.shots);
  const rankCtx = board.rankCtx;
  const inPlayTickerSet = rankCtx.inPlayTickerSet;

  const liquidityHistUnavailable = isHistorical && historicalFeatureMessage("liquidity") != null;
  const inPlayHistUnavailable = isHistorical && historicalFeatureMessage("inPlay") != null;
  const volatilityHistUnavailable = isHistorical && historicalFeatureMessage("volatility") != null;

  const handleTickerSelect = React.useCallback(
    (ticker: string) => {
      onTickerSelect?.(ticker);
    },
    [onTickerSelect],
  );

  const isSelected = React.useCallback(
    (ticker: string) => selectedTicker != null && selectedTicker === ticker,
    [selectedTicker],
  );

  const baselineMissing = React.useMemo(() => {
    if (isHistorical) return false;
    if (dataStatus?.baselineStatus === "skipped" || dataStatus?.baselineStatus === "error") return true;
    if (dataStatus?.degraded) return true;
    if (stockUniverse.length === 0) return false;
    const withBaseline = stockUniverse.filter(rowHasHistoricalBaseline).length;
    return withBaseline < stockUniverse.length * 0.25;
  }, [dataStatus, isHistorical, stockUniverse]);

  const liquidityTag = resolveRadarLiquidityTag();

  return (
    <section className="market-radar flex h-[260px] max-h-[280px] min-h-[240px] flex-col overflow-hidden rounded-xl border border-slate-800/40 bg-slate-950/50 p-2 backdrop-blur-md">
      <RadarHeader
        benchmarks={benchmarks}
        dataStatus={dataStatus}
        isLive={isLive}
        baselineMissing={baselineMissing}
        isHistorical={isHistorical}
        liqCount={liquidity.length}
        playCount={inPlay.length}
        actCount={active.length}
        shotCount={shots.length}
        compact
      />

      <div className="market-radar-grid mt-1.5 min-h-0 flex-1 grid gap-2 overflow-hidden">
        <RadarColumnShell
          title={RADAR_SECTION.liquidity.title}
          subtitle={RADAR_SECTION.liquidity.subtitle}
          hint={RADAR_SECTION.liquidity.hint}
          count={liquidity.length}
          className="market-radar-column--liquidity"
        >
          {liquidityHistUnavailable ? (
            <p className="px-1.5 py-1 text-[10px] text-slate-600">
              {ScreenerDateModeMessages.historicalBlockNotConnected}
            </p>
          ) : liquidity.length === 0 ? (
            <p className="px-1.5 py-1 text-[10px] text-slate-600">—</p>
          ) : (
            <ul className="divide-y divide-slate-800/40">
              {liquidity.map((row) => (
                <li key={row.ticker}>
                  <RadarMiniRow
                    row={row}
                    reasonKey={"liquidity" satisfies MarketRadarReasonKey}
                    variant="liquidity"
                    displayTag={liquidityTag}
                    onTickerSelect={onTickerSelect ? handleTickerSelect : undefined}
                    selected={isSelected(row.ticker)}
                  />
                </li>
              ))}
            </ul>
          )}
        </RadarColumnShell>

        <RadarWorklistColumn
          inPlayRows={inPlay}
          activeRows={active}
          activeCandidateCount={activeCandidateCount}
          inPlayTickerSet={inPlayTickerSet}
          rankCtx={rankCtx}
          historicalUnavailable={inPlayHistUnavailable}
          onTickerSelect={onTickerSelect ? handleTickerSelect : undefined}
          isSelected={isSelected}
        />

        <RadarShotsColumn
          rows={shots}
          rankCtx={rankCtx}
          historicalUnavailable={volatilityHistUnavailable}
          onTickerSelect={onTickerSelect ? handleTickerSelect : undefined}
          isSelected={isSelected}
        />
      </div>
    </section>
  );
}
