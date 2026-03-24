"use client";

import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import { buildIndicesView, indicesHeatValue, type IndexHeatMetric, type IndexLensView } from "@/lib/materials/stocks-indices";

export function StocksIndicesMode({ rows }: { rows: ScreenerRow[] }) {
  const vm = React.useMemo(() => buildIndicesView(rows), [rows]);
  const [heatMetric, setHeatMetric] = React.useState<IndexHeatMetric>("turnover");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const lenses = vm.lenses;

  React.useEffect(() => {
    const first = lenses[0];
    if (!first) {
      setSelectedId(null);
      setExpandedId(null);
      return;
    }
    if (!selectedId || !lenses.some((l) => l.id === selectedId)) setSelectedId(first.id);
    if (!expandedId || !lenses.some((l) => l.id === expandedId)) setExpandedId(first.id);
  }, [lenses, selectedId, expandedId]);

  const selected = lenses.find((l) => l.id === selectedId) ?? lenses[0] ?? null;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Индексная структура рынка · live breadth monitor</p>
          <div className="ml-auto inline-flex rounded-md border border-slate-700/80 bg-slate-950/80 p-0.5 text-xs">
            <HeatButton label="Оборот" active={heatMetric === "turnover"} onClick={() => setHeatMetric("turnover")} />
            <HeatButton label="Ширина" active={heatMetric === "breadth"} onClick={() => setHeatMetric("breadth")} />
            <HeatButton label="Ход" active={heatMetric === "move"} onClick={() => setHeatMetric("move")} />
            <HeatButton label="Концентрация" active={heatMetric === "concentration"} onClick={() => setHeatMetric("concentration")} />
          </div>
        </div>
        <IndexLensesMap lenses={lenses} selectedId={selected?.id ?? null} heatMetric={heatMetric} onSelect={setSelectedId} />
      </section>

      <section className="grid gap-2 rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Режим рынка" value={vm.regime} />
        <MetricCard label="Top-3 carry (selected)" value={formatPct(selected?.concentrationTop3Pct ?? null)} />
        <MetricCard label="Top-5 carry (selected)" value={formatPct(selected?.concentrationTop5Pct ?? null)} />
        <MetricCard label="Доля в движении рынка" value={formatPct(selected?.marketMoveContributionPct ?? null)} />
        <MetricCard label="Доля рынка по обороту" value={formatPct(selected?.marketTurnoverSharePct ?? null)} />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <BarsBoard title="Ширина" lenses={lenses} valueOf={(l) => l.breadthScore ?? 0} format={(v) => v.toFixed(2)} tone="divergent" />
        <BarsBoard title="Участие (доля оборота)" lenses={lenses} valueOf={(l) => l.marketTurnoverSharePct ?? 0} format={(v) => formatPct(v)} tone="cyan" />
        <ConcentrationBoard lenses={lenses} />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-2">
          {lenses.map((lens) => (
            <ExpandableLensCard
              key={lens.id}
              lens={lens}
              selected={selected?.id === lens.id}
              expanded={expandedId === lens.id}
              onSelect={() => setSelectedId(lens.id)}
              onToggle={() => setExpandedId((prev) => (prev === lens.id ? null : lens.id))}
            />
          ))}
        </section>

        <aside className="h-fit rounded-lg border border-slate-800/90 bg-slate-900/45 p-3 xl:sticky xl:top-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Инспектор индекса</p>
          {selected ? (
            <div className="mt-2 space-y-2 text-xs">
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="text-sm font-semibold text-slate-100">{selected.title}</p>
                <p className="mt-1 text-slate-400">{selected.description}</p>
              </div>
              <MetricRow label="Breadth" value={`${selected.breadth.up}/${selected.breadth.neutral}/${selected.breadth.down}`} />
              <MetricRow label="Концентрация Top-3" value={formatPct(selected.concentrationTop3Pct)} />
              <MetricRow label="Концентрация Top-5" value={formatPct(selected.concentrationTop5Pct)} />
              <MetricRow label="Практический read" value={practicalRead(selected, vm.regime)} />
              <TickerList title="Strongest leaders" rows={selected.topLeaders} tone="up" />
              <TickerList title="Strongest drags" rows={selected.topDraggers} tone="down" />
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Нет данных по индексам.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function IndexLensesMap({
  lenses,
  selectedId,
  heatMetric,
  onSelect,
}: {
  lenses: IndexLensView[];
  selectedId: string | null;
  heatMetric: IndexHeatMetric;
  onSelect: (id: string) => void;
}) {
  const totalTurnover = lenses.reduce((acc, lens) => acc + lens.turnover, 0);
  return (
    <div className="grid auto-rows-[98px] grid-cols-12 gap-2">
      {lenses.map((lens) => {
        const span = totalTurnover > 0 ? Math.max(3, Math.min(12, Math.round((lens.turnover / totalTurnover) * 12))) : 3;
        return (
          <button
            key={lens.id}
            type="button"
            onClick={() => onSelect(lens.id)}
            style={{ gridColumn: `span ${span} / span ${span}` }}
            className={`rounded-md border p-2 text-left transition ${selectedId === lens.id ? "border-cyan-500/50" : "border-slate-800/90 hover:border-slate-700/90"} ${lensHeatClass(lens, heatMetric)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-100">{lens.title}</p>
              <span className="text-[10px] text-slate-300">{formatPct(lens.marketTurnoverSharePct)}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">Breadth: {lens.breadth.up}/{lens.breadth.neutral}/{lens.breadth.down}</p>
            <p className="text-[11px] text-slate-300">Median move: {formatNum(lens.medianMovePct)}%</p>
          </button>
        );
      })}
    </div>
  );
}

function BarsBoard({
  title,
  lenses,
  valueOf,
  format,
  tone,
}: {
  title: string;
  lenses: IndexLensView[];
  valueOf: (lens: IndexLensView) => number;
  format: (value: number) => string;
  tone: "divergent" | "cyan";
}) {
  const max = Math.max(0.001, ...lenses.map((l) => Math.abs(valueOf(l))));
  return (
    <div className="rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="space-y-1.5">
        {lenses.map((lens) => {
          const raw = valueOf(lens);
          const width = Math.max(4, Math.round((Math.abs(raw) / max) * 100));
          const cls = tone === "cyan" ? "bg-cyan-500/80" : raw >= 0 ? "bg-emerald-500/80" : "bg-rose-500/80";
          return (
            <div key={`${title}-${lens.id}`} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300">{lens.title}</span>
                <span className="font-mono text-slate-400">{format(raw)}</span>
              </div>
              <div className="h-1.5 rounded bg-slate-800">
                <div className={`h-1.5 rounded ${cls}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConcentrationBoard({ lenses }: { lenses: IndexLensView[] }) {
  return (
    <div className="rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">Index concentration: carry Top-3 / Top-5</p>
      <div className="space-y-2">
        {lenses.map((lens) => (
          <div key={`conc-${lens.id}`} className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">{lens.title}</span>
              <span className="font-mono text-slate-400">{formatPct(lens.concentrationTop3Pct)} / {formatPct(lens.concentrationTop5Pct)}</span>
            </div>
            <div className="h-2 rounded bg-slate-800">
              <div className="h-2 rounded bg-amber-500/80" style={{ width: `${Math.max(3, Math.round((lens.concentrationTop3Pct ?? 0) * 100))}%` }} />
            </div>
            <div className="h-1 rounded bg-slate-800">
              <div className="h-1 rounded bg-orange-400/70" style={{ width: `${Math.max(3, Math.round((lens.concentrationTop5Pct ?? 0) * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpandableLensCard({
  lens,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  lens: IndexLensView;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <article className={`rounded-lg border p-3 ${selected ? "border-cyan-500/40 bg-slate-900/80" : "border-slate-800/90 bg-slate-900/40"}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onSelect} className="text-left">
          <p className="text-sm font-semibold text-slate-100">{lens.title}</p>
          <p className="text-xs text-slate-400">{lens.description}</p>
        </button>
        <button type="button" onClick={onToggle} className="rounded-md border border-slate-700/80 bg-slate-950/70 px-2 py-0.5 text-[10px] text-slate-300">
          {expanded ? "Свернуть" : "Развернуть"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
        <MetricRow label="Доля рынка по обороту, %" value={formatPct(lens.marketTurnoverSharePct)} />
        <MetricRow label="Breadth" value={`${lens.breadth.up}/${lens.breadth.neutral}/${lens.breadth.down}`} />
        <MetricRow label="Median move, %" value={formatNum(lens.medianMovePct)} />
        <MetricRow label="Concentration Top-3, %" value={formatPct(lens.concentrationTop3Pct)} />
      </div>
      {expanded ? (
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <MiniMap lens={lens} />
          <TurnoverBars lens={lens} />
          <ContributionView lens={lens} />
          <TickerList title="Top draggers" rows={lens.topDraggers} tone="down" />
        </div>
      ) : null}
    </article>
  );
}

function MiniMap({ lens }: { lens: IndexLensView }) {
  const top = [...lens.members].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 10);
  const total = top.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Внутренние имена</p>
      <div className="grid grid-cols-8 gap-1">
        {top.map((row) => {
          const span = total > 0 ? Math.max(2, Math.min(8, Math.round(((row.turnover ?? 0) / total) * 8))) : 2;
          return <div key={`${lens.id}-${row.ticker}`} style={{ gridColumn: `span ${span} / span ${span}` }} className="rounded border border-slate-700/80 bg-slate-900/70 px-1 py-1 text-[10px] text-slate-200">{row.ticker}</div>;
        })}
      </div>
    </div>
  );
}

function TurnoverBars({ lens }: { lens: IndexLensView }) {
  const max = Math.max(1, ...lens.topTurnover.map((row) => row.turnover ?? 0));
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Top turnover</p>
      <div className="space-y-1">
        {lens.topTurnover.map((row) => {
          const width = Math.max(5, Math.round(((row.turnover ?? 0) / max) * 100));
          return (
            <div key={`${lens.id}-turn-${row.ticker}`} className="space-y-0.5">
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

function ContributionView({ lens }: { lens: IndexLensView }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Top contributors</p>
      <div className="space-y-1">
        {lens.topContributors.map((row) => (
          <div key={`${lens.id}-c-${row.ticker}`} className="flex items-center justify-between text-[11px]">
            <span className="font-mono text-slate-200">{row.ticker}</span>
            <span className="text-slate-400">{formatPct(row.contributionPct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TickerList({ title, rows, tone }: { title: string; rows: ScreenerRow[]; tone: "up" | "down" }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={`${title}-${row.ticker}`} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-mono text-slate-200">{row.ticker}</span>
            <span className={tone === "up" ? "text-emerald-300" : "text-rose-300"}>
              {row.percentChange === null ? "—" : `${row.percentChange > 0 ? "+" : ""}${row.percentChange.toFixed(2)}%`}
            </span>
          </div>
        ))}
      </div>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 px-2 py-1.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-mono text-sm text-slate-100">{value}</p>
    </div>
  );
}

function HeatButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={active ? "rounded bg-slate-800 px-2.5 py-1 text-slate-100" : "rounded px-2.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"}>{label}</button>;
}

function lensHeatClass(lens: IndexLensView, metric: IndexHeatMetric): string {
  const value = indicesHeatValue(lens, metric);
  if (metric === "turnover") {
    if (value > 30_000_000_000) return "bg-cyan-500/18";
    if (value > 12_000_000_000) return "bg-cyan-500/10";
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

function practicalRead(lens: IndexLensView, regime: string): string {
  if (regime === "Узкое лидерство" && lens.id === "imoex") return "Индекс тянут тяжеловесы: не переоценивать ширину импульса.";
  if (lens.id === "mid-small" && (lens.breadthScore ?? 0) > 0.1) return "Mid/Small подтверждает движение: искать альфу во втором эшелоне.";
  if (lens.id === "broad-market" && (lens.breadthScore ?? 0) < 0) return "Широкий рынок не подтверждает: риск ложного продолжения.";
  return "Сканировать тикеры внутри линзы по лидерам оборота и вкладу в ход.";
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

