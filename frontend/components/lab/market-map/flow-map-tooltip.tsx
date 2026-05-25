"use client";

import {
  flowNodeColor,
  formatRelativeTurnover,
  getFlowDataStatusLabel,
  getFlowStateLabel,
  getStateShiftLabel,
  isNotableStateShift,
  type MarketFlowNode,
} from "@/lib/domain/market-flow-map";
import { formatSignedPct } from "@/lib/domain/market-lab";
import { formatTurnoverCompact } from "@/lib/domain/screener-overview";
import { tradingFormat } from "@/lib/formatters/trading";
import { cn } from "@/lib/utils/cn";

const STATUS_BADGE: Record<string, string> = {
  "money-growth": "border-emerald-700/30 bg-emerald-950/30 text-emerald-200/90",
  "money-pressure": "border-rose-800/30 bg-rose-950/30 text-rose-200/90",
  "thin-move": "border-amber-700/25 bg-amber-950/25 text-amber-200/90",
  noise: "border-slate-700/35 bg-slate-900/40 text-slate-400",
  neutral: "border-slate-700/35 bg-slate-900/40 text-slate-400",
};

function hasValue(value: string | null | undefined): value is string {
  return Boolean(value && value !== "—" && value !== "нет вчерашнего сравнения");
}

export function FlowMapTooltip({
  node,
  showComparison = false,
  style,
  className,
}: {
  node: MarketFlowNode;
  showComparison?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const colors = flowNodeColor(node.colorScore);
  const change = node.openChangePct ?? node.changePct;
  const badge = STATUS_BADGE[node.flowState] ?? STATUS_BADGE.neutral;
  const relativeLabel = formatRelativeTurnover(node.relativeTurnover);
  const reason =
    node.reasonTags.find((tag) => !tag.startsWith("Деньги") && !tag.startsWith("Нейтрально")) ??
    node.reasonTags[0] ??
    null;

  const tradesLabel =
    node.trades != null && node.trades > 0 ? tradingFormat.formatInteger(node.trades) : null;
  const rangeLabel =
    node.rangePct != null ? tradingFormat.formatDayRangeMagnitude(node.rangePct) : null;
  const yesterdayLabel =
    node.yesterdayTurnoverAtSameTime != null && node.yesterdayTurnoverAtSameTime > 0
      ? formatTurnoverCompact(node.yesterdayTurnoverAtSameTime)
      : null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-40 w-[min(240px,calc(100vw-24px))] rounded-xl",
        "border border-white/[0.08] bg-slate-950/94 px-3 py-2.5",
        "shadow-[0_16px_48px_rgba(0,0,0,0.72)] backdrop-blur-xl",
        className,
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-wide text-white">{node.ticker}</p>
          <p className="truncate text-[11px] text-slate-500">{node.name}</p>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] leading-tight", badge)}>
          {getFlowStateLabel(node.flowState)}
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div>
          <dt className="text-slate-600">Изменение</dt>
          <dd className={cn("font-mono tabular-nums", colors.text)}>{formatSignedPct(change)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-slate-600">{node.relativeTurnover != null ? "К вчера" : "Оборот"}</dt>
          <dd className="font-mono tabular-nums text-slate-100">
            {node.relativeTurnover != null ? relativeLabel : formatTurnoverCompact(node.turnover)}
          </dd>
        </div>
      </dl>

      {(hasValue(reason) ||
        hasValue(tradesLabel) ||
        hasValue(rangeLabel) ||
        hasValue(yesterdayLabel) ||
        (showComparison && isNotableStateShift(node.stateShift))) && (
        <div className="mt-2 space-y-1 border-t border-white/[0.06] pt-2 text-[10px]">
          {hasValue(reason) ? (
            <p className="leading-snug text-slate-500">{reason}</p>
          ) : null}
          {hasValue(tradesLabel) ? (
            <div className="flex justify-between gap-3">
              <span className="text-slate-600">Сделки</span>
              <span className="font-mono tabular-nums text-slate-400">{tradesLabel}</span>
            </div>
          ) : null}
          {hasValue(rangeLabel) ? (
            <div className="flex justify-between gap-3">
              <span className="text-slate-600">Диапазон</span>
              <span className="font-mono tabular-nums text-slate-400">{rangeLabel}</span>
            </div>
          ) : null}
          {hasValue(yesterdayLabel) ? (
            <div className="flex justify-between gap-3">
              <span className="text-slate-600">Вчера к этому времени</span>
              <span className="font-mono tabular-nums text-slate-400">{yesterdayLabel}</span>
            </div>
          ) : null}
          {showComparison && isNotableStateShift(node.stateShift) ? (
            <div className="flex justify-between gap-3">
              <span className="text-slate-600">Сдвиг дня</span>
              <span className="text-right text-violet-300/85">{getStateShiftLabel(node.stateShift)}</span>
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-2 border-t border-white/[0.06] pt-1.5 text-[10px] text-slate-600">
        {getFlowDataStatusLabel(node.dataStatus)}
      </p>
    </div>
  );
}
