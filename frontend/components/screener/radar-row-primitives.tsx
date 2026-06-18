"use client";

import * as React from "react";
import {
  getMarketRadarReasonDetail,
  getMarketRadarReasonLabel,
  type MarketRadarReasonKey,
} from "@/lib/domain/market-radar-config";
import {
  formatRatioCellParts,
  RATIO_TONE_CLASS,
  type IntradayBaselineKind,
} from "@/lib/domain/intraday-baseline";
import { cn } from "@/lib/utils/cn";

export type RadarRowTone = "liquidity" | "inplay" | "volatility";

export const TICKER_CLASS = "w-[2.35rem] shrink-0";
export const NUM_CLASS = "shrink-0 font-mono text-[10px] font-medium tabular-nums leading-none";

const ROW_HOVER = "hover:bg-white/[0.03]";

export const REASON_BADGE_CLASS: Record<MarketRadarReasonKey, string> = {
  liquidity: "border-cyan-500/20 bg-cyan-950/25 text-cyan-200/80",
  volumeRatio: "border-emerald-500/22 bg-emerald-950/28 text-emerald-200/85",
  tradesRatio: "border-cyan-500/18 bg-cyan-950/22 text-cyan-200/75",
  highTurnover: "border-emerald-500/18 bg-emerald-950/22 text-emerald-200/75",
  manyTrades: "border-cyan-500/18 bg-cyan-950/22 text-cyan-200/75",
  wideRange: "border-violet-500/20 bg-violet-950/25 text-violet-200/80",
  nearHigh: "border-cyan-500/20 bg-cyan-950/25 text-cyan-200/80",
  nearLow: "border-rose-500/20 bg-rose-950/25 text-rose-200/80",
  breakoutHigh: "border-violet-500/22 bg-violet-950/28 text-violet-100/90",
  breakoutLow: "border-rose-500/22 bg-rose-950/28 text-rose-100/90",
  strongMove: "border-amber-500/22 bg-amber-950/28 text-amber-200/90",
  selloff: "border-rose-500/25 bg-rose-950/30 text-rose-200/90",
  bounce: "border-emerald-500/22 bg-emerald-950/28 text-emerald-200/85",
  illiquidRisk: "border-rose-500/22 bg-rose-950/28 text-rose-200/85",
  activity: "border-slate-600/25 bg-slate-900/40 text-slate-400/85",
  noBaseline: "border-slate-600/25 bg-slate-900/40 text-slate-500/80",
  roughBaseline: "border-amber-900/30 bg-amber-950/25 text-amber-500/75",
  partialBaseline: "border-slate-600/25 bg-slate-900/40 text-slate-400/85",
  hard: "border-amber-500/30 bg-amber-950/35 text-amber-200/95",
  impulse: "border-violet-500/22 bg-violet-950/28 text-violet-200/90",
  impulseUp: "border-emerald-500/22 bg-emerald-950/28 text-emerald-200/90",
  impulseDown: "border-rose-500/22 bg-rose-950/28 text-rose-200/90",
};

export function percentClass(value: number | null): string {
  if ((value ?? 0) > 0) return "text-emerald-400";
  if ((value ?? 0) < 0) return "text-rose-400";
  return "text-slate-500";
}

/** Компактный Vol x / Trades x в строке радара. */
export function RadarRatioChip({
  ratio,
  kind,
  emptyLabel = "—",
  title,
}: {
  ratio: number | null | undefined;
  kind?: IntradayBaselineKind | null;
  emptyLabel?: string;
  title?: string;
}) {
  const parts = formatRatioCellParts(ratio, kind);
  const label = parts.primary === "без baseline" || parts.primary === "нет базы" ? emptyLabel : parts.primary;
  const hint =
    title ??
    (parts.suffix != null && label !== emptyLabel ? `${label} · ${parts.suffix}` : undefined);

  return (
    <span
      title={hint}
      className={cn(
        "w-[1.6rem] shrink-0 truncate text-center font-mono text-[8px] font-medium tabular-nums leading-none",
        label === emptyLabel ? "text-slate-600" : RATIO_TONE_CLASS[parts.tone],
      )}
    >
      {label}
    </span>
  );
}

export function RadarBadge({
  reasonKey,
  variant = "default",
}: {
  reasonKey: MarketRadarReasonKey;
  variant?: "default" | "hard" | "active";
}) {
  const label = getMarketRadarReasonLabel(reasonKey);
  const detail = getMarketRadarReasonDetail(reasonKey);
  return (
    <span
      title={detail ?? label}
      className={cn(
        "max-w-[4.75rem] shrink-0 truncate rounded px-1 py-px text-[6.5px] font-medium leading-none",
        variant === "active"
          ? "border-cyan-900/35 bg-cyan-950/25 text-cyan-300/75"
          : variant === "hard"
            ? REASON_BADGE_CLASS[reasonKey]
            : cn("text-slate-300/90", REASON_BADGE_CLASS[reasonKey]),
      )}
    >
      {label}
    </span>
  );
}

function selectedRowClass(tone: RadarRowTone, selected: boolean | undefined): string | false {
  if (!selected) return false;
  if (tone === "inplay") return "bg-emerald-500/[0.1] ring-1 ring-inset ring-emerald-400/35";
  if (tone === "volatility") return "bg-amber-500/[0.09] ring-1 ring-inset ring-amber-400/30";
  return "bg-cyan-500/[0.08] ring-1 ring-inset ring-cyan-500/20";
}

export function RadarRowShell({
  tone,
  ticker,
  selected,
  onTickerSelect,
  rowRef,
  onMouseEnter,
  onMouseLeave,
  rowClassName,
  children,
}: {
  tone: RadarRowTone;
  ticker: string;
  selected?: boolean;
  onTickerSelect?: (ticker: string) => void;
  rowRef?: React.RefObject<HTMLDivElement | null>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  rowClassName?: string;
  children: React.ReactNode;
}) {
  const rowClass = cn(
    "flex w-full items-center gap-0.5 rounded px-0.5 py-px text-left transition-colors duration-100",
    ROW_HOVER,
    rowClassName,
    selectedRowClass(tone, selected),
  );

  if (!onTickerSelect) {
    return (
      <li
        className={rowClass}
        ref={rowRef as React.RefObject<HTMLLIElement> | undefined}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </li>
    );
  }

  return (
    <li>
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        className={rowClass}
        onClick={() => onTickerSelect(ticker)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onTickerSelect(ticker);
          }
        }}
        aria-pressed={selected}
      >
        {children}
      </div>
    </li>
  );
}

export function useRadarRowHover() {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = React.useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const clearShowTimer = React.useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const refreshAnchor = React.useCallback(() => {
    if (rowRef.current) setAnchorRect(rowRef.current.getBoundingClientRect());
  }, []);

  const onMouseEnter = React.useCallback(() => {
    clearHideTimer();
    clearShowTimer();
    refreshAnchor();
    showTimerRef.current = setTimeout(() => {
      refreshAnchor();
      setHovered(true);
    }, 120);
  }, [clearHideTimer, clearShowTimer, refreshAnchor]);

  const onMouseLeave = React.useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setHovered(false), 200);
  }, [clearHideTimer, clearShowTimer]);

  React.useEffect(
    () => () => {
      clearHideTimer();
      clearShowTimer();
    },
    [clearHideTimer, clearShowTimer],
  );

  return { rowRef, hovered, anchorRect, onMouseEnter, onMouseLeave };
}
