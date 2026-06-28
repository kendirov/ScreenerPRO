"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  formatIndex,
  formatPct,
  formatPositionPct,
  formatRangePct,
  formatRubTurnover,
  formatTrades,
} from "@/lib/screener/formatters";
import type { NormalizedStockRow } from "@/lib/screener/stocks-radar";
import { cn } from "@/lib/utils/cn";

export type HoverAnchor = {
  ticker: string;
  clientX: number;
  clientY: number;
};

const CARD_W = 320;
const PAD = 12;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function resolvePosition(anchor: HoverAnchor) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  let left = anchor.clientX + 16;
  let top = anchor.clientY + 16;
  const estH = 220;
  if (left + CARD_W + PAD > vw) left = anchor.clientX - CARD_W - 16;
  if (top + estH + PAD > vh) top = anchor.clientY - estH - 16;
  return {
    left: clamp(left, PAD, vw - CARD_W - PAD),
    top: clamp(top, PAD, vh - estH - PAD),
  };
}

function HoverTag({ label, tone }: { label: string; tone: "cyan" | "amber" | "violet" | "muted" }) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-500/30 text-cyan-200/90"
      : tone === "amber"
        ? "border-amber-500/35 text-amber-200/90"
        : tone === "violet"
          ? "border-violet-500/30 text-violet-200/85"
          : "border-white/10 text-lab-text-dim";
  return (
    <span className={cn("rounded border px-1 py-px text-[8px] font-medium uppercase tracking-wide", toneClass)}>
      {label}
    </span>
  );
}

export function TickerHoverPreview({
  row,
  anchor,
  onMouseEnter,
  onMouseLeave,
}: {
  row: NormalizedStockRow;
  anchor: HoverAnchor;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const pos = React.useMemo(() => resolvePosition(anchor), [anchor.clientX, anchor.clientY, anchor.ticker]);

  const changeClass =
    (row.changePct ?? 0) > 0 ? "text-lab-green" : (row.changePct ?? 0) < 0 ? "text-lab-red" : "text-lab-text-dim";

  const card = (
    <div
      className="pointer-events-auto fixed z-[90] rounded-lg border border-white/10 bg-slate-950/95 p-3 shadow-xl backdrop-blur-sm"
      style={{ top: pos.top, left: pos.left, width: CARD_W }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold text-lab-text-main">{row.ticker}</span>
            <span className={cn("font-mono text-xs tabular-nums", changeClass)}>{formatPct(row.changePct, 2)}</span>
          </div>
          <p className="truncate text-[10px] text-lab-text-dim">{row.name}</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] tabular-nums">
        <span className="text-lab-text-dim">Цена</span>
        <span className="text-right text-lab-text-main">{formatIndex(row.last)}</span>
        <span className="text-lab-text-dim">Оборот</span>
        <span className="text-right text-lab-text-main">{formatRubTurnover(row.turnover)}</span>
        <span className="text-lab-text-dim">Сделки</span>
        <span className="text-right text-lab-text-main">{formatTrades(row.trades)}</span>
        <span className="text-lab-text-dim">Диапазон</span>
        <span className="text-right">{formatRangePct(row.rangePct)}</span>
        <span className="text-lab-text-dim">Положение</span>
        <span className="text-right">{formatPositionPct(row.positionInDayRange)}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {row.tags.includes("liquidity") ? <HoverTag label="ликвидность" tone="cyan" /> : null}
        {row.isInGame || row.tags.includes("in-play") ? <HoverTag label="в игре" tone="amber" /> : null}
        {row.tags.includes("volatility") ? <HoverTag label="волатильность" tone="violet" /> : null}
        {row.isIlliquid ? <HoverTag label="тонко" tone="muted" /> : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(card, document.body);
}

export function useDebouncedHover(delayMs = 150) {
  const [hover, setHover] = React.useState<{ row: NormalizedStockRow; anchor: HoverAnchor } | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRef = React.useRef<string | null>(null);

  const schedule = React.useCallback((row: NormalizedStockRow, anchor: HoverAnchor) => {
    if (pinnedRef.current && pinnedRef.current !== row.ticker) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHover({ row, anchor }), delayMs);
  }, [delayMs]);

  const clear = React.useCallback(() => {
    if (pinnedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setHover(null);
  }, []);

  const pin = React.useCallback((ticker: string | null) => {
    pinnedRef.current = ticker;
    if (!ticker) setHover(null);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pinnedRef.current = null;
        setHover(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { hover, schedule, clear, pin, setHover };
}
