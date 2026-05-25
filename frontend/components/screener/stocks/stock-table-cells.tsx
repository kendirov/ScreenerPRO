"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import Link from "next/link";
import {
  CompactMetric,
  StatusChip,
  hasMetricValue,
} from "@/components/ui/metrics-minimalism";
import {
  getStockTableStatus,
  isStockInPlay,
  STOCK_DAY_RANGE_DETAIL_HINT,
  type StockTableStatus,
} from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

const TICKER_STATUS_CHIP: Partial<Record<StockTableStatus, { label: string; tone: "cyan" | "amber" | "rose" | "warn" }>> = {
  "В игре": { label: "в игре", tone: "cyan" },
  Импульс: { label: "импульс", tone: "amber" },
  Давление: { label: "давление", tone: "rose" },
  "Тонкий разгон": { label: "разгон", tone: "warn" },
};

const numberCellClass = "font-mono tabular-nums text-[12px]";

function NumericCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full text-right", className)}>{children}</div>;
}

export function formatTurnoverCompact(value: number | null): string {
  if (!hasMetricValue(value)) return "—";
  return tradingFormat.formatTurnoverRub(value).replace(/\s?₽/g, "");
}

export function StockTickerCell({ row, maxTurnover }: { row: ScreenerRow; maxTurnover?: number }) {
  const status = maxTurnover != null ? getStockTableStatus(row, maxTurnover) : null;
  const chip = status ? TICKER_STATUS_CHIP[status] : null;
  const inPlay = isStockInPlay(row);

  return (
    <div className="flex min-w-0 items-center gap-1.5" data-stock-tooltip-anchor="true">
      <Link
        href={`/stocks/${encodeURIComponent(row.ticker)}`}
        onClick={(event) => event.stopPropagation()}
        className="truncate font-semibold tracking-[0.04em] text-lab-text-main transition hover:text-lab-cyan"
      >
        {row.ticker}
      </Link>
      {chip ? (
        <StatusChip label={chip.label} tone={chip.tone} className="hidden shrink-0 text-[7px] uppercase sm:inline-flex" />
      ) : inPlay ? (
        <StatusChip label="в игре" tone="cyan" className="hidden shrink-0 text-[7px] uppercase sm:inline-flex" />
      ) : null}
    </div>
  );
}

export function StockTurnoverCell({
  value,
  maxTurnover,
}: {
  value: number | null;
  maxTurnover: number;
}) {
  const ratio = maxTurnover > 0 && hasMetricValue(value) ? Math.min(1, value! / maxTurnover) : 0;
  const compact = formatTurnoverCompact(value);

  return (
    <NumericCell>
      <CompactMetric
        value={compact}
        detail={hasMetricValue(value) ? tradingFormat.formatTurnoverRub(value) : undefined}
        valueClassName={cn(numberCellClass, "text-lab-text-main")}
        className="block text-right"
      />
      {hasMetricValue(value) ? (
        <div className="ml-auto mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-emerald-400/28 transition-all"
            style={{ width: `${Math.max(ratio * 100, 2)}%` }}
          />
        </div>
      ) : (
        <div className="mt-0.5 h-0.5" aria-hidden />
      )}
    </NumericCell>
  );
}

export function StockTradesCell({ row }: { row: ScreenerRow }) {
  const trades = row.tradesCount;
  const hot = (row.metrics.tradesPercentile ?? 0) >= 72;
  const hasTrades = hasMetricValue(trades);
  const formatted = hasTrades ? tradingFormat.formatInteger(trades!) : "—";

  return (
    <div className="grid w-full grid-cols-[6px_minmax(0,1fr)] items-center gap-1">
      <span
        className={cn(
          "mx-auto h-1.5 w-1.5 shrink-0 rounded-full",
          hot && hasTrades
            ? "animate-pulse bg-cyan-400/75 shadow-[0_0_6px_rgba(34,211,238,0.45)]"
            : "bg-transparent",
        )}
        aria-hidden
      />
      <CompactMetric
        value={formatted}
        detail={hasTrades ? `${formatted} сделок` : undefined}
        valueClassName={cn(numberCellClass, "block text-right text-lab-text-main")}
        className="block w-full text-right"
      />
    </div>
  );
}

export function StockRangeCell({ row }: { row: ScreenerRow }) {
  const range = row.metrics.dayRangePct;
  const high = Math.abs(range ?? 0) >= 2.2 || (row.metrics.rangePercentile ?? 0) >= 72;

  if (range == null) {
    return (
      <NumericCell>
        <span className={cn(numberCellClass, "text-lab-text-dim")}>—</span>
      </NumericCell>
    );
  }

  return (
    <NumericCell>
      <span
        className={cn(
          numberCellClass,
          "whitespace-nowrap",
          high ? "font-medium text-lab-amber" : "text-lab-text-main",
        )}
        title={`${STOCK_DAY_RANGE_DETAIL_HINT}: ${tradingFormat.formatDayRangeMagnitude(range)}`}
      >
        {tradingFormat.formatDayRangeMagnitude(range)}
      </span>
    </NumericCell>
  );
}

export function StockPercentCell({ value }: { value: number | null }) {
  const cls =
    value != null && value > 0
      ? "text-lab-green"
      : value != null && value < 0
        ? "text-lab-red"
        : "text-lab-text-dim";

  return (
    <NumericCell>
      <span className={cn(numberCellClass, cls)}>{tradingFormat.formatSignedPercent(value)}</span>
    </NumericCell>
  );
}

export function StockPriceCell({ value }: { value: number | null }) {
  return (
    <NumericCell>
      <CompactMetric
        value={tradingFormat.formatDynamicPrice(value)}
        valueClassName={cn(numberCellClass, "text-lab-text-main")}
        className="block text-right"
      />
    </NumericCell>
  );
}
