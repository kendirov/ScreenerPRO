"use client";

import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import Link from "next/link";
import type { ScreenerDataStatus } from "@screenerpro/shared";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { MetricTooltipPanel, MetricTooltipRow } from "@/components/ui/metrics-minimalism";
import {
  buildStockRowFilterHints,
  getStockTableStatus,
  isStockInPlay,
  STOCK_DAY_RANGE_COLUMN_LABEL,
} from "@/lib/domain/stock-screener-display";
import { formatDataSourceLabel } from "@/lib/domain/screener-overview";
import {
  buildInPlayInclusionReason,
  computeRelativeTurnover,
  formatRelativeTurnoverLabel,
} from "@/lib/domain/stocks-screener-signals";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

function avgTradeRub(row: ScreenerRow): string | null {
  const turnover = row.turnover;
  const trades = row.tradesCount;
  if (turnover == null || !trades || trades <= 0) return null;
  return tradingFormat.formatTurnoverRub(turnover / trades);
}

function tradesLabel(row: ScreenerRow): string | null {
  if (row.tradesCount == null || row.tradesCount <= 0) return null;
  return tradingFormat.formatInteger(row.tradesCount);
}

function InspectorBody({
  row,
  maxTurnover,
  dataStatus,
  hideIlliquid,
}: {
  row: ScreenerRow;
  maxTurnover: number;
  dataStatus?: ScreenerDataStatus | null;
  hideIlliquid?: boolean;
}) {
  const relative = formatRelativeTurnoverLabel(computeRelativeTurnover(row));
  const filterHints = buildStockRowFilterHints(row, maxTurnover, { hideIlliquid });
  const updated = row.updatedAt ? new Date(row.updatedAt).toLocaleTimeString("ru-RU") : null;
  const source = dataStatus ? formatDataSourceLabel(dataStatus.source) : "MOEX ISS";
  const status = getStockTableStatus(row, maxTurnover);
  const range =
    row.metrics.dayRangePct != null
      ? tradingFormat.formatDayRangeMagnitude(row.metrics.dayRangePct)
      : null;
  const inclusionReason = isStockInPlay(row) ? buildInPlayInclusionReason(row) : null;

  return (
    <MetricTooltipPanel>
      <MetricTooltipRow label="Статус" value={status} />
      <MetricTooltipRow label="Цена" value={tradingFormat.formatDynamicPrice(row.lastPrice)} />
      <MetricTooltipRow label="Оборот" value={tradingFormat.formatTurnoverRub(row.turnover)} />
      <MetricTooltipRow label="Сделки" value={tradesLabel(row)} />
      <MetricTooltipRow label={STOCK_DAY_RANGE_COLUMN_LABEL} value={range} />
      <MetricTooltipRow label="Средняя сделка" value={avgTradeRub(row)} />
      <MetricTooltipRow label="К вчера" value={relative ?? "нет сравнения со вчера"} />
      {inclusionReason ? <MetricTooltipRow label="Попадание" value={inclusionReason} /> : null}
      <MetricTooltipRow label="Источник" value={source} />
      <MetricTooltipRow label="Обновлено" value={updated} />
      {filterHints.length ? <MetricTooltipRow label="В выборке" value={filterHints.join(" · ")} /> : null}
    </MetricTooltipPanel>
  );
}

export function StockRowInspector({
  row,
  maxTurnover,
  dataStatus,
  hideIlliquid,
  className,
}: {
  row: ScreenerRow;
  maxTurnover: number;
  dataStatus?: ScreenerDataStatus | null;
  hideIlliquid?: boolean;
  className?: string;
}) {
  return (
    <LabGlassPanel depth={10} className={cn("sticky top-[5.5rem] h-fit p-2.5", className)}>
      <p className="text-sm font-semibold text-lab-text-main">{row.ticker}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] text-lab-text-dim">{row.shortName}</p>
      <div className="mt-2.5 border-t border-lab-border-soft/50 pt-2">
        <InspectorBody row={row} maxTurnover={maxTurnover} dataStatus={dataStatus} hideIlliquid={hideIlliquid} />
      </div>
      <Link
        href={`/stocks/${encodeURIComponent(row.ticker)}`}
        className="mt-2.5 block text-center text-[10px] uppercase tracking-wide text-lab-cyan transition hover:text-lab-cyan/80"
      >
        Карточка →
      </Link>
    </LabGlassPanel>
  );
}

export function StockRowExpandedDetail({
  row,
  maxTurnover,
  dataStatus,
  hideIlliquid,
}: {
  row: ScreenerRow;
  maxTurnover: number;
  dataStatus?: ScreenerDataStatus | null;
  hideIlliquid?: boolean;
}) {
  return (
    <div className="border-t border-lab-border-soft/30 bg-black/15 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-lab-text-main">{row.shortName}</p>
          <div className="mt-1.5">
            <InspectorBody row={row} maxTurnover={maxTurnover} dataStatus={dataStatus} hideIlliquid={hideIlliquid} />
          </div>
        </div>
        <Link
          href={`/stocks/${encodeURIComponent(row.ticker)}`}
          className="shrink-0 rounded-md border border-lab-border-soft/60 px-2 py-1 text-[10px] uppercase tracking-wide text-lab-cyan"
        >
          Карточка →
        </Link>
      </div>
    </div>
  );
}
