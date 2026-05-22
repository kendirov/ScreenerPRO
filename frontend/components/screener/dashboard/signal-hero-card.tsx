"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { InstrumentCardVisual } from "@/components/screener/instrument-card-visual";
import { formatFocusReasonTags, formatTurnoverCompact } from "@/lib/domain/screener-overview";
import {
  getStockActivityDisplayLabel,
  stockActivityDisplayBadgeClass,
} from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";
import { auraGlass, auraGlassHover, auraTag, percentClass, performanceAura } from "./dashboard-styles";

interface SignalHeroCardProps {
  row: ScreenerRow | null;
  sparklineValues?: number[] | null;
  maxTurnover?: number;
}

export function SignalHeroCard({ row, sparklineValues, maxTurnover = 0 }: SignalHeroCardProps) {
  if (!row) {
    return (
      <div className={cn(auraGlass, performanceAura(null), "flex min-h-[9.5rem] flex-col justify-center px-5 py-5")}>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Главный сигнал</p>
        <p className="mt-3 text-xl font-medium tracking-tight text-white/70">Явного лидера нет</p>
        <p className="mt-1.5 max-w-sm text-sm text-white/45">Нет акций «в игре» с выраженным оборотом и импульсом.</p>
      </div>
    );
  }

  const focusTags = formatFocusReasonTags(row);
  const statusLabel = getStockActivityDisplayLabel(row, maxTurnover);
  const statusClass = stockActivityDisplayBadgeClass[statusLabel];
  const reason = row.metrics.reasonLabel ?? (focusTags.length ? focusTags.join(" · ") : null) ?? "—";
  const dayRange = row.metrics.dayRangePct;

  return (
    <Link
      href={`/stocks/${row.ticker}`}
      className={cn(
        auraGlass,
        auraGlassHover,
        performanceAura(row.percentChange),
        "group relative block min-h-[9.5rem] p-4 sm:p-5",
      )}
    >
      <InstrumentCardVisual row={row} sparklineValues={sparklineValues} variant="backdrop" />

      <div className="relative z-10 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/60">Главный сигнал</p>

          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="bg-gradient-to-br from-white via-white/92 to-white/55 bg-clip-text text-4xl font-semibold tracking-[0.12em] text-transparent sm:text-5xl">
              {row.ticker}
            </span>
            <span className={cn("font-mono text-2xl font-medium tabular-nums sm:text-3xl", percentClass(row.percentChange))}>
              {tradingFormat.formatSignedPercent(row.percentChange)}
            </span>
          </div>

          {focusTags.length > 0 ? (
            <div className="mt-3">
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/35">Почему в фокусе</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {focusTags.map((tag) => (
                  <span key={tag} className={auraTag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl bg-black/25 px-3 py-2.5 ring-1 ring-white/[0.06] backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] sm:grid-cols-1">
            <ScoreCell label="Оборот" value={formatTurnoverCompact(row.turnover)} />
            <ScoreCell label="Сделки" value={tradingFormat.formatInteger(row.tradesCount ?? null)} />
            <ScoreCell
              label="Ход"
              value={dayRange !== null ? tradingFormat.formatDayRangeMagnitude(dayRange) : "—"}
            />
            <div>
              <p className="uppercase tracking-wide text-white/40">Статус</p>
              <span className={cn("mt-0.5 inline-block rounded-md border px-1.5 py-0.5 text-[10px]", statusClass)}>
                {statusLabel}
              </span>
            </div>
          </div>
          <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-snug text-white/45">
            <span className="text-white/35">Причина · </span>
            {reason}
          </p>
        </div>
      </div>
    </Link>
  );
}

function ScoreCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 font-mono text-sm tabular-nums text-white/85">{value}</p>
    </div>
  );
}


