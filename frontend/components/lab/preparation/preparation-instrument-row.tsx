"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { BriefingSelectionButton } from "@/components/lab/preparation/briefing-selection-button";
import {
  computePreparationChanges,
  MARKET_DATA_FRESHNESS_LABELS,
  resolveInstrumentDataStatus,
  shouldShowLiveScreenerMetrics,
} from "@/lib/domain/market-data-status";
import {
  REASON_TAG_LABELS,
  type PreparationCandleSeries,
  type PreparationReasonTag,
  type ResolvedPreparationInstrument,
} from "@/lib/domain/preparation-watchlist";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

export function PreparationInstrumentRow({
  instrument,
  candleSeries,
  reasonTag,
  hasLiveMetrics,
  selected = false,
  onToggleBriefing,
  showBriefingToggle = true,
  showDataStatus = false,
  className,
}: {
  instrument: ResolvedPreparationInstrument;
  candleSeries: PreparationCandleSeries | null;
  reasonTag: PreparationReasonTag;
  hasLiveMetrics: boolean;
  selected?: boolean;
  onToggleBriefing?: () => void;
  showBriefingToggle?: boolean;
  showDataStatus?: boolean;
  className?: string;
}) {
  const row = instrument.screenerRow;
  const candles = candleSeries?.status === "ok" ? candleSeries.candles : [];
  const dataStatus = resolveInstrumentDataStatus({
    candleSeries,
    screenerRow: row,
    hasLiveMoex: hasLiveMetrics,
    isExternal: instrument.market === "global" || instrument.market === "manual",
  });
  const changes = computePreparationChanges(candles, dataStatus, row);
  const showLive = shouldShowLiveScreenerMetrics(dataStatus);
  const ticker = instrument.resolvedSecid ?? instrument.symbol;

  const href =
    instrument.resolvedSecid && instrument.market !== "global" && instrument.market !== "manual"
      ? instrument.market === "moex-future"
        ? `/futures/${instrument.resolvedSecid}`
        : `/stocks/${instrument.resolvedSecid}`
      : null;

  return (
    <li
      className={cn(
        "rounded-md border border-lab-border/50 bg-lab-bg-deep/25 px-2 py-1.5",
        selected && "border-lab-violet/35 ring-1 ring-lab-violet/15",
        (reasonTag === "inplay" || row?.metrics.isInPlay) && !selected && "border-lab-green/30",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {href ? (
          <Link href={href} className="shrink-0 font-mono text-[11px] font-semibold text-lab-text hover:text-lab-cyan">
            {ticker}
          </Link>
        ) : (
          <span className="shrink-0 font-mono text-[11px] font-semibold text-lab-text">{ticker}</span>
        )}

        <MetricCell label="1д" value={changes.change1d} hint={changes.change1dHint} />
        <MetricCell label="5д" value={changes.change5d} hint={changes.change5dHint} />

        <span className="hidden min-w-[48px] text-right font-mono text-[9px] text-lab-muted sm:inline">
          {formatTurnover(row, showLive)}
        </span>

        {showDataStatus ? (
          <span
            className="hidden max-w-[88px] truncate font-mono text-[8px] text-lab-dim lg:inline"
            title={dataStatus.label}
          >
            {shortDataStatusLabel(dataStatus.label)}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[9px] text-lab-dim">
            {REASON_TAG_LABELS[reasonTag]} · {instrument.reason}
          </span>
        )}

        {showBriefingToggle && onToggleBriefing ? (
          <BriefingSelectionButton selected={selected} onToggle={onToggleBriefing} compact />
        ) : null}
      </div>
    </li>
  );
}

function MetricCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint: string | null;
}) {
  if (value == null) {
    return (
      <span className="shrink-0 font-mono text-[9px] text-lab-dim" title={hint ?? undefined}>
        {label} —
      </span>
    );
  }

  const tone = value > 0 ? "text-lab-green" : value < 0 ? "text-lab-red" : "text-lab-muted";

  return (
    <span className={cn("shrink-0 font-mono text-[9px] tabular-nums", tone)}>
      {label} {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function formatTurnover(row: ScreenerRow | null, showLive: boolean): string {
  if (!showLive || !row?.turnover) return "—";
  return tradingFormat.formatTurnoverRub(row.turnover).replace(/\s?₽/g, "");
}

function shortDataStatusLabel(label: string): string {
  if (label.includes("не подключён")) return "внешний";
  if (label.includes("Данных сегодня нет")) return "нет сегодня";
  if (label.includes("Последняя свеча")) return label.replace("Последняя свеча ", "свеча ");
  if (label === "онлайн MOEX") return "live";
  return MARKET_DATA_FRESHNESS_LABELS.live === label ? "live" : label.slice(0, 14);
}
