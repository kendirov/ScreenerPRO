"use client";

import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import {
  buildCapitalizationView,
  capitalizationHeatValue,
  type CapitalizationGroupView,
  type CapitalizationHeatMetric,
} from "@/lib/materials/stocks-capitalization";

export function StocksCapitalizationMode({ rows }: { rows: ScreenerRow[] }) {
  const vm = React.useMemo(() => buildCapitalizationView(rows), [rows]);
  const groups = vm.groups;
  const [heatMetric, setHeatMetric] = React.useState<CapitalizationHeatMetric>("turnover");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [compareLeftId, setCompareLeftId] = React.useState<string | null>(null);
  const [compareRightId, setCompareRightId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const first = groups[0];
    const second = groups[1];
    if (!first) {
      setSelectedId(null);
      setExpandedId(null);
      setCompareLeftId(null);
      setCompareRightId(null);
      return;
    }
    if (!selectedId || !groups.some((g) => g.id === selectedId)) setSelectedId(first.id);
    if (!expandedId || !groups.some((g) => g.id === expandedId)) setExpandedId(first.id);
    if (!compareLeftId || !groups.some((g) => g.id === compareLeftId)) setCompareLeftId(first.id);
    if (!compareRightId || !groups.some((g) => g.id === compareRightId)) setCompareRightId((second ?? first).id);
  }, [groups, selectedId, expandedId, compareLeftId, compareRightId]);

  const selected = groups.find((g) => g.id === selectedId) ?? groups[0] ?? null;
  const compareLeft = groups.find((g) => g.id === compareLeftId) ?? null;
  const compareRight = groups.find((g) => g.id === compareRightId) ?? null;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Карта структуры капитализации · размер = оборот группы</p>
          <div className="ml-auto inline-flex rounded-md border border-slate-700/80 bg-slate-950/80 p-0.5 text-xs">
            <HeatButton label="Оборот" active={heatMetric === "turnover"} onClick={() => setHeatMetric("turnover")} />
            <HeatButton label="Доля рынка" active={heatMetric === "market-share"} onClick={() => setHeatMetric("market-share")} />
            <HeatButton label="Ширина" active={heatMetric === "breadth"} onClick={() => setHeatMetric("breadth")} />
            <HeatButton label="Ход" active={heatMetric === "move"} onClick={() => setHeatMetric("move")} />
            <HeatButton label="Концентрация" active={heatMetric === "concentration"} onClick={() => setHeatMetric("concentration")} />
          </div>
        </div>
        <CapitalizationMap groups={groups} selectedId={selected?.id ?? null} heatMetric={heatMetric} onSelect={setSelectedId} />
      </section>

      <section className="rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5">
        <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">Сравнение групп</p>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
          <SelectGroup value={compareLeftId} groups={groups} onChange={setCompareLeftId} label="Группа A" />
          <SelectGroup value={compareRightId} groups={groups} onChange={setCompareRightId} label="Группа B" />
        </div>
        {compareLeft && compareRight ? <ComparisonBoard left={compareLeft} right={compareRight} /> : null}
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-2">
          {groups.map((group) => (
            <ExpandableCapCard
              key={group.id}
              group={group}
              selected={selected?.id === group.id}
              expanded={expandedId === group.id}
              onSelect={() => setSelectedId(group.id)}
              onToggle={() => setExpandedId((prev) => (prev === group.id ? null : group.id))}
            />
          ))}
        </section>

        <aside className="h-fit rounded-lg border border-slate-800/90 bg-slate-900/45 p-3 xl:sticky xl:top-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Инспектор группы</p>
          {selected ? (
            <div className="mt-2 space-y-2 text-xs">
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="text-sm font-semibold text-slate-100">{selected.title}</p>
                <p className="text-[11px] text-slate-400">{selected.role}</p>
                <p className="mt-1 text-slate-400">{selected.description}</p>
              </div>
              <MetricRow label="Доля рынка по обороту, %" value={formatPct(selected.marketTurnoverSharePct)} />
              <MetricRow label="Доля рынка по сделкам, %" value={formatPct(selected.marketTradesSharePct)} />
              <MetricRow label="Ширина: растут / нейтральны / падают" value={`${selected.up}/${selected.neutral}/${selected.down}`} />
              <MetricRow label="Концентрация внутри группы, %" value={formatPct(selected.top3ConcentrationPct)} />
              <MetricRow label="Доля группы в движении рынка, %" value={formatPct(selected.marketMoveContributionPct)} />
              <MetricRow label="Статус участия" value={selected.isParticipating ? "Подтверждает движение" : "Слабое участие"} />
              <MetricRow label="Практический intraday read" value={intradayRead(selected)} />
              <TickerRows title="Лидеры" rows={selected.leaders} tone="up" />
              <TickerRows title="Отстающие" rows={selected.laggards} tone="down" />
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Нет данных по капитализации.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function HeatButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={active ? "rounded bg-slate-800 px-2.5 py-1 text-slate-100" : "rounded px-2.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"}>
      {label}
    </button>
  );
}

