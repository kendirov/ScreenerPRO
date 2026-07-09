"use client";

import type { PriorityInstrument } from "@/lib/screener/market-priority-engine";
import { PriorityInstrumentRow } from "@/components/screener/market-priority/priority-instrument-row";
import { cn } from "@/lib/utils/cn";

export function VolatilityPanel({
  leaders,
  className,
  caption = "движение · качество ниже",
  activeTicker,
  onTickerClick,
}: {
  leaders: PriorityInstrument[];
  className?: string;
  caption?: string;
  activeTicker?: string | null;
  onTickerClick?: (ticker: string) => void;
}) {
  return (
    <section
      className={cn(
        "rounded border border-lab-border/30 border-l-2 border-l-amber-600/35 bg-slate-950/40 px-1.5 py-1.5",
        className,
      )}
      aria-label="Волатильность"
    >
      <header className="mb-1">
        <h2 className="font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-amber-200/70">
          Прострелы
        </h2>
        <p className="text-[7px] leading-tight text-amber-200/35">{caption}</p>
      </header>

      {leaders.length > 0 ? (
        <div className="space-y-px">
          {leaders.map((inst) => (
            <PriorityInstrumentRow
              key={inst.secid}
              instrument={inst}
              variant="volatility"
              active={activeTicker === inst.secid}
              onTickerClick={onTickerClick}
            />
          ))}
        </div>
      ) : (
        <p className="px-0.5 py-2 text-center text-[8px] text-amber-200/30">—</p>
      )}
    </section>
  );
}
