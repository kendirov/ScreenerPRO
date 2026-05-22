"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { formatReasonTagsForCard, formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";
import { percentClass } from "./dashboard-styles";

export function SignalRail({ rows, className }: { rows: ScreenerRow[]; className?: string }) {
  if (!rows.length) {
    return (
      <aside
        className={cn(
          "rounded-2xl bg-white/[0.02] px-3 py-4 ring-1 ring-white/[0.05] backdrop-blur-xl",
          className,
        )}
      >
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Лента сигналов</p>
        <p className="mt-2 text-xs text-white/45">Пока пусто</p>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "rounded-2xl bg-white/[0.02] px-2 py-2.5 ring-1 ring-white/[0.05] backdrop-blur-xl",
        className,
      )}
    >
      <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.14em] text-white/40">Лента сигналов</p>
      <ul className="space-y-0.5">
        {rows.map((row) => {
          const reason = formatReasonTagsForCard(row)[0] ?? row.metrics.reasonLabel ?? "активность";
          return (
            <li key={row.ticker}>
              <Link
                href={`/stocks/${row.ticker}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]"
              >
                <span className="min-w-[3.5rem] font-semibold tracking-wide text-white">{row.ticker}</span>
                <span className={cn("font-mono text-xs tabular-nums", percentClass(row.percentChange))}>
                  {tradingFormat.formatSignedPercent(row.percentChange)}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-white/50">
                  {formatTurnoverCompact(row.turnover)}
                </span>
                <span className="w-full truncate text-[10px] uppercase tracking-wide text-cyan-200/45 sm:w-auto sm:max-w-[7rem]">
                  {reason}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
