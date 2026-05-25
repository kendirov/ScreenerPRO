"use client";

import * as React from "react";
import { MarketRadar } from "@/components/screener/market-radar";
import { ScreenerPageHeader, ScreenerPanel } from "@/components/screener/screener-page-chrome";
import { ScreenerTable } from "@/components/screener/screener-table";
import { createStockColumns } from "@/components/screener/columns";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";

const ILLIQUID_RATIO = 0.02;
const ILLIQUID_TURNOVER_FLOOR = 35_000_000;
const ILLIQUID_MIN_TRADES = 1_200;

function tradingThresholdText(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(value)} ₽`;
}

export function StocksScreenerPage() {
  const [hideIlliquid, setHideIlliquid] = React.useState(true);
  const stocksQuery = useScreenerQuery("stock");

  const stocks = React.useMemo(() => {
    const rows = stocksQuery.data?.rows ?? [];
    const maxTurnoverNow = rows.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
    const illiquidThresholdTurnover = Math.max(maxTurnoverNow * ILLIQUID_RATIO, ILLIQUID_TURNOVER_FLOOR);
    if (!hideIlliquid) return rows;
    return rows.filter((row) => {
      const turnover = row.turnover ?? 0;
      const tradesCount = row.tradesCount ?? 0;
      const isIlliquid = turnover < illiquidThresholdTurnover && tradesCount < ILLIQUID_MIN_TRADES;
      return !isIlliquid;
    });
  }, [stocksQuery.data?.rows, hideIlliquid]);

  const illiquidHint = React.useMemo(() => {
    const rows = stocksQuery.data?.rows ?? [];
    const maxTurnoverNow = rows.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0);
    const threshold = Math.max(maxTurnoverNow * ILLIQUID_RATIO, ILLIQUID_TURNOVER_FLOOR);
    return tradingThresholdText(threshold);
  }, [stocksQuery.data?.rows]);

  const stockUniverse = stocksQuery.data?.rows ?? [];
  const imoexRangePct = stocksQuery.data?.benchmarks?.[0]?.dayRangePct ?? null;
  const status = stocksQuery.data?.status;

  const maxTurnover = React.useMemo(
    () => stockUniverse.reduce((max, row) => Math.max(max, row.turnover ?? 0), 0),
    [stockUniverse],
  );
  const columns = React.useMemo(() => createStockColumns(maxTurnover), [maxTurnover]);

  return (
    <div className="space-y-2">
      <ScreenerPageHeader
        title="Рынок · Акции"
        right={
          <>
            <span className="lab-chip">Показано {stocks.length}</span>
            <span className="lab-chip">
              <span className="text-lab-text-dim">обновлено </span>
              <span className="lab-number text-lab-text-main">
                {status ? new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU") : "—"}
              </span>
            </span>
          </>
        }
      />

      <div className="sticky top-[4.05rem] z-30 mb-2 space-y-2 border-b border-lab-border bg-lab-bg-deep/90 pb-1.5 backdrop-blur-md">
        <MarketRadar rows={stocks} allRows={stockUniverse} imoexRangePct={imoexRangePct} />
      </div>

      <ScreenerPanel className="mb-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="lab-chip inline-flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-lab-text-main">
              <input
                type="checkbox"
                checked={hideIlliquid}
                onChange={(event) => setHideIlliquid(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-lab-border-soft bg-lab-surface-1 accent-lab-green"
              />
              <span className="font-medium">Скрыть неликвиды</span>
            </label>
            <span className="lab-type-caption text-[11px]">
              &lt; 2% от лидера + слабая лента ({illiquidHint})
            </span>
          </div>
          <span className="lab-chip font-mono text-[11px] tabular-nums">Показано: {stocks.length}</span>
        </div>
      </ScreenerPanel>

      <ScreenerTable
        rows={stocks}
        columns={columns}
        emptyTitle={stocksQuery.isLoading ? "Загрузка акций..." : "Нет доступных акций"}
        emptyText={stocksQuery.error ? "MOEX временно недоступен. Используется fallback." : "По текущему фильтру ничего не найдено."}
      />
    </div>
  );
}
