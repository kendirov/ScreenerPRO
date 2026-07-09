"use client";

import type { MarketPriorityResult } from "@/lib/screener/market-priority-engine";
import type { MarketPriorityMode } from "@/lib/screener/market-priority-presets";
import type { InPlayGateDebugStats } from "@/lib/screener/market-priority-debug";
import { InPlayPanel } from "@/components/screener/market-priority/in-play-panel";
import { LiquidityRail } from "@/components/screener/market-priority/liquidity-rail";
import { VolatilityPanel } from "@/components/screener/market-priority/volatility-panel";
import { cn } from "@/lib/utils/cn";

export function StockScreenerCommandBar({
  priority,
  mode,
  onModeChange,
  gateDebugStats,
  selectedTicker,
  onTickerClick,
  onClearSelection,
  isLoading,
  className,
}: {
  priority: MarketPriorityResult | null;
  mode: MarketPriorityMode;
  onModeChange: (mode: MarketPriorityMode) => void;
  gateDebugStats?: InPlayGateDebugStats | null;
  selectedTicker?: string | null;
  onTickerClick?: (ticker: string) => void;
  onClearSelection?: () => void;
  isLoading?: boolean;
  className?: string;
}) {
  const inPlay = priority?.focusInPlayLeaders ?? priority?.inPlayLeaders ?? [];
  const liquidity = priority?.liquidityLeaders ?? [];
  const volatility = priority?.volatilityLeaders ?? [];

  if (isLoading) {
    return (
      <section
        className={cn(
          "rounded border border-white/[0.06] bg-slate-950/50 px-2 py-3",
          className,
        )}
        aria-label="Command Bar"
        aria-busy="true"
      >
        <p className="text-center font-mono text-[9px] text-lab-text-dim">Загрузка приоритетов…</p>
      </section>
    );
  }

  const shared = {
    activeTicker: selectedTicker,
    onTickerClick,
  };

  return (
    <section
      className={cn("space-y-1.5 border-b border-white/[0.05] pb-1.5", className)}
      aria-label="Stock Screener Command Bar"
    >
      {selectedTicker ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <p className="font-mono text-[9px] text-cyan-300/85">
            Выбрано: <span className="font-semibold text-cyan-200">{selectedTicker}</span>
          </p>
          {onClearSelection ? (
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[8px] text-lab-text-dim transition hover:border-white/20 hover:text-lab-text-main"
            >
              Сбросить
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5 lg:hidden">
        <InPlayPanel
          leaders={inPlay}
          mode={mode}
          onModeChange={onModeChange}
          gateDebugStats={gateDebugStats}
          title="В игре · фокус"
          {...shared}
        />
        <LiquidityRail
          leaders={liquidity}
          caption="ликвидность ≠ сигнал"
          {...shared}
        />
        <VolatilityPanel
          leaders={volatility}
          caption="движение есть, качество ниже"
          {...shared}
        />
      </div>

      <div className="hidden gap-1.5 lg:grid lg:grid-cols-[8.5rem_minmax(0,1fr)_8.5rem] lg:items-start xl:grid-cols-[9rem_minmax(0,1.1fr)_9rem]">
        <LiquidityRail
          leaders={liquidity}
          caption="ликвидность ≠ сигнал"
          {...shared}
        />
        <InPlayPanel
          leaders={inPlay}
          mode={mode}
          onModeChange={onModeChange}
          gateDebugStats={gateDebugStats}
          title="В игре · фокус"
          {...shared}
        />
        <VolatilityPanel
          leaders={volatility}
          caption="движение есть, качество ниже"
          {...shared}
        />
      </div>
    </section>
  );
}
