"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { ScreenerRow } from "@screenerpro/shared";
import Link from "next/link";
import { StockMiniSparkline } from "@/components/screener/stocks/stock-mini-sparkline";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { StatusChip, hasMetricValue } from "@/components/ui/metrics-minimalism";
import {
  getStockTableStatus,
  parseInPlayReasonTags,
  STOCK_DAY_RANGE_COLUMN_LABEL,
  stockTableStatusBadgeClass,
  type StockTableStatus,
} from "@/lib/domain/stock-screener-display";
import { formatSparklineSourceLabel, type StockSparklineSeries } from "@/lib/domain/stock-sparkline";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

const CARD_WIDTH = 340;
const CARD_MAX_HEIGHT = 320;
const VIEWPORT_PAD = 12;
const ROW_GAP = 10;
const TICKER_ZONE_RATIO = 0.22;
const DETAILS_ZONE_RATIO = 0.1;

export function isNoStockTooltipTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-no-stock-tooltip="true"]'));
}

export type StockRowHoverAnchor = {
  ticker: string;
  clientX: number;
  clientY: number;
  rowTop?: number;
  rowBottom?: number;
  rowLeft?: number;
  rowRight?: number;
};

const HOVER_STATUS_LABEL: Record<StockTableStatus, string> = {
  Ликвид: "Ликвидность",
  "В игре": "В игре",
  Импульс: "Импульс",
  Давление: "Давление",
  "Тонкий разгон": "Тонкий разгон",
  Пассив: "Пассив",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveCardPosition(
  anchor: StockRowHoverAnchor,
  cardWidth: number,
  cardHeight: number,
): { top: number; left: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  const rowTop = anchor.rowTop ?? anchor.clientY - 18;
  const rowBottom = anchor.rowBottom ?? anchor.clientY + 18;
  const rowLeft = anchor.rowLeft ?? anchor.clientX - 40;
  const rowRight = anchor.rowRight ?? anchor.clientX + 40;
  const rowWidth = Math.max(rowRight - rowLeft, 96);
  const rowCenterY = (rowTop + rowBottom) / 2;
  const tickerRight = rowLeft + rowWidth * TICKER_ZONE_RATIO;
  const detailsGuardLeft = rowRight - rowWidth * DETAILS_ZONE_RATIO;
  const effectiveHeight = Math.min(cardHeight, CARD_MAX_HEIGHT);

  const spaceBelow = vh - rowBottom - VIEWPORT_PAD;
  const spaceAbove = rowTop - VIEWPORT_PAD;
  let top: number;

  if (spaceBelow >= effectiveHeight + ROW_GAP) {
    top = rowBottom + ROW_GAP;
  } else if (spaceAbove >= effectiveHeight + ROW_GAP) {
    top = rowTop - effectiveHeight - ROW_GAP;
  } else {
    top = rowCenterY - effectiveHeight / 2;
  }
  top = clamp(top, VIEWPORT_PAD, vh - effectiveHeight - VIEWPORT_PAD);

  let left = tickerRight + ROW_GAP;
  const maxLeftBeforeDetails = detailsGuardLeft - cardWidth - ROW_GAP;

  if (left + cardWidth > detailsGuardLeft) {
    left = rowLeft + ROW_GAP;
  }
  if (left + cardWidth + VIEWPORT_PAD > vw) {
    left = rowLeft - cardWidth - ROW_GAP;
  }
  if (left < VIEWPORT_PAD) {
    left = rowLeft + ROW_GAP;
  }
  left = clamp(left, VIEWPORT_PAD, Math.min(vw - cardWidth - VIEWPORT_PAD, maxLeftBeforeDetails));

  return { top, left };
}

function percentClass(value: number | null): string {
  if ((value ?? 0) > 0) return "text-lab-green";
  if ((value ?? 0) < 0) return "text-lab-red";
  return "text-lab-text-dim";
}

function formatCandlesLabel(series: StockSparklineSeries | null | undefined): string {
  if (!series || series.status !== "ok") return "недоступны";
  return formatSparklineSourceLabel(series) ?? "есть";
}

function buildReasonTags(row: ScreenerRow, status: StockTableStatus): string[] {
  const statusNorm = HOVER_STATUS_LABEL[status].toLowerCase();
  return parseInPlayReasonTags(row)
    .filter((tag) => !statusNorm.includes(tag) && tag !== statusNorm)
    .slice(0, 3);
}

function MetricLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-2">
      <dt className="text-[10px] text-lab-text-dim">{label}</dt>
      <dd className="truncate text-right font-mono text-[10px] tabular-nums text-lab-text-main">
        {value ?? "—"}
      </dd>
    </div>
  );
}

