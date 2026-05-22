"use client";

import * as React from "react";
import { volumeDepthPercent } from "@/lib/domain/order-book-ladder-model";
import { formatOrderBookVolume } from "@/lib/formatters/trading";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

export const BOOK_MODEL_DEPTH_SCALE = 20_000;
const LEVELS_PER_SIDE = 20;
export const BOOK_MODEL_ROW_HEIGHT_PX = 18;
const ROW_HEIGHT_PX = BOOK_MODEL_ROW_HEIGHT_PX;
export const BOOK_MODEL_SPREAD_ROW_PX = ROW_HEIGHT_PX + 4;
export const BOOK_MODEL_TOTAL_HEIGHT_PX = ROW_HEIGHT_PX * 40 + BOOK_MODEL_SPREAD_ROW_PX;

export type BookModelPricePreset = "tutorial" | "gazp";

export const BOOK_MODEL_PRICE_PRESETS: Record<
  BookModelPricePreset,
  { label: string; basePrice: number; tickSize: number }
> = {
  tutorial: { label: "Учебная цена", basePrice: 75.8, tickSize: 0.1 },
  gazp: { label: "GAZP demo", basePrice: 123.34, tickSize: 0.01 },
};

export type BookModelLevel = {
  price: number;
  volume: number;
  side: "ask" | "bid";
  isBest: boolean;
};

export type BookModelSnapshot = {
  asks: BookModelLevel[];
  bids: BookModelLevel[];
  bestAsk: number;
  bestBid: number;
  spread: number;
  tickSize: number;
};

function roundToTick(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}

function volumeForAskLevel(indexFromBest: number): number {
  if (indexFromBest === 3) return 10_000;
  const pattern = [
    1200, 800, 2500, 600, 1800, 500, 3200, 900, 1500, 700, 1100, 400, 2000, 650, 1400, 550, 900, 350, 750, 300,
  ];
  return pattern[indexFromBest] ?? 500;
}

function volumeForBidLevel(indexFromBest: number): number {
  if (indexFromBest === 5) return 20_000;
  const pattern = [
    900, 1500, 600, 2200, 1100, 500, 1800, 750, 1300, 450, 1000, 800, 1600, 550, 1200, 650, 950, 400, 700, 350,
  ];
  return pattern[indexFromBest] ?? 500;
}

export function buildBookModelSnapshot(preset: BookModelPricePreset): BookModelSnapshot {
  const { basePrice, tickSize } = BOOK_MODEL_PRICE_PRESETS[preset];
  const bestBid = roundToTick(basePrice, tickSize);
  const bestAsk = roundToTick(basePrice + tickSize, tickSize);

  const asks: BookModelLevel[] = [];
  for (let i = 0; i < LEVELS_PER_SIDE; i += 1) {
    const price = roundToTick(bestAsk + i * tickSize, tickSize);
    asks.push({
      price,
      volume: volumeForAskLevel(i),
      side: "ask",
      isBest: i === 0,
    });
  }

  const bids: BookModelLevel[] = [];
  for (let i = 0; i < LEVELS_PER_SIDE; i += 1) {
    const price = roundToTick(bestBid - i * tickSize, tickSize);
    bids.push({
      price,
      volume: volumeForBidLevel(i),
      side: "bid",
      isBest: i === 0,
    });
  }

  return {
    asks: asks.reverse(),
    bids,
    bestAsk,
    bestBid,
    spread: roundToTick(bestAsk - bestBid, tickSize),
    tickSize,
  };
}

export type WallTier = "normal" | "large" | "xlarge";

export function wallTier(volume: number): WallTier {
  if (volume >= 20_000) return "xlarge";
  if (volume >= 10_000) return "large";
  return "normal";
}

type BookModelRowProps = {
  level: BookModelLevel;
  depthScale?: number;
  flashHit?: boolean;
};

