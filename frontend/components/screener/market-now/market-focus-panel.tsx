"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import { CompactInstrumentRow } from "@/components/screener/market-now/compact-instrument-row";
import { cn } from "@/lib/utils/cn";

export function MarketFocusPanel({
  title,
  rows,
  href,
  emptyText,
  className,
  onSelect,
  selectedTicker,
}: {
  title: string;
  rows: ScreenerRow[];
  href?: string;
  emptyText?: string;
  className?: string;
  onSelect?: (ticker: string) => void;
  selectedTicker?: string | null;
}) {
  return (
    <LabGlassPanel depth={10} className={cn("flex min-h-0 flex-col px-2 py-2", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-lab-muted">{title}</h3>
        {href ? (
          <Link href={href} className="text-[10px] text-lab-dim transition hover:text-lab-cyan">
            →
          </Link>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-1 py-2 text-[10px] text-lab-dim">{emptyText ?? "—"}</p>
        ) : (
          rows.map((row) => (
            <CompactInstrumentRow
              key={row.ticker}
              row={row}
              selected={selectedTicker === row.ticker}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </LabGlassPanel>
  );
}
