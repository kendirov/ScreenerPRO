"use client";

import Link from "next/link";
import type { ScreenerRow } from "@screenerpro/shared";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";
import { percentClass } from "./dashboard-styles";

interface MovementRailProps {
  rows: ScreenerRow[];
}

function TrendIcon({ value }: { value: number | null }) {
  if ((value ?? 0) > 0) {
    return <span className="text-emerald-400/90" aria-hidden>▲</span>;
  }
  if ((value ?? 0) < 0) {
    return <span className="text-rose-400/90" aria-hidden>▼</span>;
  }
  return <span className="text-slate-500" aria-hidden>•</span>;
}

export function MovementRail({ rows }: MovementRailProps) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">Нет выраженного движения</p>;
  }

  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-min gap-2 px-1">
        {rows.map((row) => {
          const href = row.assetClass === "stock" ? `/stocks/${row.ticker}` : `/futures/${row.ticker}`;
          const dayRange = row.metrics.dayRangePct;
          const delta = tradingFormat.formatDeltaPercent(row.percentChange);
          const rangePart =
            dayRange !== null ? ` · ход ${tradingFormat.formatDayRangeMagnitude(dayRange)}` : "";

          return (
            <Link
              key={`${row.assetClass}-${row.ticker}`}
              href={href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/35 px-3 py-1.5 text-[11px] transition hover:border-amber-400/25 hover:bg-amber-950/15"
            >
              <TrendIcon value={row.percentChange} />
              <span className="whitespace-nowrap font-mono tabular-nums text-slate-200">
                <span className="font-sans font-semibold text-slate-100">{row.ticker}</span>
                {"  "}
                <span className={percentClass(row.percentChange)}>{delta}</span>
                {rangePart ? <span className="text-slate-500">{rangePart}</span> : null}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