function BookModelRow({ level, depthScale = BOOK_MODEL_DEPTH_SCALE, flashHit = false }: BookModelRowProps) {
  const isAsk = level.side === "ask";
  const depthPct = volumeDepthPercent(level.volume, depthScale);
  const tier = wallTier(level.volume);
  const barAlpha = Math.min(0.92, Math.max(0.06, (depthPct / 100) * 0.88));

  const barColor =
    tier === "xlarge"
      ? `rgba(251, 191, 36, ${Math.min(0.85, barAlpha + 0.3)})`
      : tier === "large"
        ? `rgba(245, 158, 11, ${Math.min(0.72, barAlpha + 0.22)})`
        : isAsk
          ? `rgba(190, 24, 93, ${barAlpha})`
          : `rgba(5, 150, 105, ${barAlpha})`;

  return (
    <div
      className={cn(
        "book-model-row relative grid grid-cols-[minmax(0,1fr)_52px] items-stretch font-mono text-[10px] leading-none",
        isAsk ? "dom-row-ask book-model-row--ask" : "dom-row-bid book-model-row--bid",
        level.isBest && (isAsk ? "dom-row-best-ask" : "dom-row-best-bid"),
        tier !== "normal" && "dom-row-wall",
        tier === "xlarge" && "book-model-row--wall-xlarge",
        flashHit && (isAsk ? "dom-hit-ask book-model-flash" : "dom-hit-bid book-model-flash"),
      )}
      style={{ height: ROW_HEIGHT_PX, minHeight: ROW_HEIGHT_PX }}
    >
      <div className="relative flex min-w-0 items-center overflow-hidden pr-0.5">
        {level.volume > 0 ? (
          <>
            <div
              className={cn(
                "absolute inset-y-0 right-0",
                tier !== "normal" ? "dom-bar-wall" : isAsk ? "dom-bar-ask" : "dom-bar-bid",
              )}
              style={{ width: `${depthPct}%`, backgroundColor: barColor }}
            />
            <span
              className={cn(
                "relative z-[1] truncate pl-0.5 tabular-nums",
                tier !== "normal"
                  ? tier === "xlarge"
                    ? "font-bold text-amber-50"
                    : "font-semibold text-amber-100"
                  : isAsk
                    ? "text-rose-200/92"
                    : "text-emerald-300/92",
              )}
            >
              {formatOrderBookVolume(level.volume)}
            </span>
            {tier !== "normal" ? (
              <span className="relative z-[1] ml-1 shrink-0 text-[8px] uppercase tracking-wide text-amber-300/90">
                плотность
              </span>
            ) : null}
          </>
        ) : (
          <span className="pl-0.5 text-slate-800/70">·</span>
        )}
      </div>
      <span
        className={cn(
          "flex items-center justify-end pr-1 tabular-nums",
          level.isBest
            ? isAsk
              ? "font-semibold text-rose-50"
              : "font-semibold text-emerald-50"
            : isAsk
              ? "text-rose-200/85"
              : "text-emerald-200/85",
        )}
      >
        {formatPrice(level.price)}
      </span>
    </div>
  );
}

export type BookModelDepthScale = 10_000 | 20_000 | 50_000;

type SimpleOrderBookModelProps = {
  snapshot: BookModelSnapshot;
  className?: string;
  highlightBestAsk?: boolean;
  highlightBestBid?: boolean;
  highlightSpread?: boolean;
  depthScale?: BookModelDepthScale;
  presentation?: boolean;
};

export function SimpleOrderBookModel({
  snapshot,
  className,
  highlightBestAsk = false,
  highlightBestBid = false,
  highlightSpread = false,
  depthScale = BOOK_MODEL_DEPTH_SCALE,
  presentation = false,
}: SimpleOrderBookModelProps) {
  return (
    <div
      className={cn(
        "book-model-ladder dom-ladder flex min-w-0 flex-col",
        presentation && "book-model-ladder--presentation",
        className,
      )}
    >
      <div className="flex flex-col">
        {snapshot.asks.map((level) => (
          <BookModelRow
            key={`ask-${level.price}`}
            level={level}
            depthScale={depthScale}
            flashHit={level.isBest && highlightBestAsk}
          />
        ))}
      </div>
      <div
        className={cn(
          "dom-spread-band flex items-center justify-center border-y border-white/[0.06] font-mono text-[9px] text-slate-500",
          highlightSpread && "book-model-spread-highlight",
        )}
        style={{ minHeight: ROW_HEIGHT_PX + 4 }}
      >
        спред · {formatPrice(snapshot.spread)}
      </div>
      <div className="flex flex-col">
        {snapshot.bids.map((level) => (
          <BookModelRow
            key={`bid-${level.price}`}
            level={level}
            depthScale={depthScale}
            flashHit={level.isBest && highlightBestBid}
          />
        ))}
      </div>
    </div>
  );
}