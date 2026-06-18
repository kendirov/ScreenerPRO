"use client";

import * as React from "react";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { cn } from "@/lib/utils/cn";
import { buildPriceRiskScaleLayout } from "@/lib/domain/price-risk-scale-layout";
import {
  formatLeverageX,
  formatPercentFixed,
  formatPrice,
  type PositionSide,
} from "@/lib/domain/perpetual-leverage";

export type PriceRiskScaleProps = {
  entryPrice: number;
  liquidationPrice: number;
  direction: PositionSide;
  leverage: number;
  liquidationDistancePercent: number;
  stopPrice?: number;
  showStop?: boolean;
  size?: "default" | "large";
  className?: string;
};

type MarkerKind = "entry" | "stop" | "liq";

function ScaleMarker({
  kind,
  pct,
  price,
  label,
  labelPosition,
  large,
}: {
  kind: MarkerKind;
  pct: number;
  price: number;
  label: string;
  labelPosition: "above" | "below";
  large?: boolean;
}) {
  const styles: Record<MarkerKind, { stem: string; dot: string; label: string }> = {
    entry: { stem: "bg-cyan-400/80", dot: "border-cyan-300/70 bg-cyan-400/95", label: "text-cyan-200" },
    stop: { stem: "bg-amber-400/75", dot: "border-amber-300/60 bg-amber-400/90", label: "text-amber-200" },
    liq: { stem: "bg-rose-500/85", dot: "border-rose-400/70 bg-rose-500/95", label: "text-rose-200" },
  };
  const s = styles[kind];
  const stemH = large ? "h-12" : "h-7";
  const dotSz = large ? "h-3 w-3" : "h-2 w-2";

  return (
    <div className="absolute top-1/2 z-30 -translate-y-1/2" style={{ left: `${pct}%` }}>
      <div className="relative -translate-x-1/2">
        {labelPosition === "above" ? (
          <div className={cn("pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 text-center", s.label)}>
            <p className={cn("font-medium uppercase tracking-[0.14em]", large ? "text-[11px]" : "text-[9px]")}>{label}</p>
            <p className={cn("lab-number mt-0.5 text-slate-300", large ? "text-sm font-semibold" : "text-[10px]")}>{formatPrice(price)}</p>
          </div>
        ) : null}
        <div className="relative flex flex-col items-center">
          <div className={cn(stemH, "w-px -translate-y-full", s.stem)} aria-hidden />
          <div className={cn("relative rounded-full border", dotSz, s.dot, kind === "entry" && "ring-1 ring-cyan-400/30 ring-offset-2 ring-offset-black")} />
        </div>
        {labelPosition === "below" ? (
          <div className={cn("pointer-events-none absolute top-full left-1/2 mt-2 w-max -translate-x-1/2 text-center", s.label)}>
            <p className={cn("font-medium uppercase tracking-[0.14em]", large ? "text-[11px]" : "text-[9px]")}>{label}</p>
            <p className={cn("lab-number mt-0.5 text-slate-300", large ? "text-sm font-semibold" : "text-[10px]")}>{formatPrice(price)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ZoneLayer({
  segment,
  className,
  style,
}: {
  segment: { leftPct: number; widthPct: number };
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("absolute inset-y-0", className)}
      style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%`, ...style }}
      aria-hidden
    />
  );
}

export function PriceRiskScale({
  entryPrice,
  liquidationPrice,
  direction,
  leverage,
  liquidationDistancePercent,
  stopPrice,
  showStop = false,
  size = "default",
  className,
}: PriceRiskScaleProps) {
  const large = size === "large";
  const effectiveStop = stopPrice ?? entryPrice;
  const liquidationInactive = leverage <= 1;

  const layout = React.useMemo(
    () =>
      buildPriceRiskScaleLayout({
        entryPrice,
        stopPrice: effectiveStop,
        liquidationPrice,
        direction,
        leverage,
        liquidationDistancePercent,
      }),
    [entryPrice, effectiveStop, liquidationPrice, direction, leverage, liquidationDistancePercent],
  );

  const liqGlowOpacity = 0.2 + layout.liqGlowStrength * 0.45;

  return (
    <LabGlassPanel
      depth={30}
      className={cn(
        "perp-lab-panel price-risk-scale flex flex-col",
        large ? "min-h-[320px] p-5 sm:min-h-[360px] sm:p-6" : "min-h-[260px] p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className={cn("font-medium text-slate-400", large ? "text-xs uppercase tracking-[0.14em]" : "text-[11px]")}>
          {direction === "long" ? "Цена падает → ликвидация" : "Цена растёт → ликвидация"}
        </p>
        <p className={cn("lab-number font-semibold", layout.tightLiquidation ? "text-rose-300" : "text-slate-200", large ? "text-lg" : "text-sm")}>
          {liquidationInactive ? "—" : formatPercentFixed(liquidationDistancePercent, 1)}
        </p>
      </div>

      <div className={cn("relative flex-1", large ? "pb-14 pt-16" : "pb-10 pt-12")}>
        <div className={cn("relative rounded-lg border border-white/[0.08] bg-black", large ? "h-24 sm:h-28" : "h-14")}>
          <ZoneLayer segment={layout.profitZone} className="bg-emerald-500/[0.05]" />
          <ZoneLayer segment={layout.liquidationZone} className={cn("bg-rose-600/[0.1]", layout.tightLiquidation && "bg-rose-600/[0.16]")} style={layout.tightLiquidation ? { boxShadow: `inset 0 0 32px rgba(244,63,94,${liqGlowOpacity})` } : undefined} />

          {layout.tightLiquidation ? (
            <div
              className={cn("pointer-events-none absolute inset-y-0 z-10", layout.tightLiquidation && "price-risk-scale-liq-pulse")}
              style={{
                left: `${Math.max(0, layout.liqPct - 3)}%`,
                width: `${Math.min(100, 10 + layout.liqGlowStrength * 8)}%`,
                background: `radial-gradient(ellipse at center, rgba(244,63,94,${liqGlowOpacity * 0.3}) 0%, transparent 72%)`,
              }}
              aria-hidden
            />
          ) : null}

          <div className="absolute inset-x-0 top-1/2 z-20 h-px -translate-y-1/2 bg-gradient-to-r from-rose-500/25 via-slate-600/20 to-emerald-500/20" aria-hidden />

          <ScaleMarker kind="entry" pct={layout.entryPct} price={entryPrice} label="Вход" labelPosition="above" large={large} />
          {showStop && stopPrice != null ? (
            <ScaleMarker kind="stop" pct={layout.stopPct} price={stopPrice} label="Стоп" labelPosition="below" large={large} />
          ) : null}
          {!liquidationInactive ? (
            <ScaleMarker
              kind="liq"
              pct={layout.liqPct}
              price={liquidationPrice}
              label="Ликвидация"
              labelPosition={direction === "long" ? "below" : "above"}
              large={large}
            />
          ) : null}
        </div>

        <div className="mt-3 flex justify-between lab-number text-[10px] text-slate-600">
          <span>{formatPrice(layout.min)}</span>
          <span className="text-slate-500">{formatLeverageX(leverage)}</span>
          <span>{formatPrice(layout.max)}</span>
        </div>
      </div>
    </LabGlassPanel>
  );
}
