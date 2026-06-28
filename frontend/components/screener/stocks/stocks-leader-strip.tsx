"use client";

import * as React from "react";
import type { RadarLeader } from "@/lib/screener/stocks-radar";
import { IN_GAME_COLUMN_SPLIT, StockTapeRow } from "@/components/screener/stocks/stock-tape-row";
import { RADAR_THRESHOLDS } from "@/lib/screener/radar-thresholds";
import { cn } from "@/lib/utils/cn";

type CardTone = "liquidity" | "in-play" | "volatility";

const LIQUIDITY_MAX = RADAR_THRESHOLDS.liquidity.cardDisplayMax;
const IN_GAME_MAX = RADAR_THRESHOLDS.inPlay.cardDisplayMax;
const VOLATILITY_MAX = RADAR_THRESHOLDS.volatility.cardDisplayMax;

const CARD_SHELL: Record<CardTone, string> = {
  liquidity: "border-cyan-500/22 bg-slate-950/60",
  "in-play": "border-amber-500/30 bg-slate-950/62 shadow-[inset_0_1px_0_rgba(251,191,36,0.1)]",
  volatility: "border-violet-500/22 bg-slate-950/60",
};

const TITLE_CLASS: Record<CardTone, string> = {
  liquidity: "text-cyan-200/90",
  "in-play": "text-amber-200/95",
  volatility: "text-violet-200/85",
};

function SideCard({
  title,
  tone,
  variant,
  leaders,
  emptyText,
  maxVisible,
  onClick,
  activeTicker,
}: {
  title: string;
  tone: Extract<CardTone, "liquidity" | "volatility">;
  variant: "liquidity" | "volatility";
  leaders: RadarLeader[];
  emptyText: string;
  maxVisible: number;
  onClick?: (ticker: string) => void;
  activeTicker?: string | null;
}) {
  const visible = leaders.slice(0, maxVisible);

  return (
    <div className={cn("overflow-hidden rounded border px-1 py-0.5", CARD_SHELL[tone])}>
      <p className={cn("px-0.5 text-[10px] font-medium", TITLE_CLASS[tone])}>{title}</p>
      <div className="mt-0.5 min-w-0 space-y-px">
        {visible.length ? (
          visible.map((l) => (
            <StockTapeRow
              key={l.row.ticker}
              row={l.row}
              variant={variant}
              onClick={onClick}
              active={activeTicker === l.row.ticker}
            />
          ))
        ) : (
          <p className="px-0.5 py-1 text-[10px] text-lab-text-dim">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function InGameColumn({
  rows,
  onClick,
  activeTicker,
  className,
}: {
  rows: RadarLeader[];
  onClick?: (ticker: string) => void;
  activeTicker?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 max-w-full space-y-px overflow-hidden", className)}>
      {rows.map((l) => (
        <StockTapeRow
          key={l.row.ticker}
          row={l.row}
          variant="inGame"
          showTurnover={false}
          onClick={onClick}
          active={activeTicker === l.row.ticker}
        />
      ))}
    </div>
  );
}

function InGameCard({
  leaders,
  shortlistCount,
  emptyText,
  onClick,
  activeTicker,
}: {
  leaders: RadarLeader[];
  shortlistCount: number;
  emptyText: string;
  onClick?: (ticker: string) => void;
  activeTicker?: string | null;
}) {
  const visible = leaders.slice(0, IN_GAME_MAX);
  const displayedCount = visible.length;
  const hiddenInTable = Math.max(shortlistCount - displayedCount, 0);
  const leftColumn = visible.slice(0, IN_GAME_COLUMN_SPLIT);
  const rightColumn = visible.slice(IN_GAME_COLUMN_SPLIT);
  const twoColumns = rightColumn.length > 0;

  return (
    <div className={cn("overflow-hidden rounded border border-t-2 px-1 py-0.5", CARD_SHELL["in-play"])}>
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <div className="flex items-baseline gap-1">
          <p className={cn("text-[10px] font-semibold", TITLE_CLASS["in-play"])}>В игре</p>
          {shortlistCount > 0 ? (
            <span className="font-mono text-[10px] tabular-nums text-amber-200/75">{shortlistCount}</span>
          ) : null}
        </div>
        {displayedCount > 0 ? (
          <span className="font-mono text-[9px] tabular-nums text-lab-text-dim/70">топ-{displayedCount}</span>
        ) : null}
      </div>

      {visible.length ? (
        <>
          {twoColumns ? (
            <>
              <div className="mt-0.5 hidden min-w-0 lg:grid lg:grid-cols-2 lg:gap-x-[18px]">
                <InGameColumn
                  rows={leftColumn}
                  onClick={onClick}
                  activeTicker={activeTicker}
                  className="pr-1"
                />
                <InGameColumn
                  rows={rightColumn}
                  onClick={onClick}
                  activeTicker={activeTicker}
                  className="border-l border-slate-400/[0.12] pl-4"
                />
              </div>
              <div className="mt-0.5 min-w-0 space-y-px overflow-hidden lg:hidden">
                {visible.map((l) => (
                  <StockTapeRow
                    key={l.row.ticker}
                    row={l.row}
                    variant="inGame"
                    showTurnover={false}
                    onClick={onClick}
                    active={activeTicker === l.row.ticker}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="mt-0.5 min-w-0 space-y-px overflow-hidden">
              {visible.map((l) => (
                <StockTapeRow
                  key={l.row.ticker}
                  row={l.row}
                  variant="inGame"
                  showTurnover="responsive"
                  onClick={onClick}
                  active={activeTicker === l.row.ticker}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="px-0.5 py-1 text-[10px] text-lab-text-dim">{emptyText}</p>
      )}

      {hiddenInTable > 0 ? (
        <p className="mt-1 px-0.5 text-[11px] text-lab-text-dim/70">ещё {hiddenInTable} в таблице</p>
      ) : null}
    </div>
  );
}

export function StocksLeaderStrip({
  liquidity,
  inPlay,
  inGameUniverseCount,
  volatility,
  onClick,
  activeTicker,
  className,
}: {
  liquidity: RadarLeader[];
  inPlay: RadarLeader[];
  inGameUniverseCount: number;
  volatility: RadarLeader[];
  onClick?: (ticker: string) => void;
  activeTicker?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-0.5 lg:grid-cols-[0.78fr_1.44fr_0.78fr]", className)}>
      <SideCard
        title="Ликвидность"
        tone="liquidity"
        variant="liquidity"
        leaders={liquidity}
        emptyText="нет данных"
        maxVisible={LIQUIDITY_MAX}
        onClick={onClick}
        activeTicker={activeTicker}
      />
      <InGameCard
        leaders={inPlay}
        shortlistCount={inGameUniverseCount}
        emptyText="нет активных"
        onClick={onClick}
        activeTicker={activeTicker}
      />
      <SideCard
        title="Волатильность"
        tone="volatility"
        variant="volatility"
        leaders={volatility}
        emptyText="нет движения"
        maxVisible={VOLATILITY_MAX}
        onClick={onClick}
        activeTicker={activeTicker}
      />
    </div>
  );
}
