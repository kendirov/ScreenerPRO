"use client";

import type { MarketCardSize, MarketCardState } from "@/lib/domain/market-card-visual";
import { MARKET_CARD_STATE_STYLES } from "@/lib/domain/market-card-visual";
import {
  RealSparkline,
  hasRealSparklineHistory,
  inferToneFromChange,
  type SparklineTone,
} from "@/components/screener/mini-sparkline";
import { cn } from "@/lib/utils/cn";

function stateToSparkTone(state: MarketCardState): SparklineTone {
  if (state === "positive") return "positive";
  if (state === "negative") return "negative";
  return "neutral";
}

/** Фон карточки: gradient glow + только реальная история (без декоративной синусоиды). */
export function CardSparklineBackdrop({
  sparklineValues,
  changePct,
  state,
  size = "hero",
  segmentGradient,
}: {
  sparklineValues?: number[] | null;
  changePct?: number | null;
  state: MarketCardState;
  size?: MarketCardSize;
  segmentGradient?: string;
}) {
  const hasHistory = hasRealSparklineHistory(sparklineValues);
  const styles = MARKET_CARD_STATE_STYLES[state];
  const tone = hasHistory ? inferToneFromChange(changePct) : stateToSparkTone(state);
  const variant = size === "compact" ? "inline" : "backdrop";

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-20 opacity-95",
          segmentGradient ?? styles.backdropGradient,
        )}
        aria-hidden
      />
      {hasHistory ? (
        <RealSparkline variant={variant} values={sparklineValues} tone={tone} />
      ) : null}
    </>
  );
}

/** @deprecated — используйте CardSparklineBackdrop внутри MarketFocusCard */
export function InstrumentCardVisual({
  sparklineValues,
  changePct,
  state = "neutral",
  size = "hero",
}: {
  row?: never;
  sparklineValues?: number[] | null;
  changePct?: number | null;
  state?: MarketCardState;
  size?: MarketCardSize;
  variant?: "inline" | "backdrop";
  showCaption?: boolean;
  captionClassName?: string;
}) {
  return (
    <CardSparklineBackdrop
      sparklineValues={sparklineValues}
      changePct={changePct}
      state={state}
      size={size}
    />
  );
}