function CapitalizationMap({
  groups,
  selectedId,
  heatMetric,
  onSelect,
}: {
  groups: CapitalizationGroupView[];
  selectedId: string | null;
  heatMetric: CapitalizationHeatMetric;
  onSelect: (id: string) => void;
}) {
  const totalTurnover = groups.reduce((acc, g) => acc + g.turnover, 0);
  return (
    <div className="grid auto-rows-[104px] grid-cols-12 gap-2">
      {groups.map((group) => {
        const span = totalTurnover > 0 ? Math.max(3, Math.min(12, Math.round((group.turnover / totalTurnover) * 12))) : 3;
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelect(group.id)}
            style={{ gridColumn: `span ${span} / span ${span}` }}
            className={`rounded-md border p-2 text-left transition ${selectedId === group.id ? "border-cyan-500/50" : "border-slate-800/90 hover:border-slate-700/90"} ${heatClass(group, heatMetric)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-100">{group.title}</p>
              <span className="text-[10px] text-slate-300">{formatPct(group.marketTurnoverSharePct)}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">Сделки: {formatPct(group.marketTradesSharePct)} от рынка</p>
            <p className="text-[11px] text-slate-300">Ширина: {group.up}/{group.neutral}/{group.down} · Медиана: {formatNum(group.medianMovePct)}%</p>
          </button>
        );
      })}
    </div>
  );
}

function ExpandableCapCard({
  group,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  group: CapitalizationGroupView;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <article className={`rounded-lg border p-3 ${selected ? "border-cyan-500/40 bg-slate-900/80" : "border-slate-800/90 bg-slate-900/40"}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onSelect} className="text-left">
          <p className="text-sm font-semibold text-slate-100">{group.title}</p>
          <p className="text-xs text-slate-400">{group.description}</p>
        </button>
        <button type="button" onClick={onToggle} className="rounded-md border border-slate-700/80 bg-slate-950/70 px-2 py-0.5 text-[10px] text-slate-300">
          {expanded ? "Свернуть" : "Развернуть"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
        <MetricRow label="Доля рынка по обороту, %" value={formatPct(group.marketTurnoverSharePct)} />
        <MetricRow label="Доля рынка по сделкам, %" value={formatPct(group.marketTradesSharePct)} />
        <MetricRow label="Ширина: растут / нейтральны / падают" value={`${group.up}/${group.neutral}/${group.down}`} />
        <MetricRow label="Медианный ход, %" value={formatNum(group.medianMovePct)} />
        <MetricRow label="Концентрация внутри группы, %" value={formatPct(group.top3ConcentrationPct)} />
        <MetricRow label="Доля группы в движении рынка, %" value={formatPct(group.marketMoveContributionPct)} />
      </div>
      {expanded ? (
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <MiniCompositionMap group={group} />
          <TopTurnoverBars group={group} />
          <TickerRows title="Лидеры" rows={group.leaders} tone="up" />
          <TickerRows title="Отстающие" rows={group.laggards} tone="down" />
          <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2 text-xs text-slate-300">{intradayRead(group)}</div>
        </div>
      ) : null}
    </article>
  );
}

function MiniCompositionMap({ group }: { group: CapitalizationGroupView }) {
  const top = [...group.members].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 10);
  const total = top.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Внутренняя структура</p>
      <div className="grid grid-cols-8 gap-1">
        {top.map((row) => {
          const span = total > 0 ? Math.max(2, Math.min(8, Math.round(((row.turnover ?? 0) / total) * 8))) : 2;
          return (
            <div key={`${group.id}-${row.ticker}`} style={{ gridColumn: `span ${span} / span ${span}` }} className="rounded border border-slate-700/80 bg-slate-900/70 px-1 py-1 text-[10px] text-slate-200">
              {row.ticker}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopTurnoverBars({ group }: { group: CapitalizationGroupView }) {
  const max = Math.max(1, ...group.topTurnover.map((r) => r.turnover ?? 0));
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Top turnover names</p>
      <div className="space-y-1">
        {group.topTurnover.map((row) => {
          const width = Math.max(5, Math.round(((row.turnover ?? 0) / max) * 100));
          return (
            <div key={`${group.id}-${row.ticker}`} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-200">{row.ticker}</span>
                <span className="text-slate-400">{formatMoney(row.turnover ?? null)}</span>
              </div>
              <div className="h-1.5 rounded bg-slate-800">
                <div className="h-1.5 rounded bg-cyan-500/80" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TickerRows({ title, rows, tone }: { title: string; rows: ScreenerRow[]; tone: "up" | "down" }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={`${title}-${row.ticker}`} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-mono text-slate-200">{row.ticker}</span>
            <span className="text-slate-400">{row.shortName}</span>
            <span className={tone === "up" ? "text-emerald-300" : "text-rose-300"}>
              {row.percentChange === null ? "—" : `${row.percentChange > 0 ? "+" : ""}${row.percentChange.toFixed(2)}%`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SelectGroup({
  value,
  groups,
  onChange,
  label,
}: {
  value: string | null;
  groups: CapitalizationGroupView[];
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-400">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 text-slate-200"
      >
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function ComparisonBoard({ left, right }: { left: CapitalizationGroupView; right: CapitalizationGroupView }) {
  const realParticipationWinner = (left.breadthScore ?? 0) > (right.breadthScore ?? 0) ? left : right;
  const concentrationWinner = (left.top3ConcentrationPct ?? 0) > (right.top3ConcentrationPct ?? 0) ? left : right;
  return (
    <div className="mt-2 grid gap-2 md:grid-cols-2">
      <MetricCard label={`A: ${left.title}`} value={`${formatPct(left.marketTurnoverSharePct)} оборот · ${left.up}/${left.neutral}/${left.down}`} />
      <MetricCard label={`B: ${right.title}`} value={`${formatPct(right.marketTurnoverSharePct)} оборот · ${right.up}/${right.neutral}/${right.down}`} />
      <MetricCard label="Более реальное участие" value={realParticipationWinner.title} />
      <MetricCard label="Более концентрированный ход" value={concentrationWinner.title} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 px-2 py-1.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-mono text-sm text-slate-100">{value}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-200">{value}</span>
    </div>
  );
}

function heatClass(group: CapitalizationGroupView, metric: CapitalizationHeatMetric): string {
  const value = capitalizationHeatValue(group, metric);
  if (metric === "turnover" || metric === "market-share") {
    if (value > 0.2 || value > 30_000_000_000) return "bg-cyan-500/18";
    if (value > 0.1 || value > 12_000_000_000) return "bg-cyan-500/10";
    return "bg-slate-900/50";
  }
  if (metric === "breadth") {
    if (value > 0.25) return "bg-emerald-500/14";
    if (value < -0.25) return "bg-rose-500/14";
    return "bg-slate-900/50";
  }
  if (metric === "move") {
    if (value > 0.8) return "bg-emerald-500/14";
    if (value < -0.8) return "bg-rose-500/14";
    return "bg-slate-900/50";
  }
  if (value > 0.72) return "bg-amber-500/16";
  if (value > 0.62) return "bg-amber-500/10";
  return "bg-slate-900/50";
}

function intradayRead(group: CapitalizationGroupView): string {
  if (group.id === "mid-small" && group.isParticipating) return "Mid/Small подтверждает рынок: искать импульсы второго эшелона.";
  if (group.id === "mid-small" && !group.isParticipating) return "Mid/Small отстает: движение может быть только индексным.";
  if (group.id === "imoex-core" && group.isConcentrated) return "Индекс ведут 1-3 тяжеловеса: повышен риск резких ротаций.";
  if (group.id === "bluechips" && group.marketTurnoverSharePct !== null && group.marketTurnoverSharePct > 0.45) return "Деньги в blue chips: приоритет ликвидному исполнению.";
  return "Смешанная структура: работать от конкретных лидеров внутри группы.";
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ₽`;
}

function formatNum(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

