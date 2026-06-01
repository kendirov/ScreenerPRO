"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ScreenerRow } from "@screenerpro/shared";
import { ReasonTagRow } from "@/components/screener/reason-tag-chip";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { stockReasonTags } from "@/lib/domain/market-card-visual";
import {
  buildInPlaySurfaceChips,
  formatTradesCompact,
} from "@/lib/domain/stocks-screener-signals";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import {
  SIGNAL_MODE_LABEL,
  SIGNAL_MODE_SURFACE,
  resolveActivityScore,
  resolveSignalMode,
} from "@/lib/design/design-tokens";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

export function TopInstrumentCard({
  row,
  rank,
  maxTurnover,
  className,
}: {
  row: ScreenerRow;
  rank: number;
  maxTurnover: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const mode = resolveSignalMode(row, maxTurnover);
  const surface = SIGNAL_MODE_SURFACE[mode];
  const score = resolveActivityScore(row);
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  const chips = buildInPlaySurfaceChips(row, position);
  const reasons = stockReasonTags(row).slice(0, 3);
  const tradesLabel = formatTradesCompact(row.tradesCount);

  const percentClass =
    (row.percentChange ?? 0) > 0
      ? "text-emerald-300/95"
      : (row.percentChange ?? 0) < 0
        ? "text-rose-300/95"
        : "text-slate-400";

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "sc-premium-card group relative overflow-hidden rounded-2xl p-3 ring-1 transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-px",
        surface.ring,
        surface.glow,
        rank === 1 && mode !== "neutral" && "sc-premium-card--signal",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          surface.accent,
        )}
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tabular-nums text-slate-500">#{rank}</span>
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                surface.badge,
              )}
            >
              {SIGNAL_MODE_LABEL[mode]}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">score</p>
            <p className="font-mono text-lg font-semibold tabular-nums leading-none text-slate-100">
              {score}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          <Link
            href={`/stocks/${encodeURIComponent(row.ticker)}`}
            className="text-2xl font-bold tracking-[0.06em] text-slate-50 transition hover:text-cyan-200/95"
          >
            {row.ticker}
          </Link>
          <span className={cn("font-mono text-xl font-semibold tabular-nums", percentClass)}>
            {tradingFormat.formatSignedPercent(row.percentChange)}
          </span>
        </div>

        {row.shortName ? (
          <p className="truncate text-[11px] text-slate-400">{row.shortName}</p>
        ) : null}

        {reasons.length > 0 ? <ReasonTagRow tags={reasons} /> : null}

        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-2 text-[10px]">
          <div>
            <p className="text-slate-500">оборот</p>
            <p className="font-mono tabular-nums text-slate-200">{formatTurnoverCompact(row.turnover)}</p>
          </div>
          <div>
            <p className="text-slate-500">сделки</p>
            <p className="font-mono tabular-nums text-slate-200">{tradesLabel ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">диапазон</p>
            <p className="font-mono tabular-nums text-slate-200">
              {row.metrics.dayRangePct != null
                ? tradingFormat.formatDayRangeMagnitude(row.metrics.dayRangePct)
                : "—"}
            </p>
          </div>
        </div>

        {chips.length ? (
          <p className="truncate font-mono text-[9px] text-slate-500">
            {chips.join(" · ")}
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}
