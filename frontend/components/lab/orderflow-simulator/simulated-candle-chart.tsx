"use client";

import type { FootprintChartMarker } from "@/lib/domain/footprint-model";
import type { CandleTimeframeMinutes, ScenarioAnnotation } from "@/lib/domain/orderflow-simulator-engine";
import type { SimCandle } from "@/lib/domain/orderflow-simulator";
import type { PriceViewport } from "@/lib/domain/orderflow-price-viewport";
import { formatViewportPrice } from "@/lib/domain/orderflow-price-viewport";
import { formatPrice } from "@/lib/formatters/number";
import { cn } from "@/lib/utils/cn";

type SimulatedCandleChartProps = {
  candles: SimCandle[];
  currentPrice: number;
  timeframe: CandleTimeframeMinutes;
  symbol?: string;
  annotations?: ScenarioAnnotation[];
  footprintMarkers?: FootprintChartMarker[];
  presentation?: boolean;
  terminal?: boolean;
  priceViewport?: PriceViewport;
  className?: string;
};

const CHART_HEIGHT_DEFAULT = 280;
const CHART_HEIGHT_PRESENTATION = 360;
const VOLUME_HEIGHT = 72;
const PADDING = { top: 12, right: 52, bottom: 8, left: 8 };

export function SimulatedCandleChart({
  candles,
  currentPrice,
  timeframe,
  symbol = "GAZP",
  annotations = [],
  footprintMarkers = [],
  presentation = false,
  terminal = false,
  priceViewport,
  className,
}: SimulatedCandleChartProps) {
  const CHART_HEIGHT = presentation ? CHART_HEIGHT_PRESENTATION : terminal ? 320 : CHART_HEIGHT_DEFAULT;
  const visibleCandles = candles.slice(-36);

  if (visibleCandles.length === 0) {
    return (
      <div className={cn("flex min-h-[360px] items-center justify-center text-sm text-slate-500", className)}>
        Нет симулированных свечей — сделки сформируют график
      </div>
    );
  }

  const width = 720;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const volumeTop = CHART_HEIGHT + 12;
  const totalHeight = volumeTop + VOLUME_HEIGHT;

  const lows = visibleCandles.map((c) => c.low);
  const highs = visibleCandles.map((c) => c.high);
  const useViewport = Boolean(terminal && priceViewport);
  const minPrice = useViewport ? priceViewport!.minPrice : Math.min(...lows, currentPrice) - 0.04;
  const maxPrice = useViewport ? priceViewport!.maxPrice : Math.max(...highs, currentPrice) + 0.04;
  const priceRange = maxPrice - minPrice || 1;
  const maxVolume = Math.max(...visibleCandles.map((c) => c.volume), 1);
  const candleWidth = Math.min(14, (width - PADDING.left - PADDING.right) / visibleCandles.length - 2);
  const slotWidth = (width - PADDING.left - PADDING.right) / visibleCandles.length;

  const priceToY = (price: number) => {
    if (useViewport) {
      return PADDING.top + priceViewport!.priceToY(price) * plotHeight;
    }
    return PADDING.top + ((maxPrice - price) / priceRange) * plotHeight;
  };
  const currentY = priceToY(currentPrice);

  const gridLines = useViewport
    ? priceViewport!.prices.filter((_, index, arr) => {
        const step = Math.max(1, Math.floor(arr.length / 5));
        return index % step === 0;
      })
    : null;

  const highlightPrices = annotations
    .filter((a) => typeof a.price === "number")
    .map((a) => a.price as number);

  return (
    <div className={cn("relative flex h-full min-h-0 flex-col", className)}>
      {terminal ? (
        <div className="pointer-events-none absolute left-1.5 top-0.5 z-10 font-mono text-[9px] tabular-nums text-slate-500">
          <span className="text-slate-300">{symbol}</span>
          <span className="text-slate-600"> · </span>
          <span>{timeframe}м</span>
          <span className="text-slate-600"> · </span>
          <span className="text-amber-200/70">симуляция</span>
        </div>
      ) : null}
      {!terminal ? (
        <div className="mb-1 flex items-center justify-end gap-2 px-1">
          <span className="font-mono text-[10px] text-slate-500">таймфрейм {timeframe}м · симуляция</span>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${totalHeight}`}
        className={cn("w-full", terminal ? "min-h-0 flex-1" : "h-auto")}
        role="img"
        aria-label={`Симулированный свечной график GAZP, ${timeframe} минут`}
      >
        <rect x={0} y={0} width={width} height={CHART_HEIGHT} fill={terminal || presentation ? "#020408" : "#060a14"} rx={terminal ? 0 : 4} />

        {gridLines
          ? gridLines.map((price) => {
              const y = priceToY(price);
              return (
                <g key={`grid-${price}`}>
                  <line
                    x1={PADDING.left}
                    y1={y}
                    x2={width - PADDING.right}
                    y2={y}
                    stroke="rgba(148,163,184,0.08)"
                    strokeDasharray="4 6"
                  />
                  <text x={width - PADDING.right + 6} y={y + 3} fill="rgba(148,163,184,0.55)" fontSize={9}>
                    {formatViewportPrice(price, priceViewport!.tickSize)}
                  </text>
                </g>
              );
            })
          : [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const price = minPrice + priceRange * (1 - ratio);
              const y = PADDING.top + ratio * plotHeight;
              return (
                <g key={ratio}>
                  <line
                    x1={PADDING.left}
                    y1={y}
                    x2={width - PADDING.right}
                    y2={y}
                    stroke="rgba(148,163,184,0.08)"
                    strokeDasharray="4 6"
                  />
                  <text x={width - PADDING.right + 6} y={y + 3} fill="rgba(148,163,184,0.55)" fontSize={9}>
                    {formatPrice(price)}
                  </text>
                </g>
              );
            })}

        {terminal ? (
          <>
            <line
              x1={PADDING.left}
              y1={currentY}
              x2={width - PADDING.right}
              y2={currentY}
              stroke="rgba(56,189,248,0.22)"
              strokeWidth={5}
            />
            <line
              x1={PADDING.left}
              y1={currentY}
              x2={width - PADDING.right}
              y2={currentY}
              stroke="rgba(56,189,248,0.85)"
              strokeWidth={1.4}
            />
          </>
        ) : (
          <line
            x1={PADDING.left}
            y1={currentY}
            x2={width - PADDING.right}
            y2={currentY}
            stroke={presentation ? "rgba(56,189,248,0.95)" : "rgba(56,189,248,0.75)"}
            strokeWidth={presentation ? 1.8 : 1.4}
            strokeDasharray="4 4"
          />
        )}

        {highlightPrices.map((price, index) => {
          const y = priceToY(price);
          const ann = annotations.find((a) => a.price === price);
          return (
            <g key={`hl-${price}-${index}`}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={width - PADDING.right}
                y2={y}
                stroke="rgba(251,191,36,0.35)"
                strokeWidth={1}
                strokeDasharray="6 4"
              />
              {ann ? (
                <text x={PADDING.left + 4} y={y - 4} fill="rgba(251,191,36,0.85)" fontSize={8}>
                  {ann.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {footprintMarkers.map((marker, index) => {
          const y = priceToY(marker.price);
          if (y < PADDING.top || y > CHART_HEIGHT - PADDING.bottom) return null;
          const stroke =
            marker.kind === "absorption-buy"
              ? "rgba(34,211,238,0.55)"
              : marker.kind === "absorption-sell"
                ? "rgba(251,191,36,0.55)"
                : "rgba(148,163,184,0.45)";
          return (
            <g key={`fp-${marker.price}-${index}`}>
              <line x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} stroke={stroke} strokeWidth={0.8} strokeDasharray="2 3" />
              <text
                x={width - PADDING.right - 2}
                y={y - 3}
                textAnchor="end"
                fill={stroke}
                fontSize={7}
              >
                {marker.kind === "high-volume" ? "◆" : "◇"} {marker.label}
              </text>
            </g>
          );
        })}

        {visibleCandles.map((candle, index) => {
          const x = PADDING.left + index * slotWidth + slotWidth / 2;
          const isUp = candle.close >= candle.open;
          const bodyTop = priceToY(Math.max(candle.open, candle.close));
          const bodyBottom = priceToY(Math.min(candle.open, candle.close));
          const bodyHeight = Math.max(bodyBottom - bodyTop, 1.2);
          const wickTop = priceToY(candle.high);
          const wickBottom = priceToY(candle.low);
          const color = isUp ? "#22c55e" : "#ef4444";
          const isLast = index === visibleCandles.length - 1;

          return (
            <g key={candle.timestamp} opacity={isLast ? 1 : 0.92}>
              <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={color} strokeWidth={1} />
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                rx={0.5}
              />
            </g>
          );
        })}

        <rect x={0} y={volumeTop} width={width} height={VOLUME_HEIGHT} fill="#050810" rx={4} />
        {visibleCandles.map((candle, index) => {
          const x = PADDING.left + index * slotWidth + slotWidth / 2;
          const barHeight = (candle.volume / maxVolume) * (VOLUME_HEIGHT - 16);
          const isUp = candle.close >= candle.open;
          const color = isUp ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)";

          return (
            <rect
              key={`vol-${candle.timestamp}`}
              x={x - candleWidth / 2}
              y={volumeTop + VOLUME_HEIGHT - 8 - barHeight}
              width={candleWidth}
              height={barHeight}
              fill={color}
              rx={0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
