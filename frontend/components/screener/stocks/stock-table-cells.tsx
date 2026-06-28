"use client";

import type { ScreenerRow } from "@screenerpro/shared";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CopyTickerBadge } from "@/components/screener/copy-ticker-badge";
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
import {
  buildTradesRatioTooltip,
  buildVolumeRatioTooltip,
  formatTradesRatioDisplayParts,
  formatVolumeRatioDisplayParts,
} from "@/lib/domain/baseline-info";
import {
  buildVolXTableTitle,
  formatVolXCompact,
  resolveStockVolumeRatio,
  volXTableHighlightClass,
} from "@/lib/domain/stock-volume-ratio";
import { mergeTradingTags } from "@/lib/domain/trading-tags";
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
    <div className="group/ticker flex min-w-0 items-center gap-1" data-stock-tooltip-anchor="true">
      <CopyTickerBadge ticker={row.ticker} />
      <Link
        href={`/stocks/${encodeURIComponent(row.ticker)}`}
        onClick={(event) => event.stopPropagation()}
        className="shrink-0 rounded p-0.5 text-lab-text-dim opacity-0 transition hover:text-lab-cyan focus-visible:opacity-100 group-hover/ticker:opacity-60"
        title={`Карточка ${row.ticker}`}
        aria-label={`Открыть карточку ${row.ticker}`}
      >
        <ArrowUpRight className="h-3 w-3" aria-hidden />
      </Link>
      {chip ? (
        <StatusChip label={chip.label} tone={chip.tone} className="hidden shrink-0 text-[7px] uppercase sm:inline-flex" />
      ) : inPlay ? (
        <StatusChip label="в игре" tone="cyan" className="hidden shrink-0 text-[7px] uppercase sm:inline-flex" />
      ) : null}
    </div>
  );
}

function VolXInline({ row }: { row: ScreenerRow }) {
  const volRatio = resolveStockVolumeRatio(row);
  const label = formatVolXCompact(volRatio);
  const empty = volRatio == null;

  return (
    <span
      className={cn(
        "font-mono text-[10px] tabular-nums leading-none",
        empty ? "text-lab-text-dim/80" : volXTableHighlightClass(volRatio),
      )}
      title={buildVolXTableTitle(row)}
    >
      {label}
    </span>
  );
}

export function StockTurnoverCell({
  row,
  value,
  maxTurnover,
}: {
  row: ScreenerRow;
  value: number | null;
  maxTurnover: number;
}) {
  const barRatio = maxTurnover > 0 && hasMetricValue(value) ? Math.min(1, value! / maxTurnover) : 0;
  const compact = formatTurnoverCompact(value);

  return (
    <NumericCell>
      <CompactMetric
        value={compact}
        detail={hasMetricValue(value) ? tradingFormat.formatTurnoverRub(value) : undefined}
        valueClassName={cn(numberCellClass, "text-lab-text-main")}
        className="block text-right"
      />
      <div className="mt-0.5 flex justify-end md:hidden">
        <VolXInline row={row} />
      </div>
      {hasMetricValue(value) ? (
        <div className="ml-auto mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-emerald-400/28 transition-all"
            style={{ width: `${Math.max(barRatio * 100, 2)}%` }}
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
            ? "bg-cyan-400/65 shadow-[0_0_5px_rgba(34,211,238,0.28)]"
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

export function StockVolumeRatioCell({ row }: { row: ScreenerRow }) {
  const parts = formatVolumeRatioDisplayParts(row);
  const volRatio = resolveStockVolumeRatio(row);
  const label = parts.showAsVolX ? formatVolXCompact(volRatio) : "—";
  const tooltip = buildVolumeRatioTooltip(row);

  return (
    <NumericCell>
      <span
        className={cn(
          numberCellClass,
          "whitespace-nowrap",
          !parts.showAsVolX ? "text-lab-text-dim/80" : volXTableHighlightClass(volRatio),
        )}
        title={[tooltip.title, ...tooltip.lines].join("\n")}
      >
        {label}
      </span>
      <p className="mt-0.5 truncate text-right font-mono text-[9px] leading-none text-lab-text-dim/75">
        {parts.baselineLabel}
      </p>
    </NumericCell>
  );
}

export function StockTradesRatioCell({ row }: { row: ScreenerRow }) {
  const parts = formatTradesRatioDisplayParts(row);
  const tooltip = buildTradesRatioTooltip(row);

  return (
    <NumericCell>
      <span
        className={cn(
          numberCellClass,
          "whitespace-nowrap",
          !parts.showAsVolX ? "text-lab-text-dim/80" : "text-lab-text-main",
        )}
        title={[tooltip.title, ...tooltip.lines].join("\n")}
      >
        {parts.showAsVolX ? parts.primary : "—"}
      </span>
      <p className="mt-0.5 truncate text-right font-mono text-[9px] leading-none text-lab-text-dim/75">
        {parts.baselineLabel}
      </p>
    </NumericCell>
  );
}

const TAG_TONE_CLASS = {
  risk: "border-rose-500/30 bg-rose-950/30 text-rose-200/90",
  in_play: "border-cyan-500/35 bg-cyan-950/25 text-cyan-200/90",
  liquidity: "border-slate-600/40 bg-slate-900/40 text-slate-300",
  movement: "border-amber-500/30 bg-amber-950/25 text-amber-100/90",
  neutral: "border-slate-600/35 bg-slate-900/35 text-slate-400",
  dead: "border-slate-700/40 bg-slate-950/50 text-slate-500",
} as const;

export function StockTradingTagsCell({ row, maxTurnover }: { row: ScreenerRow; maxTurnover: number }) {
  const tags = mergeTradingTags(row, maxTurnover, 4);
  if (!tags.length) return <span className="text-[10px] text-lab-dim">—</span>;

  return (
    <div className="flex max-w-[9rem] flex-wrap gap-0.5" title={tags.map((t) => `${t.label}: ${t.explanation}`).join("\n")}>
      {tags.map((tag) => (
        <span
          key={tag.key}
          className={cn(
            "inline-flex max-w-full truncate rounded border px-1 py-px font-mono text-[8px] uppercase tracking-wide",
            TAG_TONE_CLASS[tag.tone],
          )}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}
