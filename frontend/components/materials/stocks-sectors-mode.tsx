"use client";

import * as React from "react";
import { buildStocksSectorsView, sectorHeatValue, type SectorHeatMetric, type StocksSectorView } from "@/lib/materials/stocks-sectors";
import type { ScreenerRow } from "@screenerpro/shared";

export function StocksSectorsMode({ rows }: { rows: ScreenerRow[] }) {
  const [heatMetric, setHeatMetric] = React.useState<SectorHeatMetric>("turnover");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const vm = React.useMemo(() => buildStocksSectorsView(rows), [rows]);
  const sectors = vm.sectors;

  React.useEffect(() => {
    const first = sectors[0];
    if (!first) {
      setSelectedId(null);
      setExpandedId(null);
      return;
    }
    if (!selectedId || !sectors.some((s) => s.id === selectedId)) setSelectedId(first.id);
    if (!expandedId || !sectors.some((s) => s.id === expandedId)) setExpandedId(first.id);
  }, [sectors, selectedId, expandedId]);

  const selected = sectors.find((s) => s.id === selectedId) ?? sectors[0] ?? null;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Карта секторов MOEX · размер плитки = оборот сектора</p>
          <div className="ml-auto inline-flex rounded-md border border-slate-700/80 bg-slate-950/80 p-0.5 text-xs">
            <HeatButton label="Оборот" active={heatMetric === "turnover"} onClick={() => setHeatMetric("turnover")} />
            <HeatButton label="Доля рынка" active={heatMetric === "market-share"} onClick={() => setHeatMetric("market-share")} />
            <HeatButton label="Ширина" active={heatMetric === "breadth"} onClick={() => setHeatMetric("breadth")} />
            <HeatButton label="Ход" active={heatMetric === "move"} onClick={() => setHeatMetric("move")} />
            <HeatButton label="Концентрация" active={heatMetric === "concentration"} onClick={() => setHeatMetric("concentration")} />
          </div>
        </div>
        <SectorTreemap sectors={sectors} selectedId={selected?.id ?? null} heatMetric={heatMetric} onSelect={setSelectedId} />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-2">
          {sectors.map((sector) => (
            <ExpandableSectorCard
              key={sector.id}
              sector={sector}
              selected={selected?.id === sector.id}
              expanded={expandedId === sector.id}
              onSelect={() => setSelectedId(sector.id)}
              onToggle={() => setExpandedId((prev) => (prev === sector.id ? null : sector.id))}
            />
          ))}
        </section>

        <aside className="h-fit rounded-lg border border-slate-800/90 bg-slate-900/45 p-3 xl:sticky xl:top-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Инспектор сектора</p>
          {selected ? (
            <div className="mt-2 space-y-2 text-xs">
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="text-sm font-semibold text-slate-100">{selected.title}</p>
                <p className="mt-1 text-slate-400">{selected.description}</p>
              </div>
              <MetricRow label="Доля рынка по обороту, %" value={formatPct(selected.marketTurnoverSharePct)} />
              <MetricRow label="Доля рынка по сделкам, %" value={formatPct(selected.marketTradesSharePct)} />
              <MetricRow label="Ширина: растут / нейтральны / падают" value={`${selected.up}/${selected.neutral}/${selected.down}`} />
              <MetricRow label="Концентрация оборота: доля топ-3, %" value={formatPct(selected.top3TurnoverSharePct)} />
              <MetricRow label="Сектор: широкий или узкий" value={selected.isBroad ? "Широкий" : "Узкий"} />
              <MetricRow label="Деньги: реальные или концентрированные" value={selected.moneyFlowType === "real" ? "Реальные" : "Концентрированные"} />
              <TickerPills title="Лидеры по движению" rows={selected.leadersByMove} tone="up" />
              <TickerPills title="Отстающие" rows={selected.laggards} tone="down" />
              <MetricRow label="Практическая заметка" value={intradayNote(selected)} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Нет данных по секторам.</p>
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

function SectorTreemap({
  sectors,
  selectedId,
  heatMetric,
  onSelect,
}: {
  sectors: StocksSectorView[];
  selectedId: string | null;
  heatMetric: SectorHeatMetric;
  onSelect: (id: string) => void;
}) {
  const totalTurnover = sectors.reduce((acc, s) => acc + s.turnover, 0);
  return (
    <div className="grid auto-rows-[96px] grid-cols-12 gap-2">
      {sectors.map((sector) => {
        const span = totalTurnover > 0 ? Math.max(3, Math.min(12, Math.round((sector.turnover / totalTurnover) * 12))) : 3;
        return (
          <button
            key={sector.id}
            type="button"
            onClick={() => onSelect(sector.id)}
            style={{ gridColumn: `span ${span} / span ${span}` }}
            className={`rounded-md border p-2 text-left transition ${selectedId === sector.id ? "border-cyan-500/50" : "border-slate-800/90 hover:border-slate-700/90"} ${sectorHeatClass(sector, heatMetric)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-100">{sector.title}</p>
              <span className="text-[10px] text-slate-300">{formatPct(sector.marketTurnoverSharePct)}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">Ширина: {sector.up}/{sector.neutral}/{sector.down}</p>
            <p className="text-[11px] text-slate-300">Медианный ход: {formatNum(sector.medianMovePct)}%</p>
          </button>
        );
      })}
    </div>
  );
}

function ExpandableSectorCard({
  sector,
  selected,
  expanded,
  onSelect,
  onToggle,
}: {
  sector: StocksSectorView;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <article className={`rounded-lg border p-3 ${selected ? "border-cyan-500/40 bg-slate-900/80" : "border-slate-800/90 bg-slate-900/40"}`}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onSelect} className="text-left">
          <p className="text-sm font-semibold text-slate-100">{sector.title}</p>
          <p className="text-xs text-slate-400">{sector.description}</p>
        </button>
        <button type="button" onClick={onToggle} className="rounded-md border border-slate-700/80 bg-slate-950/70 px-2 py-0.5 text-[10px] text-slate-300">
          {expanded ? "Свернуть" : "Развернуть"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
        <MetricRow label="Доля рынка по обороту, %" value={formatPct(sector.marketTurnoverSharePct)} />
        <MetricRow label="Доля рынка по сделкам, %" value={formatPct(sector.marketTradesSharePct)} />
        <MetricRow label="Ширина: растут / нейтральны / падают" value={`${sector.up}/${sector.neutral}/${sector.down}`} />
        <MetricRow label="Медианный ход, %" value={formatNum(sector.medianMovePct)} />
        <MetricRow label="Концентрация оборота: доля топ-3, %" value={formatPct(sector.top3TurnoverSharePct)} />
        <MetricRow label="Режим денег" value={sector.moneyFlowType === "real" ? "Реальные" : "Концентрированные"} />
      </div>

      {expanded ? (
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <InternalMiniTreemap sector={sector} />
          <TurnoverBars sector={sector} />
          <TickerPills title="Лидеры по движению" rows={sector.leadersByMove} tone="up" />
          <TickerPills title="Отстающие" rows={sector.laggards} tone="down" />
          <TopContributors sector={sector} />
          <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2 text-xs text-slate-300">{intradayNote(sector)}</div>
        </div>
      ) : null}
    </article>
  );
}

function InternalMiniTreemap({ sector }: { sector: StocksSectorView }) {
  const members = [...sector.members].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 10);
  const total = members.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Внутренняя mini-карта</p>
      <div className="grid grid-cols-8 gap-1">
        {members.map((row) => {
          const span = total > 0 ? Math.max(2, Math.min(8, Math.round(((row.turnover ?? 0) / total) * 8))) : 2;
          return (
            <div key={row.ticker} style={{ gridColumn: `span ${span} / span ${span}` }} className="rounded border border-slate-700/80 bg-slate-900/70 px-1 py-1 text-[10px] text-slate-200">
              {row.ticker}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TurnoverBars({ sector }: { sector: StocksSectorView }) {
  const rows = sector.leadersByTurnover;
  const max = Math.max(1, ...rows.map((r) => r.turnover ?? 0));
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Лидеры по обороту</p>
      <div className="space-y-1">
        {rows.map((row) => {
          const w = Math.max(5, Math.round(((row.turnover ?? 0) / max) * 100));
          return (
            <div key={row.ticker} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-200">{row.ticker}</span>
                <span className="text-slate-400">{formatMoney(row.turnover ?? null)}</span>
              </div>
              <div className="h-1.5 rounded bg-slate-800">
                <div className="h-1.5 rounded bg-cyan-500/80" style={{ width: `${w}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopContributors({ sector }: { sector: StocksSectorView }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">Топ вклад в ход сектора</p>
      <div className="space-y-1">
        {sector.topContributors.map((row) => (
          <div key={`${sector.id}-${row.ticker}`} className="flex items-center justify-between text-[11px]">
            <span className="font-mono text-slate-200">{row.ticker}</span>
            <span className="text-slate-400">{formatPct(row.contributionPct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TickerPills({ title, rows, tone }: { title: string; rows: ScreenerRow[]; tone: "up" | "down" }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-1">
        {rows.map((row) => (
          <span key={`${title}-${row.ticker}`} className={`rounded border px-1.5 py-0.5 text-[11px] ${tone === "up" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>
            {row.ticker} {row.percentChange === null ? "—" : `${row.percentChange > 0 ? "+" : ""}${row.percentChange.toFixed(2)}%`}
          </span>
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

function sectorHeatClass(sector: StocksSectorView, metric: SectorHeatMetric): string {
  const value = sectorHeatValue(sector, metric);
  if (metric === "turnover" || metric === "market-share") {
    if (value > 0.18 || value > 30_000_000_000) return "bg-cyan-500/18";
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

function intradayNote(sector: StocksSectorView): string {
  if (sector.moneyFlowType === "concentrated") return "Ход сектора узкий: исполнять через лидеров, не распылять риск.";
  if (sector.isBroad && (sector.breadthScore ?? 0) > 0) return "Поток широкий и поддержан участием: приоритет long в лидерах оборота.";
  if (sector.isBroad && (sector.breadthScore ?? 0) < 0) return "Широкий негативный поток: искать слабые бумаги внутри сектора.";
  return "Смешанный режим: работать точечно от конкретных импульсов внутри сектора.";
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

