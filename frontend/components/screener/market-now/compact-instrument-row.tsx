"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

export function CompactInstrumentRow({
  row,
  selected,
  onSelect,
  detailHref,
}: {
  row: ScreenerRow;
  selected?: boolean;
  onSelect?: (ticker: string) => void;
  detailHref?: string;
}) {
  const change = row.percentChange;
  const changeClass =
    change == null ? "text-lab-dim" : change > 0 ? "text-emerald-400/90" : change < 0 ? "text-rose-400/90" : "text-lab-dim";

  const inner = (
    <>
      <span className="font-mono text-[11px] font-semibold text-lab-text">{row.ticker}</span>
      <span className={cn("ml-auto font-mono text-[11px] tabular-nums", changeClass)}>
        {change != null ? tradingFormat.formatSignedPercent(change) : "—"}
      </span>
      <span className="w-full truncate text-[9px] text-lab-dim">
        {tradingFormat.formatTurnoverRub(row.turnover)} · {row.tradesCount ? `${Math.round(row.tradesCount / 1000)}k сд.` : "—"}
      </span>
    </>
  );

  const rowClass = cn(
    "flex w-full flex-wrap items-center gap-x-2 rounded-md border px-1.5 py-1 text-left transition",
    selected ? "border-lab-cyan/40 bg-lab-cyan/8" : "border-transparent hover:border-lab-border hover:bg-lab-surface-1/50",
  );

  if (onSelect) {
    return (
      <button type="button" className={rowClass} onClick={() => onSelect(row.ticker)}>
        {inner}
      </button>
    );
  }

  if (detailHref) {
    return (
      <Link href={detailHref} className={rowClass}>
        {inner}
      </Link>
    );
  }

  return <div className={rowClass}>{inner}</div>;
}
