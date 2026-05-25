"use client";

import * as React from "react";
import type { ScreenerDataStatus, ScreenerRow } from "@screenerpro/shared";
import Link from "next/link";
import { X } from "lucide-react";
import { StockExpandedChart } from "@/components/screener/stocks/stock-expanded-chart";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { StatusChip } from "@/components/ui/metrics-minimalism";
import {
  buildStockInclusionReasonTags,
  buildStockPositionSummary,
  EXPANDED_DATA_STATUS_LABEL,
  formatExpandedChartFetchedAt,
  formatExpandedChartSourceLabel,
  resolveExpandedChartDataStatus,
  resolveStockChartSessionLayout,
  type StockExpandedChartInterval,
} from "@/lib/domain/stock-expanded-chart";
import {
  getStockTableStatus,
  STOCK_DAY_RANGE_COLUMN_LABEL,
  stockTableStatusBadgeClass,
} from "@/lib/domain/stock-screener-display";
import { useStockExpandedCandles } from "@/lib/hooks/use-stock-expanded-candles";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

function percentClass(value: number | null): string {
  if ((value ?? 0) > 0) return "text-lab-green";
  if ((value ?? 0) < 0) return "text-lab-red";
  return "text-lab-text-dim";
}

function PanelBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-lab-border-soft/30 bg-black/15 p-2.5">
      <h4 className="text-[9px] uppercase tracking-[0.12em] text-lab-text-dim">{title}</h4>
      <div className="mt-1.5 space-y-1 text-[11px] text-lab-text-main">{children}</div>
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "—") return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-lab-text-dim">{label}</span>
      <span className="text-right font-mono tabular-nums">{value}</span>
    </div>
  );
}

export function StockExpandedCard({
  row,
  maxTurnover,
  onClose,
}: {
  row: ScreenerRow;
  maxTurnover: number;
  dataStatus?: ScreenerDataStatus | null;
  hideIlliquid?: boolean;
  onClose: () => void;
}) {
  const [interval, setInterval] = React.useState<StockExpandedChartInterval>(10);
  const { series, fetchedAt, isLoading, isError } = useStockExpandedCandles(row.ticker, interval);

  const chartStatus = resolveExpandedChartDataStatus(series, isLoading, isError);
  const reasonTags = buildStockInclusionReasonTags(row);
  const position = buildStockPositionSummary(row);
  const tableStatus = getStockTableStatus(row, maxTurnover);
  const range =
    row.metrics.dayRangePct != null
      ? tradingFormat.formatDayRangeMagnitude(row.metrics.dayRangePct)
      : null;
  const candleLabel = formatExpandedChartSourceLabel(series);
  const updatedLabel = formatExpandedChartFetchedAt(fetchedAt);
  const sessionNote = series ? resolveStockChartSessionLayout(series).sessionNote : null;

  return (
    <LabGlassPanel
      depth={20}
      className="mx-2 my-2 overflow-hidden border border-lab-cyan/15 bg-gradient-to-br from-black/40 via-lab-bg-deep/50 to-cyan-950/10 p-3 shadow-[0_12px_40px_rgba(2,6,23,0.45)] sm:mx-3 sm:p-4"
    >
      <div className="grid min-h-[360px] max-h-[520px] gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(200px,0.85fr)] lg:gap-4">
        <StockExpandedChart
          row={row}
          maxTurnover={maxTurnover}
          series={series}
          interval={interval}
          onIntervalChange={setInterval}
          isLoading={isLoading}
          className="min-h-[320px]"
        />

        <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <div className="flex items-start justify-between gap-2 border-b border-lab-border-soft/25 pb-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-base font-semibold tracking-wide text-lab-text-main">{row.ticker}</p>
                <p className={cn("font-mono text-sm tabular-nums", percentClass(row.percentChange))}>
                  {tradingFormat.formatSignedPercent(row.percentChange)}
                </p>
                <span
                  className={cn(
                    "inline-flex rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    stockTableStatusBadgeClass[tableStatus],
                  )}
                >
                  {tableStatus === "Ликвид" ? "Ликвидность" : tableStatus}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-lab-text-dim">{row.shortName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md border border-lab-border-soft/50 p-1 text-lab-text-dim transition hover:border-lab-border-soft hover:text-lab-text-main"
              aria-label="Закрыть"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <PanelBlock title="Почему в выборке">
            <DataRow label="Оборот" value={tradingFormat.formatTurnoverRub(row.turnover)} />
            <DataRow
              label="Сделки"
              value={row.tradesCount ? tradingFormat.formatInteger(row.tradesCount) : null}
            />
            <DataRow label={STOCK_DAY_RANGE_COLUMN_LABEL} value={range} />
            {reasonTags.length ? (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {reasonTags.map((tag) => (
                  <StatusChip key={tag} label={tag} tone="cyan" className="text-[8px] uppercase" />
                ))}
              </div>
            ) : null}
          </PanelBlock>

          <PanelBlock title="Положение">
            <DataRow label="Зона" value={position.label !== "—" ? position.label : null} />
            <DataRow label="До high" value={position.distanceToHigh} />
            <DataRow label="От low" value={position.distanceToLow} />
          </PanelBlock>

          <PanelBlock title="Данные">
            <DataRow label="Свечи" value={candleLabel} />
            <DataRow label="Источник" value="MOEX ISS" />
            <DataRow label="Обновлено" value={updatedLabel} />
            {sessionNote ? (
              <p className="pt-0.5 text-[10px] leading-snug text-lab-text-dim">{sessionNote}</p>
            ) : null}
            {chartStatus !== "live" ? (
              <div className="pt-0.5">
                <StatusChip
                  label={EXPANDED_DATA_STATUS_LABEL[chartStatus]}
                  tone={chartStatus === "partial" ? "warn" : "muted"}
                  className="text-[8px] uppercase"
                />
              </div>
            ) : null}
          </PanelBlock>

          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <Link
              href={`/stocks/${encodeURIComponent(row.ticker)}`}
              data-no-stock-tooltip="true"
              className="rounded-md border border-lab-cyan/35 bg-lab-cyan/10 px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-lab-cyan transition hover:bg-lab-cyan/15"
            >
              Карточка →
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-lab-border-soft/40 px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-lab-text-dim transition hover:text-lab-text-main"
            >
              Закрыть
            </button>
          </div>
        </aside>
      </div>
    </LabGlassPanel>
  );
}
