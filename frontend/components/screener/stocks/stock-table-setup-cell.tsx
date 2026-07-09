"use client";

import type { InstrumentSituation } from "@/lib/screener/situation-engine";
import {
  getStockTablePriorityRoleLabel,
  type StockTablePriorityRole,
} from "@/lib/screener/stock-table-priority-badges";
import { SituationSetupCell } from "@/components/screener/stocks/situation-setup-cell";
import { cn } from "@/lib/utils/cn";

const ROLE_CLASS: Record<StockTablePriorityRole, string> = {
  focus: "border-cyan-500/50 bg-cyan-950/35 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.12)]",
  in_play: "border-cyan-700/40 bg-cyan-950/20 text-cyan-300/90",
  liquidity: "border-zinc-600/40 bg-zinc-900/35 text-zinc-400",
  volatility: "border-amber-700/45 bg-amber-950/25 text-amber-200/90",
  risk: "border-rose-800/45 bg-rose-950/25 text-rose-300/90",
};

export function StockTableSetupCell({
  situation,
  priorityRole,
}: {
  situation: InstrumentSituation;
  priorityRole: StockTablePriorityRole | null;
}) {
  const showSituationRisk = priorityRole === "risk" || situation.tags.includes("spread_risk");

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {priorityRole ? (
        <span
          className={cn(
            "inline-flex w-fit max-w-full items-center rounded border px-1 py-px font-mono text-[8px] font-semibold uppercase tracking-wide leading-tight",
            ROLE_CLASS[priorityRole],
          )}
        >
          {getStockTablePriorityRoleLabel(priorityRole)}
        </span>
      ) : null}
      <SituationSetupCell
        situation={situation}
        showScore={priorityRole === "focus" || priorityRole === "in_play"}
        showMarketRisk={showSituationRisk}
      />
    </div>
  );
}
