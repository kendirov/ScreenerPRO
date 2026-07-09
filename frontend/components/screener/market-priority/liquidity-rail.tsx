"use client";

import type { PriorityInstrument } from "@/lib/screener/market-priority-engine";
import { PriorityInstrumentRow } from "@/components/screener/market-priority/priority-instrument-row";
import { cn } from "@/lib/utils/cn";

export function LiquidityRail({
  leaders,
  className,
  caption = "исполнение · не сигнал",
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
        "rounded border border-lab-border/25 bg-transparent px-1 py-1.5 opacity-90",
        className,
      )}
      aria-label="Где деньги"
    >
      <header className="mb-1 px-0.5">
        <h2 className="font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-zinc-600">
          Где деньги
        </h2>
        <p className="text-[7px] leading-tight text-zinc-700">{caption}</p>
      </header>

      <div className="space-y-px">
        {leaders.length > 0 ? (
          leaders.map((inst) => (
            <PriorityInstrumentRow
              key={inst.secid}
              instrument={inst}
              variant="liquidity"
              active={activeTicker === inst.secid}
              onTickerClick={onTickerClick}
            />
          ))
        ) : (
          <p className="px-0.5 py-2 text-center text-[8px] text-zinc-700">—</p>
        )}
      </div>
    </section>
  );
}
