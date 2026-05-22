"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { InstrumentCardVisual } from "@/components/screener/instrument-card-visual";
import { formatReasonTagsForCard, formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";
import {
  activeGlow,
  auraGlass,
  futureMosaicCellClass,
  mosaicCellClass,
  percentClass,
  performanceAura,
} from "./dashboard-styles";

interface SparklineLookup {
  get: (ticker: string) => number[] | null | undefined;
}

interface StockRadarMosaicProps {
  rows: ScreenerRow[];
  seriesByTicker: SparklineLookup;
}

export function StockRadarMosaic({ rows, seriesByTicker }: StockRadarMosaicProps) {
  if (!rows.length) {
    return (
      <p className="rounded-3xl bg-white/[0.02] px-4 py-10 text-center text-sm text-white/40 ring-1 ring-white/[0.05] backdrop-blur-3xl">
        Явных лидеров нет
      </p>
    );
  }

  return (
    <div className="grid auto-rows-fr grid-cols-12 gap-2 md:gap-3">
      {rows.map((row, index) => {
        const tags = formatReasonTagsForCard(row);
        const reason = tags[0] ?? row.metrics.reasonLabel ?? "активность";
        const isLeader = index === 0;

        return (
          <Link
            key={row.ticker}
            href={`/stocks/${row.ticker}`}
            className={cn(
              auraGlass,
              activeGlow("stock"),
              performanceAura(row.percentChange),
              "group relative block p-4",
              mosaicCellClass(index, rows.length),
            )}
          >
            <InstrumentCardVisual
              row={row}
              sparklineValues={seriesByTicker.get(row.ticker) ?? null}
              variant="backdrop"
              captionClassName="right-2 top-2"
            />

            <div className="relative z-10">
              <span className="font-mono text-[10px] tabular-nums text-emerald-300/55">#{index + 1}</span>

              <div
                className={cn(
                  "mt-1 flex items-baseline justify-between gap-2",
                  isLeader ? "flex-col items-start sm:flex-row sm:items-end" : "",
                )}
              >
                <span
                  className={cn(
                    "font-semibold tracking-tight text-white",
                    isLeader ? "text-2xl sm:text-3xl" : "text-lg",
                  )}
                >
                  {row.ticker}
                </span>
                <span
                  className={cn(
                    "font-mono font-medium tabular-nums",
                    isLeader ? "text-lg sm:text-xl" : "text-sm",
                    percentClass(row.percentChange),
                  )}
                >
                  {tradingFormat.formatSignedPercent(row.percentChange)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-white/45">
                <span>
                  оборот{" "}
                  <span className="font-mono text-white/75">{formatTurnoverCompact(row.turnover)}</span>
                </span>
                <span>
                  сделки{" "}
                  <span className="font-mono text-white/75">
                    {tradingFormat.formatInteger(row.tradesCount ?? null)}
                  </span>
                </span>
              </div>

              <p className="mt-2 text-[10px] uppercase tracking-wide text-cyan-200/50">{reason}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

interface FuturesFocusMosaicProps {
  rows: ScreenerRow[];
  baseByTicker: Map<string, string>;
  seriesByTicker: SparklineLookup;
}

export function FuturesFocusMosaic({ rows, baseByTicker, seriesByTicker }: FuturesFocusMosaicProps) {
  if (!rows.length) {
    return (
      <p className="rounded-3xl bg-white/[0.02] px-4 py-8 text-center text-sm text-white/40 ring-1 ring-white/[0.05] backdrop-blur-3xl">
        Нет данных по фьючерсам
      </p>
    );
  }

  return (
    <div className="grid auto-rows-fr grid-cols-12 gap-2 md:gap-3">
      {rows.map((row, index) => {
        const base = baseByTicker.get(row.ticker) ?? "—";
        const oi = row.openInterest;
        const isLeader = index === 0;

        return (
          <Link
            key={row.ticker}
            href={`/futures/${row.ticker}`}
            className={cn(
              auraGlass,
              activeGlow("future"),
              performanceAura(row.percentChange),
              "group relative block p-3.5",
              futureMosaicCellClass(index, rows.length),
            )}
          >
            <InstrumentCardVisual
              row={row}
              sparklineValues={seriesByTicker.get(row.ticker) ?? null}
              variant="backdrop"
              captionClassName="right-2 top-2"
            />

            <div className="relative z-10">
              <span className="font-mono text-[10px] text-indigo-300/55">#{index + 1}</span>
              <p className={cn("mt-1 font-semibold tracking-tight text-white", isLeader ? "text-xl" : "text-base")}>
                {row.ticker}
              </p>
              <p className="truncate text-[10px] text-white/40">{base}</p>
              <p
                className={cn(
                  "mt-1 font-mono font-medium tabular-nums",
                  isLeader ? "text-base" : "text-sm",
                  percentClass(row.percentChange),
                )}
              >
                {tradingFormat.formatSignedPercent(row.percentChange)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-white/45">
                <span className="font-mono text-white/70">{formatTurnoverCompact(row.turnover)}</span>
                <span className="font-mono text-white/70">
                  {tradingFormat.formatInteger(row.tradesCount ?? null)} сд.
                </span>
              </div>
              {oi != null && oi > 0 ? (
                <p className="mt-1 font-mono text-[9px] text-white/35">ОИ {tradingFormat.formatInteger(oi)}</p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
