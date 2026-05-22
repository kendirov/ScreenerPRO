"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { InstrumentCardVisual } from "@/components/screener/instrument-card-visual";
import { formatTurnoverCompact, inferFutureMarketSegment } from "@/lib/domain/screener-overview";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";
import { auraGlass, auraGlassHover, percentClass, performanceAura } from "./dashboard-styles";

interface FutureFocusHeroCardProps {
  row: ScreenerRow | null;
  baseLabel: string;
  sparklineValues?: number[] | null;
}

export function FutureFocusHeroCard({ row, baseLabel, sparklineValues }: FutureFocusHeroCardProps) {
  if (!row) {
    return (
      <div className={cn(auraGlass, "flex min-h-[9.5rem] flex-col justify-center px-4 py-5")}>
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Фьючерс в фокусе</p>
        <p className="mt-2 text-sm text-slate-400">Нет данных по фьючерсам</p>
      </div>
    );
  }

  const marketSegment = inferFutureMarketSegment(baseLabel, row.ticker);
  const marketLabel = marketSegment ?? baseLabel;
  const dayRange = row.metrics.dayRangePct;

  return (
    <Link
      href={`/futures/${row.ticker}`}
      className={cn(
        auraGlass,
        auraGlassHover,
        performanceAura(row.percentChange),
        "group relative flex min-h-[9.5rem] flex-col p-4 transition hover:ring-indigo-400/20",
      )}
    >
      <InstrumentCardVisual row={row} sparklineValues={sparklineValues} variant="backdrop" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-indigo-300/80">Фьючерс в фокусе</p>
          {marketSegment ? (
            <span className="rounded-md bg-indigo-950/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-indigo-200/70">
              Рынок · {marketSegment}
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-0.5">
          <span className="text-3xl font-semibold tracking-wide text-white sm:text-4xl">{row.ticker}</span>
          <span className={cn("font-mono text-xl tabular-nums sm:text-2xl", percentClass(row.percentChange))}>
            {tradingFormat.formatSignedPercent(row.percentChange)}
          </span>
        </div>

        <p className="mt-1 truncate text-xs text-slate-500">{marketLabel}</p>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-3 text-[10px] sm:grid-cols-4">
          <Metric label="Оборот" value={formatTurnoverCompact(row.turnover)} />
          <Metric label="Сделки" value={tradingFormat.formatInteger(row.tradesCount ?? null)} />
          <Metric
            label="Ход"
            value={dayRange !== null ? tradingFormat.formatDayRangeMagnitude(dayRange) : "—"}
          />
          <Metric label="База" value={baseLabel.length > 18 ? `${baseLabel.slice(0, 16)}…` : baseLabel} />
        </div>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="font-mono tabular-nums text-slate-200">{value}</p>
    </div>
  );
}
