"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  MARKET_CARD_STATE_STYLES,
  resolveFutureSegmentTheme,
  type MarketCardSize,
  type MarketCardState,
  type MarketCardType,
  type MarketFocusCardMetric,
  resolveMarketCardState,
} from "@/lib/domain/market-card-visual";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";
import { CardSparklineBackdrop } from "@/components/screener/instrument-card-visual";
import { ReasonTagRow } from "@/components/screener/reason-tag-chip";

export type MarketFocusCardProps = {
  size: MarketCardSize;
  type: MarketCardType;
  state?: MarketCardState;
  ticker: string;
  nameOrBase?: string;
  changePct: number | null;
  turnover?: string;
  trades?: string;
  reasonTags?: string[];
  status?: string;
  futureSegment?: string | null;
  rank?: number;
  href?: string;
  sparklineValues?: number[] | null;
  metrics?: MarketFocusCardMetric[];
  eyebrow?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  children?: ReactNode;
};

const SIZE_SHELL: Record<MarketCardSize, string> = {
  hero: "min-h-[11.5rem] p-4 sm:min-h-[12rem] sm:p-5",
  medium: "min-h-[6.75rem] p-3.5",
  compact: "min-w-[9.5rem] shrink-0 p-2.5",
};

const TYPE_EYEBROW: Partial<Record<MarketCardType, string>> = {
  stock: "text-lab-cyan",
  future: "text-lab-violet",
  lab: "text-lab-violet",
  anomaly: "text-lab-amber",
};

const TYPE_STATUS: Partial<Record<MarketCardType, string>> = {
  stock: "lab-status-chip lab-chip-live",
  future: "lab-status-chip lab-chip-lab",
  lab: "lab-status-chip lab-chip-lab",
};

function MetricCell({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-md border border-lab-border/60 bg-lab-bg-deep/35 px-2 py-1.5 backdrop-blur-sm">
      <p className={cn("uppercase tracking-wide text-lab-dim", compact ? "text-[8px]" : "text-[9px]")}>
        {label}
      </p>
      <p className={cn("lab-number text-lab-text", compact ? "mt-0.5 text-[10px]" : "mt-0.5 text-sm")}>
        {value}
      </p>
    </div>
  );
}