export function StockRowHoverCard({
  row,
  maxTurnover,
  series,
  anchor,
  onMouseEnter,
  onMouseLeave,
}: {
  row: ScreenerRow;
  maxTurnover: number;
  series: StockSparklineSeries | null | undefined;
  anchor: StockRowHoverAnchor;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState(() => resolveCardPosition(anchor, CARD_WIDTH, 260));

  const tableStatus = getStockTableStatus(row, maxTurnover);
  const statusLabel = HOVER_STATUS_LABEL[tableStatus];
  const reasonTags = buildReasonTags(row, tableStatus);

  const trades = row.tradesCount;
  const range =
    row.metrics.dayRangePct != null
      ? tradingFormat.formatDayRangeMagnitude(row.metrics.dayRangePct)
      : null;

  React.useLayoutEffect(() => {
    const width = cardRef.current?.offsetWidth ?? CARD_WIDTH;
    const height = Math.min(cardRef.current?.offsetHeight ?? 260, CARD_MAX_HEIGHT);
    setPosition(resolveCardPosition(anchor, width, height));
  }, [anchor.clientX, anchor.clientY, anchor.rowTop, anchor.rowBottom, anchor.rowLeft, anchor.rowRight, anchor.ticker, row.ticker]);

  const card = (
    <div
      ref={cardRef}
      className="pointer-events-auto fixed z-[80] w-[min(340px,calc(100vw-24px))] max-w-[360px]"
      style={{ top: position.top, left: position.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <LabGlassPanel
        depth={20}
        className="max-h-[320px] overflow-hidden border border-lab-border/35 p-2.5 shadow-[0_10px_28px_rgba(2,6,23,0.42)]"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-[15px] font-semibold tracking-wide text-lab-text-main">{row.ticker}</p>
              <p className={cn("font-mono text-[12px] tabular-nums", percentClass(row.percentChange))}>
                {tradingFormat.formatSignedPercent(row.percentChange)}
              </p>
            </div>
            <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-lab-text-dim">{row.shortName}</p>
          </div>
          <StockMiniSparkline
            series={series}
            dayHigh={row.high}
            dayLow={row.low}
            changePct={row.percentChange}
            size="compact"
          />
        </div>

        <div className="mt-2">
          <span
            className={cn(
              "inline-flex rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
              stockTableStatusBadgeClass[tableStatus],
            )}
          >
            {statusLabel}
          </span>
        </div>

        {reasonTags.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {reasonTags.map((tag) => (
              <StatusChip key={tag} label={tag} tone="muted" className="text-[8px] uppercase" />
            ))}
          </div>
        ) : null}

        <dl className="mt-2 space-y-0.5 border-t border-lab-border-soft/30 pt-2">
          <MetricLine label="Цена" value={tradingFormat.formatDynamicPrice(row.lastPrice)} />
          <MetricLine label="Оборот" value={tradingFormat.formatTurnoverRub(row.turnover)} />
          <MetricLine
            label="Сделки"
            value={hasMetricValue(trades) ? tradingFormat.formatInteger(trades!) : null}
          />
          <MetricLine label={STOCK_DAY_RANGE_COLUMN_LABEL} value={range} />
          <MetricLine label="Свечи" value={formatCandlesLabel(series)} />
        </dl>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-lab-border-soft/30 pt-1.5">
          <p className="text-[9px] leading-snug text-lab-text-dim">Кнопка «Детали» — большой график</p>
          <Link
            href={`/stocks/${encodeURIComponent(row.ticker)}`}
            data-no-stock-tooltip="true"
            className="shrink-0 text-[9px] uppercase tracking-wide text-lab-cyan transition hover:text-lab-cyan/80"
            onClick={(event) => event.stopPropagation()}
          >
            Карточка →
          </Link>
        </div>
      </LabGlassPanel>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(card, document.body);
}

export function buildHoverAnchorFromEvent(ticker: string, event: React.MouseEvent): StockRowHoverAnchor {
  const rowEl = (event.currentTarget as HTMLElement).closest("tr");
  const tickerAnchor = rowEl?.querySelector<HTMLElement>('[data-stock-tooltip-anchor="true"]');
  const rect = (tickerAnchor ?? rowEl)?.getBoundingClientRect();
  const rowRect = rowEl?.getBoundingClientRect();

  return {
    ticker,
    clientX: event.clientX,
    clientY: event.clientY,
    rowTop: rowRect?.top,
    rowBottom: rowRect?.bottom,
    rowLeft: rect?.left ?? rowRect?.left,
    rowRight: rowRect?.right,
  };
}

export function patchHoverAnchorPosition(
  anchor: StockRowHoverAnchor,
  clientX: number,
  clientY: number,
): StockRowHoverAnchor {
  return { ...anchor, clientX, clientY };
}
