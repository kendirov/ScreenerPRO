"use client";

import type { MarketPriorityMode } from "@/lib/screener/market-priority-presets";
import { MARKET_PRIORITY_PRESETS } from "@/lib/screener/market-priority-presets";
import type { PriorityInstrument } from "@/lib/screener/market-priority-engine";
import type { InPlayGateDebugStats } from "@/lib/screener/market-priority-debug";
import { PriorityInstrumentRow } from "@/components/screener/market-priority/priority-instrument-row";
import { InPlayModeSwitch } from "@/components/screener/market-priority/in-play-mode-switch";
import { InPlayGateDiagnostics } from "@/components/screener/market-priority/in-play-gate-diagnostics";
import { cn } from "@/lib/utils/cn";

const EMPTY_COPY = "Нет confirmed in-play · см. ликвидность и прострелы";

export function InPlayPanel({
  leaders,
  mode,
  onModeChange,
  gateDebugStats,
  className,
  title = "В игре",
  subtitle = "confirmed",
  activeTicker,
  onTickerClick,
}: {
  leaders: PriorityInstrument[];
  mode: MarketPriorityMode;
  onModeChange: (mode: MarketPriorityMode) => void;
  gateDebugStats?: InPlayGateDebugStats | null;
  className?: string;
  title?: string;
  subtitle?: string;
  activeTicker?: string | null;
  onTickerClick?: (ticker: string) => void;
}) {
  const maxLabel = MARKET_PRIORITY_PRESETS[mode].maxInPlay;

  return (
    <section
      className={cn(
        "rounded border border-lab-border/35 border-l-2 border-l-cyan-500/80 bg-slate-950/70 px-2 py-2",
        className,
      )}
      aria-label="В игре"
    >
      <header className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-cyan-900/25 pb-1.5">
        <div className="min-w-0">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
            {title}
          </h2>
          <p className="mt-px font-mono text-[8px] tabular-nums text-cyan-200/40">
            {leaders.length}/{maxLabel} · {subtitle}
          </p>
        </div>
        <InPlayModeSwitch mode={mode} onChange={onModeChange} />
      </header>

      {gateDebugStats ? <InPlayGateDiagnostics stats={gateDebugStats} className="mb-1" /> : null}

      {leaders.length > 0 ? (
        <div className="space-y-1">
          {leaders.map((inst) => (
            <PriorityInstrumentRow
              key={inst.secid}
              instrument={inst}
              variant="in-play"
              active={activeTicker === inst.secid}
              onTickerClick={onTickerClick}
            />
          ))}
        </div>
      ) : (
        <p className="px-1 py-4 text-center text-[10px] leading-relaxed text-zinc-500">{EMPTY_COPY}</p>
      )}
    </section>
  );
}
