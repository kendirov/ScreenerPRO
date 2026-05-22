"use client";

import Link from "next/link";
import type { MarketLabNode } from "@/lib/domain/market-lab";
import { formatMoneyShort, formatSignedPct } from "@/lib/domain/market-lab";
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

export function MarketLabInspector({
  node,
  className,
  onClose,
  variant = "sidebar",
  zoneLabel,
  whyHere,
}: {
  node: MarketLabNode | null;
  className?: string;
  onClose?: () => void;
  variant?: "sidebar" | "overlay";
  zoneLabel?: string | null;
  whyHere?: string | null;
}) {
  if (!node) {
    if (variant === "overlay") return null;
    return (
      <aside
        className={cn(
          "rounded-xl border border-dashed border-white/[0.08] bg-slate-950/40 p-4 text-sm text-slate-500 lg:min-w-[252px] lg:max-w-[288px]",
          className,
        )}
      >
        Выберите точку на карте
      </aside>
    );
  }

  const badgeClass = STATUS_BADGE[node.status] ?? STATUS_BADGE.тихо;
  const change = node.changePct;

  return (
    <aside
      className={cn(
        "rounded-xl border border-white/[0.08] bg-slate-900/55 p-4 shadow-[0_12px_32px_rgba(2,6,23,0.35)] backdrop-blur-xl",
        variant === "overlay" ? "w-full max-w-[288px]" : "lg:min-w-[252px] lg:max-w-[288px]",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Инструмент</p>
          <p className="mt-0.5 text-xl font-semibold tracking-wide text-slate-50">{node.ticker}</p>
          <p className="truncate text-xs text-slate-500">{node.name || "—"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-slate-400 transition hover:border-white/15 hover:text-slate-200"
              aria-label="Закрыть инспектор"
            >
              Закрыть
            </button>
          ) : null}
          <span className={cn("rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide", badgeClass)}>
            {node.status}
          </span>
        </div>
      </div>
      <DetailRow label="Цена" value={tradingFormat.formatDynamicPrice(node.price ?? null)} />
      <DetailRow
        label="Изменение"
        value={formatSignedPct(node.changePct)}
        valueClass={change > 0 ? "text-emerald-300" : change < 0 ? "text-rose-300" : undefined}
      />
      <DetailRow label="Оборот" value={formatTurnoverCompact(node.turnoverRub)} />
      <DetailRow label="Сделки" value={tradingFormat.formatInteger(node.tradesCount)} />
      <DetailRow label="Ход / диапазон" value={tradingFormat.formatDayRangeMagnitude(node.rangePct ?? null)} />
      <DetailRow label="Денежный импульс" value={formatMoneyShort(node.moveWeightRub, { signed: true })} />
      {zoneLabel ? <DetailRow label="Зона" value={zoneLabel} /> : null}
      {whyHere ? (
        <div className="mt-1 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Почему здесь</p>
          <p className="mt-1 text-xs leading-snug text-slate-300">{whyHere}</p>
        </div>
      ) : null}
      <Link
        href={`/stocks/${node.ticker}`}
        className="mt-3 block rounded-lg border border-white/[0.08] bg-black/25 py-2 text-center text-xs text-slate-400 transition hover:border-white/12 hover:text-slate-200"
      >
        Открыть карточку
      </Link>
    </aside>
  );
}