export function MarketFocusCard({
  size,
  type,
  state: stateProp,
  ticker,
  nameOrBase,
  changePct,
  turnover,
  trades,
  reasonTags = [],
  status,
  futureSegment,
  rank,
  href,
  sparklineValues,
  metrics = [],
  eyebrow,
  empty = false,
  emptyTitle = "Нет данных",
  emptyDescription,
  className,
  children,
}: MarketFocusCardProps) {
  if (empty) {
    return (
      <div
        className={cn(
          "lab-glass-panel relative flex flex-col justify-center overflow-hidden border-dashed",
          SIZE_SHELL[size],
          className,
        )}
      >
        <div className="lab-accent-line absolute inset-x-0 top-0 opacity-40" aria-hidden />
        {eyebrow ? (
          <p className={cn("lab-type-section text-[10px]", TYPE_EYEBROW[type])}>{eyebrow}</p>
        ) : null}
        <p className="mt-2 text-sm font-semibold text-lab-text">{emptyTitle}</p>
        {emptyDescription ? (
          <p className="lab-type-caption mt-1.5 max-w-sm text-xs leading-relaxed">{emptyDescription}</p>
        ) : null}
      </div>
    );
  }

  const state = stateProp ?? resolveMarketCardState(changePct);
  const styles = MARKET_CARD_STATE_STYLES[state];
  const segmentTheme = type === "future" ? resolveFutureSegmentTheme(futureSegment ?? status) : null;

  const shell = cn(
    "group relative block overflow-hidden rounded-xl border border-lab-border/80 bg-lab-surface-glass/75 backdrop-blur-xl transition-all duration-200",
    SIZE_SHELL[size],
    segmentTheme?.ring ?? styles.ring,
    segmentTheme?.hoverGlow ?? styles.hoverGlow,
    size === "hero" && (segmentTheme ? "" : styles.heroGlow),
    size !== "hero" && "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:-translate-y-0.5",
    className,
  );

  const accentLineClass = segmentTheme?.accentLine ?? styles.accentLine;
  const statusChipClass =
    type === "future" && segmentTheme ? segmentTheme.chip : TYPE_STATUS[type] ?? "lab-status-chip";

  const body = (
    <>
      <div className={cn("absolute inset-x-0 top-0 z-20 h-px opacity-90", accentLineClass)} aria-hidden />

      <CardSparklineBackdrop
        sparklineValues={sparklineValues}
        changePct={changePct}
        state={state}
        size={size}
        segmentGradient={segmentTheme?.backdropGradient}
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className={cn("lab-type-section text-[10px]", TYPE_EYEBROW[type])}>{eyebrow}</p>
            ) : rank != null ? (
              <span className="lab-number text-[10px] text-lab-dim">#{rank}</span>
            ) : null}
          </div>
          {status ? (
            <span className={cn("shrink-0 text-[8px]", statusChipClass)}>{status}</span>
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-baseline justify-between gap-2",
            size === "hero" ? "mt-2 flex-wrap items-end gap-x-3 gap-y-1" : "mt-1",
          )}
        >
          <span
            className={cn(
              "lab-ticker",
              size === "hero" && type === "stock" && "text-4xl sm:text-5xl",
              size === "hero" && type === "future" && "text-3xl sm:text-4xl",
              size === "medium" && "text-lg",
              size === "compact" && "text-sm",
            )}
          >
            {ticker}
          </span>
          <span
            className={cn(
              "lab-number font-semibold tabular-nums",
              size === "hero" && "text-2xl sm:text-3xl",
              size === "medium" && "text-sm",
              size === "compact" && "text-xs",
              styles.percent,
            )}
          >
            {tradingFormat.formatSignedPercent(changePct)}
          </span>
        </div>

        {nameOrBase && size !== "compact" ? (
          <p
            className={cn(
              "truncate text-lab-muted",
              size === "hero" ? "mt-1 text-sm" : "mt-0.5 text-[10px]",
              type === "future" && "text-lab-violet/90",
            )}
          >
            {type === "future" ? `База · ${nameOrBase}` : nameOrBase}
          </p>
        ) : null}

        {size === "hero" && reasonTags.length > 0 ? (
          <ReasonTagRow tags={reasonTags} className="mt-2" />
        ) : null}

        {size === "medium" && reasonTags.length > 0 ? (
          <ReasonTagRow tags={reasonTags.slice(0, 2)} className="mt-1.5" />
        ) : null}

        {size !== "compact" && metrics.length > 0 ? (
          <div
            className={cn(
              "mt-auto grid gap-2 border-t border-lab-border/50 pt-2",
              size === "hero" ? "mt-3 grid-cols-3 pt-3" : "grid-cols-2",
            )}
          >
            {metrics.map((m) => (
              <MetricCell key={m.label} label={m.label} value={m.value} compact={size === "medium"} />
            ))}
          </div>
        ) : null}

        {size === "compact" ? (
          <div className="mt-1 space-y-0.5">
            {turnover ? <p className="lab-number text-[10px] text-lab-dim">{turnover}</p> : null}
            {reasonTags[0] ? <ReasonTagRow tags={[reasonTags[0]]} /> : null}
          </div>
        ) : null}

        {size === "medium" && !metrics.length && (turnover || trades) ? (
          <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-lab-dim">
            {turnover ? (
              <span>
                оборот <span className="lab-number text-lab-text">{turnover}</span>
              </span>
            ) : null}
            {trades ? (
              <span>
                сделки <span className="lab-number text-lab-text">{trades}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {children}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
