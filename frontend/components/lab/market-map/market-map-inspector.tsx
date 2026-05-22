"use client";

import Link from "next/link";
import type { MarketMapTile } from "@/lib/domain/market-map";
import { formatMoveWeightCompact } from "@/lib/domain/market-map";
import { classifyMarketLabStatus } from "@/lib/domain/market-lab";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] py-2 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={cn("font-mono text-sm tabular-nums text-slate-100", valueClass)}>{value}</span>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  "в игре": "border-cyan-700/35 bg-cyan-950/25 text-cyan-200/90",
  ликвидный: "border-emerald-700/30 bg-emerald-900/20 text-emerald-300/85",
  движение: "border-amber-700/30 bg-amber-950/20 text-amber-200/85",
  тихо: "border-slate-700/50 bg-slate-900/35 text-slate-400/85",
  неликвид: "border-rose-900/35 bg-rose-950/20 text-rose-300/75",
};

export function MarketMapInspector({
  tile,
  maxTurnover,
  className,
}: {
  tile: MarketMapTile | null;
  maxTurnover: number;
  className?: string;
}) {
  if (!tile) {
    return (
      <aside
        className={cn(
          "rounded-xl border border-dashed border-white/[0.08] bg-slate-950/40 p-4 text-sm text-slate-500 lg:min-w-[252px] lg:max-w-[288px]",
          className,
        )}
      >
        Выберите пузырь на карте
      </aside>
    );
  }

  const labStatus = classifyMarketLabStatus(tile.row, maxTurnover);
  const badgeClass = STATUS_BADGE[labStatus] ?? STATUS_BADGE.тихо;
  const change = tile.changePct ?? 0;

  return (
    <aside
      className={cn(
        "rounded-xl border border-white/[0.08] bg-slate-900/55 p-4 shadow-[0_12px_32px_rgba(2,6,23,0.35)] backdrop-blur-xl lg:min-w-[252px] lg:max-w-[288px]",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Инструмент</p>
          <p className="mt-0.5 text-xl font-semibold tracking-wide text-slate-50">{tile.ticker}</p>
          <p className="truncate text-xs text-slate-500">{tile.row.shortName || "—"}</p>
        </div>
        <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide", badgeClass)}>
          {labStatus}
        </span>
      </div>
      <DetailRow label="Цена" value={tradingFormat.formatDynamicPrice(tile.row.lastPrice)} />
      <DetailRow
        label="Изменение"
        value={tradingFormat.formatSignedPercent(tile.changePct)}
        valueClass={change > 0 ? "text-emerald-300" : change < 0 ? "text-rose-300" : undefined}
      />
      <DetailRow label="Оборот" value={formatTurnoverCompact(tile.turnoverRub)} />
      <DetailRow label="Сделки" value={tradingFormat.formatInteger(tile.tradesCount)} />
      <DetailRow label="Ход / диапазон" value={tradingFormat.formatDayRangeMagnitude(tile.rangePct)} />
      <DetailRow label="Денежный импульс" value={formatMoveWeightCompact(tile.moveWeightRub)} />
      <Link
        href={`/stocks/${tile.ticker}`}
        className="mt-3 block rounded-lg border border-white/[0.08] bg-black/25 py-2 text-center text-xs text-slate-400 transition hover:border-white/12 hover:text-slate-200"
      >
        Карточка инструмента →
      </Link>
    </aside>
  );
}

