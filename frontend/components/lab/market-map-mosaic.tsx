"use client";

import type { MarketMapMode, MarketMapTile } from "@/lib/domain/market-map";
import {
  marketMapCellClass,
  tileSubtitle,
  tileSurfaceStyle,
} from "@/lib/domain/market-map";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

interface MarketMapMosaicProps {
  tiles: MarketMapTile[];
  mode: MarketMapMode;
  selectedTicker: string | null;
  onSelect: (tile: MarketMapTile) => void;
}

export function MarketMapMosaic({ tiles, mode, selectedTicker, onSelect }: MarketMapMosaicProps) {
  if (!tiles.length) {
    return (
      <p className="rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-4 py-12 text-center text-sm text-slate-500">
        Нет данных для карты. Проверьте подключение к MOEX ISS.
      </p>
    );
  }

  const maxTrades = tiles.reduce((max, tile) => Math.max(max, tile.tradesCount ?? 0), 0);

  return (
    <div className="grid grid-cols-12 gap-2" role="list">
      {tiles.map((tile, index) => {
        const surface = tileSurfaceStyle(tile, mode, maxTrades);
        const isSelected = selectedTicker === tile.ticker;
        const isTop = index < 3;
        const subtitle = tileSubtitle(tile, mode);

        return (
          <button
            key={tile.ticker}
            type="button"
            role="listitem"
            onClick={() => onSelect(tile)}
            className={cn(
              "group relative flex flex-col rounded-xl border p-2.5 text-left transition duration-200",
              "backdrop-blur-xl hover:brightness-110",
              marketMapCellClass(index),
              isSelected && "ring-1 ring-violet-400/50 ring-offset-1 ring-offset-black/40",
            )}
            style={{
              background: surface.background,
              borderColor: surface.border,
              boxShadow: surface.glow === "none" ? undefined : surface.glow,
            }}
          >
            {isTop ? (
              <span className="absolute right-2 top-2 font-mono text-[9px] tabular-nums text-slate-500/80">#{index + 1}</span>
            ) : null}
            <div className="flex items-baseline justify-between gap-1 pr-6">
              <span className={cn("font-semibold tracking-wide text-slate-50", isTop ? "text-lg" : "text-sm")}>
                {tile.ticker}
              </span>
              <span className={cn("font-mono tabular-nums", isTop ? "text-sm" : "text-xs", surface.textPct)}>
                {tradingFormat.formatSignedPercent(tile.changePct)}
              </span>
            </div>
            <p className={cn("mt-1 font-mono tabular-nums text-slate-400", isTop ? "text-[11px]" : "text-[10px]")}>
              {formatTurnoverCompact(tile.turnoverRub)}
            </p>
            {subtitle ? (
              <p className="mt-0.5 text-[9px] uppercase tracking-wide text-slate-500/90">{subtitle}</p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
