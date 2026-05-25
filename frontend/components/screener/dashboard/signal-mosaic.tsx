"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import { MarketFocusCard } from "@/components/screener/market-focus-card";
import { formatAnomalyReason, formatTurnoverCompact } from "@/lib/domain/screener-overview";
import {
  screenerRowToFutureCard,
  screenerRowToStockCard,
  stockReasonTags,
} from "@/lib/domain/market-card-visual";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

interface SparklineLookup {
  get: (ticker: string) => number[] | null | undefined;
}

interface StockRadarMosaicProps {
  rows: ScreenerRow[];
  seriesByTicker: SparklineLookup;
}

const STOCK_GRID: Record<"hero" | "medium" | "compact", string> = {
  hero: "col-span-12 min-h-[9rem] lg:col-span-7 lg:row-span-2 lg:min-h-[11rem]",
  medium: "col-span-6 min-h-[6.5rem] lg:col-span-5 lg:min-h-[5rem]",
  compact: "min-w-[9.5rem]",
};

export function StockRadarMosaic({ rows, seriesByTicker }: StockRadarMosaicProps) {
  if (!rows.length) {
    return (
      <MarketFocusCard
        size="medium"
        type="stock"
        ticker="—"
        changePct={null}
        empty
        emptyTitle="Явных лидеров нет"
        emptyDescription="Радар обновится, когда появятся акции «в игре»"
        className="border-dashed"
      />
    );
  }

  const hero = rows[0]!;
  const medium = rows.slice(1, 3);
  const compact = rows.slice(3, 5);

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-12 gap-2.5">
        <StockTile row={hero} rank={1} size="hero" seriesByTicker={seriesByTicker} />
        {medium.map((row, i) => (
          <StockTile key={row.ticker} row={row} rank={i + 2} size="medium" seriesByTicker={seriesByTicker} />
        ))}
      </div>
      {compact.length > 0 ? (
        <div className="-mx-0.5 flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {compact.map((row, i) => (
            <StockTile key={row.ticker} row={row} rank={i + 4} size="compact" seriesByTicker={seriesByTicker} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StockTile({
  row,
  rank,
  size,
  seriesByTicker,
}: {
  row: ScreenerRow;
  rank: number;
  size: "hero" | "medium" | "compact";
  seriesByTicker: SparklineLookup;
}) {
  const base = screenerRowToStockCard(row, size);
  return (
    <MarketFocusCard
      {...base}
      rank={rank}
      sparklineValues={seriesByTicker.get(row.ticker) ?? null}
      turnover={formatTurnoverCompact(row.turnover)}
      trades={tradingFormat.formatInteger(row.tradesCount ?? null)}
      reasonTags={size === "compact" ? [formatAnomalyReason(row)] : stockReasonTags(row)}
      className={cn(STOCK_GRID[size])}
    />
  );
}

interface FuturesRadarMosaicProps {
  rows: ScreenerRow[];
  baseByTicker: Map<string, string>;
  seriesByTicker: SparklineLookup;
}

const FUTURE_GRID: Record<"hero" | "medium" | "compact", string> = {
  hero: "col-span-12 min-h-[8.5rem] lg:col-span-7 lg:row-span-2 lg:min-h-[10rem]",
  medium: "col-span-6 min-h-[6rem] lg:col-span-5 lg:min-h-[5rem]",
  compact: "min-w-[9.5rem]",
};

export function FuturesRadarMosaic({ rows, baseByTicker, seriesByTicker }: FuturesRadarMosaicProps) {
  if (!rows.length) {
    return (
      <MarketFocusCard
        size="medium"
        type="future"
        ticker="—"
        changePct={null}
        empty
        emptyTitle="Нет данных по фьючерсам"
        className="border-dashed"
      />
    );
  }

  const hero = rows[0]!;
  const medium = rows.slice(1, 3);
  const compact = rows.slice(3, 5);

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-12 gap-2.5">
        <FutureTile row={hero} rank={1} size="hero" baseByTicker={baseByTicker} seriesByTicker={seriesByTicker} />
        {medium.map((row, i) => (
          <FutureTile
            key={row.ticker}
            row={row}
            rank={i + 2}
            size="medium"
            baseByTicker={baseByTicker}
            seriesByTicker={seriesByTicker}
          />
        ))}
      </div>
      {compact.length > 0 ? (
        <div className="-mx-0.5 flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {compact.map((row, i) => (
            <FutureTile
              key={row.ticker}
              row={row}
              rank={i + 4}
              size="compact"
              baseByTicker={baseByTicker}
              seriesByTicker={seriesByTicker}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FutureTile({
  row,
  rank,
  size,
  baseByTicker,
  seriesByTicker,
}: {
  row: ScreenerRow;
  rank: number;
  size: "hero" | "medium" | "compact";
  baseByTicker: Map<string, string>;
  seriesByTicker: SparklineLookup;
}) {
  const baseLabel = baseByTicker.get(row.ticker) ?? row.shortName ?? "—";
  const props = screenerRowToFutureCard(row, size, baseLabel);
  return (
    <MarketFocusCard
      {...props}
      rank={rank}
      sparklineValues={seriesByTicker.get(row.ticker) ?? null}
      className={cn(FUTURE_GRID[size])}
    />
  );
}

/** @deprecated — используйте FuturesRadarMosaic */
export const FuturesFocusMosaic = FuturesRadarMosaic;
