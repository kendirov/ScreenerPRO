"use client";



import Link from "next/link";

import type { ScreenerRow } from "@screenerpro/shared";

import { BriefingSelectionButton } from "@/components/lab/preparation/briefing-selection-button";

import {

  RealSparkline,

  hasRealSparklineHistory,

  inferToneFromChange,

} from "@/components/screener/mini-sparkline";

import {

  computePreparationChanges,

  resolveInstrumentDataStatus,

  shouldShowLiveScreenerMetrics,

} from "@/lib/domain/market-data-status";

import {

  PREPARATION_GROUP_LABELS,

  REASON_TAG_LABELS,

  computeInertia,

  type PreparationCandleSeries,

  type PreparationViewMode,

  type ResolvedPreparationInstrument,

  type PreparationReasonTag,

} from "@/lib/domain/preparation-watchlist";

import { tradingFormat } from "@/lib/formatters/trading";

import { cn } from "@/lib/utils/cn";



const REASON_CHIP_CLASS: Record<PreparationReasonTag, string> = {

  inplay: "lab-chip-live",

  liquid: "border-lab-cyan/30 bg-lab-cyan/8 text-lab-cyan",

  news: "border-lab-amber/30 bg-lab-amber/8 text-lab-amber",

  commodity: "border-lab-amber/25 bg-lab-amber/6 text-lab-amber",

  currency: "border-lab-violet/30 bg-lab-violet/8 text-lab-violet",

  index: "border-lab-blue/30 bg-lab-blue/8 text-lab-blue",

  external: "lab-chip-dev text-lab-dim",

};



const INERTIA_CLASS = {

  may_stay_active: "border-lab-green/30 bg-lab-green/8 text-lab-green",

  passive: "border-lab-border text-lab-dim bg-lab-surface-2/40",

  unknown: "border-lab-border text-lab-muted bg-lab-surface-2/30",

};



const FRESHNESS_CHIP_CLASS = {

  live: "lab-chip-live",

  delayed: "border-lab-cyan/30 bg-lab-cyan/8 text-lab-cyan",

  "last-available": "border-lab-amber/30 bg-lab-amber/8 text-lab-amber",

  closed: "border-lab-border text-lab-dim bg-lab-surface-2/40",

  "no-data": "lab-chip-dev text-lab-muted",

  error: "border-lab-red/30 bg-lab-red/8 text-lab-red",

};



