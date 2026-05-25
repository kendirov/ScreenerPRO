"use client";

import * as React from "react";
import Link from "next/link";
import {
  computeTailShift,
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

const FLOW_STATE_BADGE: Record<string, string> = {
  "money-growth": "border-emerald-700/35 bg-emerald-950/25 text-emerald-200",
  "money-pressure": "border-rose-800/35 bg-rose-950/25 text-rose-200",
  "thin-move": "border-amber-700/30 bg-amber-950/20 text-amber-200",
  noise: "border-slate-700/40 bg-slate-900/35 text-slate-400",
  neutral: "border-slate-700/40 bg-slate-900/35 text-slate-400",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-600">{title}</p>
      <div className="rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  if (!value || value === "—" || value === "нет вчерашнего сравнения" || value === "нет данных вчера") {
    return null;
  }
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={cn("font-mono text-[12px] tabular-nums text-slate-100", valueClass)}>{value}</span>
    </div>
  );
}

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2 text-[11px] text-violet-200/90 transition hover:border-violet-500/25 hover:bg-violet-950/20"
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

export function FlowMapInspector({
  node,
  showComparison = false,
  className,
  onClose,
}: {
  node: MarketFlowNode | null;
  showComparison?: boolean;
  className?: string;
  onClose?: () => void;
}) {
  if (!node) {
    return (
      <aside
        className={cn(
          "lab-glass-card rounded-xl border border-dashed border-white/[0.08] bg-slate-950/40 p-4 text-sm text-slate-500 lg:min-w-[260px] lg:max-w-[300px]",
          className,
        )}
      >
        Кликните по точке на карте — здесь откроются детали потока
      </aside>
    );
  }

  const badge = FLOW_STATE_BADGE[node.flowState] ?? FLOW_STATE_BADGE.neutral;
  const change = node.openChangePct ?? node.changePct;
  const tailShift = computeTailShift(node);
  const hasTail = node.previousXScore != null && node.previousYScore != null;

  return (
    <aside
      className={cn(
        "lab-glass-panel rounded-xl border border-white/[0.08] p-4 shadow-[0_12px_32px_rgba(2,6,23,0.35)] lg:min-w-[260px] lg:max-w-[300px]",
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold tracking-wide text-slate-50">{node.ticker}</p>
          <p className="truncate text-xs text-slate-500">{node.name}</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
          >
            Закрыть
          </button>
        ) : null}
      </div>

      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px]", badge)}>
        {getFlowStateLabel(node.flowState)}
      </span>

      <Section title="Сейчас">
        <DetailRow
          label="Изменение"
          value={formatSignedPct(change)}
          valueClass={change != null && change > 0 ? "text-emerald-300" : change != null && change < 0 ? "text-rose-300" : undefined}
        />
        <DetailRow label="Оборот" value={formatTurnoverCompact(node.turnover)} />
        {node.trades != null && node.trades > 0 ? (
          <DetailRow label="Сделки" value={tradingFormat.formatInteger(node.trades)} />
        ) : null}
        <DetailRow label="Диапазон" value={tradingFormat.formatDayRangeMagnitude(node.rangePct)} />
      </Section>

      <Section title="Относительно вчера">
        <DetailRow label="К вчера" value={formatRelativeTurnover(node.relativeTurnover)} />
        <DetailRow label="Вчера к этому времени" value={formatTurnoverCompact(node.yesterdayTurnoverAtSameTime)} />
        <DetailRow
          label="Хвост / смена"
          value={
            hasTail
              ? tailShift >= 0.35
                ? "заметный сдвиг"
                : tailShift >= 0.12
                  ? "умеренный сдвиг"
                  : "слабый сдвиг"
              : ""
          }
        />
        <DetailRow label="Статус данных" value={getFlowDataStatusLabel(node.dataStatus)} />
        {showComparison && isNotableStateShift(node.stateShift) ? (
          <DetailRow label="Сдвиг дня" value={getStateShiftLabel(node.stateShift)} />
        ) : null}
        {showComparison && node.stateShiftReason ? (
          <DetailRow label="Причина" value={node.stateShiftReason} valueClass="text-slate-400 text-[11px]" />
        ) : null}
      </Section>

      {node.reasonTags.length ? (
        <Section title="Почему в зоне">
          <div className="flex flex-wrap gap-1 py-1">
            {node.reasonTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/[0.06] bg-black/25 px-2 py-0.5 text-[10px] text-slate-500"
              >
                {tag}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Действия">
        <div className="space-y-1.5 py-1">
          <ActionLink href={`/stocks/${node.ticker}`}>Карточка инструмента</ActionLink>
          <ActionLink href={`/screener/stocks`}>Открыть в скринере</ActionLink>
          <ActionLink href={`/lab/preparation`}>Открыть в подготовке</ActionLink>
        </div>
      </Section>
    </aside>
  );
}