export function PreparationInstrumentCard({

  instrument,

  candleSeries,

  reasonTag,

  viewMode = "grid",

  hasLiveMetrics,

  selected = false,

  onToggleBriefing,

}: {

  instrument: ResolvedPreparationInstrument;

  candleSeries: PreparationCandleSeries | null;

  reasonTag: PreparationReasonTag;

  viewMode?: PreparationViewMode;

  hasLiveMetrics: boolean;

  selected?: boolean;

  onToggleBriefing?: () => void;

}) {

  const row = instrument.screenerRow;

  const isExternal = instrument.market === "global" || instrument.market === "manual";

  const candles = candleSeries?.status === "ok" ? candleSeries.candles : [];



  const dataStatus = resolveInstrumentDataStatus({

    candleSeries,

    screenerRow: row,

    hasLiveMoex: hasLiveMetrics,

    isExternal,

  });



  const changes = computePreparationChanges(candles, dataStatus, row);

  const showLiveMetrics = shouldShowLiveScreenerMetrics(dataStatus);



  const closes = candles

    .map((candle) => candle.close)

    .filter((value): value is number => value != null && value > 0);

  const hasHistory = hasRealSparklineHistory(closes);



  const inertia = computeInertia(candles, {

    dayRangePct: showLiveMetrics ? row?.metrics.dayRangePct : null,

    turnover: showLiveMetrics ? row?.turnover : null,

    isInPlay: row?.metrics.isInPlay,

  });



  const href =

    !isExternal && instrument.resolvedSecid

      ? instrument.market === "moex-future"

        ? `/futures/${instrument.resolvedSecid}`

        : `/stocks/${instrument.resolvedSecid}`

      : null;



  const isInPlay = reasonTag === "inplay" || row?.metrics.isInPlay;



  const cardClass = cn(

    "lab-glass-card relative overflow-hidden border transition",

    viewMode === "focus" ? "px-4 py-3" : "px-3 py-2.5",

    viewMode === "list" ? "flex flex-col sm:flex-row sm:items-stretch sm:gap-4" : "",

    isExternal && "border-lab-border/70",

    !isExternal && !selected && !isInPlay && "border-lab-border/80 hover:border-lab-cyan/25 hover:shadow-[var(--lab-glow-cyan)]",

    isInPlay && !selected && "border-lab-green/35 shadow-[var(--lab-glow-green)]",

    selected && "border-lab-violet/40 shadow-[var(--lab-glow-violet)] ring-1 ring-lab-violet/15",

  );



  const chartEmptyLabel =
    dataStatus.freshness === "no-data" || dataStatus.freshness === "error"
      ? dataStatus.label
      : "Данных сегодня нет";



  return (

    <article className={cardClass}>

      <div className={cn("flex items-start justify-between gap-2", viewMode === "list" && "sm:min-w-[220px]")}>

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-1.5">

            {href ? (

              <Link

                href={href}

                className="font-mono text-sm font-semibold text-lab-text hover:text-lab-cyan"

              >

                {instrument.symbol}

              </Link>

            ) : (

              <p className="font-mono text-sm font-semibold text-lab-text">{instrument.symbol}</p>

            )}

            {instrument.resolvedSecid && instrument.resolvedSecid !== instrument.symbol ? (

              <span className="font-mono text-[10px] text-lab-dim">{instrument.resolvedSecid}</span>

            ) : null}

          </div>

          <p className="line-clamp-1 text-[11px] text-lab-muted">{instrument.title}</p>

          <p className="mt-0.5 text-[10px] text-lab-dim">{PREPARATION_GROUP_LABELS[instrument.group]}</p>

        </div>

        <div className="shrink-0 text-right">

          <MetricPill label="1д" value={changes.change1d} hint={changes.change1dHint} />

          <MetricPill label="5д" value={changes.change5d} hint={changes.change5dHint} className="mt-1" />

        </div>

      </div>



      <div

        className={cn(

          "mt-2",

          viewMode === "focus" ? "h-16" : viewMode === "list" ? "h-14 sm:mt-0 sm:flex-1" : "h-11",

        )}

      >

        {isExternal ? (

          <div className="flex h-full items-center rounded-md border border-dashed border-lab-border/70 bg-lab-bg-deep/50 px-2">

            <p className="text-[10px] text-lab-muted">{dataStatus.label}</p>

          </div>

        ) : hasHistory ? (

          <RealSparkline

            variant="inline"

            values={closes}

            tone={inferToneFromChange(changes.change5d ?? changes.change1d)}

            className="h-full w-full"

          />

        ) : (

          <div className="flex h-full items-center rounded-md border border-dashed border-lab-border/60 px-2">

            <p className="text-[10px] text-lab-dim">{chartEmptyLabel}</p>

          </div>

        )}

      </div>



      <div className="mt-2 grid gap-1.5 text-[10px] text-lab-muted sm:grid-cols-2">

        <Stat label="Оборот" value={formatTurnover(row, showLiveMetrics)} />

        <Stat label="Сделки" value={formatTrades(row, showLiveMetrics)} />

        <Stat label="Диапазон" value={formatRange(row, showLiveMetrics)} />

        <Stat label="Инертность" value={inertia.text} valueClass={INERTIA_CLASS[inertia.label]} />

      </div>



      <div className="mt-2 flex flex-wrap gap-1">

        <span className={cn("lab-status-chip px-1.5 py-px text-[9px]", REASON_CHIP_CLASS[reasonTag])}>

          {REASON_TAG_LABELS[reasonTag]}

        </span>

        {!isExternal ? (

          <span

            className={cn(

              "lab-status-chip px-1.5 py-px text-[9px]",

              FRESHNESS_CHIP_CLASS[dataStatus.freshness],

            )}

          >

            {dataStatus.label}

          </span>

        ) : null}

      </div>



      <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-lab-dim">{instrument.reason}</p>



      {onToggleBriefing ? (

        <div className="mt-2 flex justify-end">

          <BriefingSelectionButton selected={selected} onToggle={onToggleBriefing} />

        </div>

      ) : null}

    </article>

  );

}



function MetricPill({

  label,

  value,

  hint,

  className,

}: {

  label: string;

  value: number | null | undefined;

  hint?: string | null;

  className?: string;

}) {

  if (hint && value == null) {

    return (

      <div className={cn("font-mono text-[9px] text-lab-dim", className)}>

        <span className="text-lab-dim">{label} </span>

        <span className="text-lab-muted">{hint}</span>

      </div>

    );

  }



  const tone =

    (value ?? 0) > 0 ? "text-lab-green" : (value ?? 0) < 0 ? "text-lab-red" : "text-lab-muted";



  return (

    <div className={cn("font-mono text-[10px]", className)}>

      <span className="text-lab-dim">{label} </span>

      <span className={cn("tabular-nums", tone)}>

        {value != null && Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(2)}%` : "—"}

      </span>

    </div>

  );

}



function Stat({

  label,

  value,

  valueClass,

}: {

  label: string;

  value: string;

  valueClass?: string;

}) {

  return (

    <div className="flex items-center justify-between gap-2 rounded-md border border-lab-border/50 bg-lab-bg-deep/40 px-2 py-1">

      <span className="text-lab-dim">{label}</span>

      <span className={cn("truncate text-right font-medium text-lab-text", valueClass)}>{value}</span>

    </div>

  );

}



function formatTurnover(row: ScreenerRow | null, showLive: boolean): string {

  if (!showLive || !row?.turnover) return "—";

  return tradingFormat.formatTurnoverRub(row.turnover).replace(/\s?₽/g, " ₽");

}



function formatTrades(row: ScreenerRow | null, showLive: boolean): string {

  if (!showLive || row?.tradesCount == null || row.tradesCount <= 0) return "—";

  return row.tradesCount.toLocaleString("ru-RU");

}



function formatRange(row: ScreenerRow | null, showLive: boolean): string {

  if (!showLive || row?.metrics.dayRangePct == null) return "—";

  return `${row.metrics.dayRangePct.toFixed(1)}%`;

}


