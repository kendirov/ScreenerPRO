"use client";

import * as React from "react";
import type { ScreenerRow } from "@screenerpro/shared";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialsPageShell } from "@/components/materials/materials-page-shell";
import { StocksCapitalizationMode } from "@/components/materials/stocks-capitalization-mode";
import { StocksIndicesMode } from "@/components/materials/stocks-indices-mode";
import { StocksSectorsMode } from "@/components/materials/stocks-sectors-mode";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import {
  buildStocksModeView,
  getStocksModeLabel,
  STOCKS_MODE_GROUPS,
  type StocksGroupView,
  type StocksMetricRelativeTo,
  type StocksMode,
  type StocksModeKpi,
} from "@/lib/materials/stocks-map";

export function StocksMaterialsClient() {
  const [mode, setMode] = React.useState<StocksMode>("sectors");
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = React.useState<string | null>(null);
  const [heatMetric, setHeatMetric] = React.useState<"turnover" | "breadth" | "move" | "concentration">("turnover");
  const query = useScreenerQuery("stock");
  const rows = React.useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const vm = React.useMemo(() => buildStocksModeView(mode, rows, selectedDriver), [mode, rows, selectedDriver]);
  const groups = vm.groups;

  React.useEffect(() => {
    const first = groups[0];
    if (!first) {
      setSelectedGroupId(null);
      return;
    }
    if (!selectedGroupId || !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(first.id);
    }
  }, [groups, selectedGroupId]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const freshnessText = query.data?.status ? `Обновлено ${new Date(query.data.status.fetchTimestamp).toLocaleTimeString("ru-RU")}` : "Ожидание данных";
  const sourceLabel = query.data?.status?.source === "moex" ? "MOEX ISS online" : "Fallback / временно недоступно";
  const sourceTone = query.data?.status?.source === "moex" ? "ok" : "warn";
  const breadthText = formatAggregateBreadth(groups);
  const isSectorsMode = mode === "sectors";
  const isCapitalizationMode = mode === "capitalization";
  const isIndicesMode = mode === "indices";

  return (
    <MaterialsPageShell
      title="Акции"
      description="Trader-first карта рынка акций MOEX: 4 разных аналитических режима, где каждая метрика явно показывает базу сравнения."
      freshness={freshnessText}
      sourceLabel={sourceLabel}
      sourceTone={sourceTone}
    >
      <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(value as StocksMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="sectors" className="text-xs">Сектора</TabsTrigger>
              <TabsTrigger value="capitalization" className="text-xs">Капитализация</TabsTrigger>
              <TabsTrigger value="indices" className="text-xs">Индексы</TabsTrigger>
              <TabsTrigger value="drivers" className="text-xs">Поводыри</TabsTrigger>
            </TabsList>
          </Tabs>
          {!isSectorsMode && !isCapitalizationMode && !isIndicesMode ? (
            <div className="inline-flex rounded-md border border-slate-700/80 bg-slate-950/80 p-0.5 text-xs">
              <button type="button" onClick={() => setHeatMetric("turnover")} className={heatMetric === "turnover" ? activeBtn : plainBtn}>Оборот</button>
              <button type="button" onClick={() => setHeatMetric("breadth")} className={heatMetric === "breadth" ? activeBtn : plainBtn}>Ширина</button>
              <button type="button" onClick={() => setHeatMetric("move")} className={heatMetric === "move" ? activeBtn : plainBtn}>Ход</button>
              <button type="button" onClick={() => setHeatMetric("concentration")} className={heatMetric === "concentration" ? activeBtn : plainBtn}>Концентрация</button>
            </div>
          ) : null}
          {mode === "drivers" ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <DriverChip id={null} active={selectedDriver === null} label="Все" onClick={setSelectedDriver} />
              {STOCKS_MODE_GROUPS.drivers.map((driver) => (
                <DriverChip key={driver.id} id={driver.id} active={selectedDriver === driver.id} label={driver.driverLabel ?? driver.title} onClick={setSelectedDriver} />
              ))}
            </div>
          ) : null}
          <span className="ml-auto text-[11px] text-slate-500">Режим: {getStocksModeLabel(mode)} · Групп: {groups.length} · Ширина: {breadthText}</span>
        </div>
        {!isSectorsMode && !isCapitalizationMode && !isIndicesMode ? (
          <div className="mt-2">
            <HeatLegend heatMetric={heatMetric} />
          </div>
        ) : null}
      </section>

      {isSectorsMode ? <StocksSectorsMode rows={rows} /> : null}
      {isCapitalizationMode ? <StocksCapitalizationMode rows={rows} /> : null}
      {isIndicesMode ? <StocksIndicesMode rows={rows} /> : null}

      {!isSectorsMode && !isCapitalizationMode && !isIndicesMode ? (
        <section className="grid gap-2 rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {vm.kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} groups={groups} />
          ))}
        </section>
      ) : null}

      {isSectorsMode ? <SectorsModePanel groups={groups} selectedId={selectedGroup?.id ?? null} heatMetric={heatMetric} onSelect={setSelectedGroupId} /> : null}
      {isCapitalizationMode ? <CapitalizationModePanel groups={groups} selectedId={selectedGroup?.id ?? null} onSelect={setSelectedGroupId} /> : null}
      {isIndicesMode ? <IndicesModePanel groups={groups} selectedId={selectedGroup?.id ?? null} onSelect={setSelectedGroupId} /> : null}
      {mode === "drivers" ? <DriversModePanel groups={groups} selectedId={selectedGroup?.id ?? null} onSelect={setSelectedGroupId} /> : null}

      {!isSectorsMode && !isCapitalizationMode && !isIndicesMode ? <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-2">{groups.map((group) => <GroupTile key={group.id} group={group} selected={selectedGroup?.id === group.id} onSelect={() => setSelectedGroupId(group.id)} />)}</section>

        <aside className="h-fit rounded-lg border border-slate-800/90 bg-slate-900/45 p-3 xl:sticky xl:top-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Инспектор группы</p>
          {selectedGroup ? (
            <div className="mt-2 space-y-2 text-xs">
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="text-sm font-semibold text-slate-100">{selectedGroup.title}</p>
                <p className="mt-1 text-slate-400">{selectedGroup.description}</p>
              </div>
              <MetricRow label="Режим группы" value={regimeLabel(selectedGroup.regime)} />
              <MetricRow label="Доля рынка по обороту, %" value={formatPct(selectedGroup.marketTurnoverSharePct)} />
              <MetricRow label="Доля рынка по сделкам, %" value={formatPct(selectedGroup.marketTradesSharePct)} />
              <MetricRow label="Ширина: растут / нейтральны / падают" value={formatBreadth(selectedGroup)} />
              <MetricRow label="Концентрация оборота, %" value={formatPct(selectedGroup.moneyConcentrationPct)} />
              <MetricRow label="Доля топ-3, %" value={formatPct(selectedGroup.indexConcentrationPct)} />
              <MetricRow label="Вклад в рынок, %" value={formatPct(selectedGroup.marketContributionPct)} />
              <MetricRow label="Вклад в индекс, %" value={formatPct(selectedGroup.indexContributionPct)} />
              <MetricRow label="Ход к базису сессии, %" value={formatNum(selectedGroup.sessionMoveVsOpenPct)} />
              <MetricRow label="Практический вывод" value={intradayTakeaway(selectedGroup)} />
              <TickerList title="Лидеры" rows={selectedGroup.leaders} tone="up" />
              <TickerList title="Отстающие" rows={selectedGroup.laggards} tone="down" />
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Нет данных по выбранным фильтрам.</p>
          )}
        </aside>
      </div> : null}
    </MaterialsPageShell>
  );
}

function KpiCard({ kpi, groups }: { kpi: StocksModeKpi; groups: StocksGroupView[] }) {
  const value = kpi.format === "breadth" ? formatAggregateBreadth(groups) : formatKpiValue(kpi.value, kpi.format);
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 px-2 py-1.5">
      <p className="text-[11px] text-slate-500">{kpi.label}</p>
      <p className="font-mono text-sm text-slate-100">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Относительно: {relativeLabel(kpi.relativeTo)}</p>
    </div>
  );
}

function SectorsModePanel({
  groups,
  selectedId,
  onSelect,
  heatMetric,
}: {
  groups: StocksGroupView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  heatMetric: "turnover" | "breadth" | "move" | "concentration";
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <VisualTreemap groups={groups} selectedId={selectedId} heatMetric={heatMetric} onSelect={onSelect} />
      <BreadthBars groups={groups} selectedId={selectedId} onSelect={onSelect} />
    </section>
  );
}

function CapitalizationModePanel({ groups, selectedId, onSelect }: { groups: StocksGroupView[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <HorizontalShareBoard title="Капитализация: доля рынка по обороту, %" groups={groups} selectedId={selectedId} onSelect={onSelect} valueOf={(g) => g.marketTurnoverSharePct} />;
}

function IndicesModePanel({ groups, selectedId, onSelect }: { groups: StocksGroupView[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <HorizontalShareBoard title="Индексы: вклад в индекс, %" groups={groups} selectedId={selectedId} onSelect={onSelect} valueOf={(g) => g.indexContributionPct} />;
}

function DriversModePanel({ groups, selectedId, onSelect }: { groups: StocksGroupView[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <HorizontalShareBoard title="Поводыри: вклад в рынок, %" groups={groups} selectedId={selectedId} onSelect={onSelect} valueOf={(g) => g.marketContributionPct} />;
}

function HorizontalShareBoard({
  title,
  groups,
  selectedId,
  onSelect,
  valueOf,
}: {
  title: string;
  groups: StocksGroupView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  valueOf: (group: StocksGroupView) => number | null;
}) {
  const max = Math.max(0.01, ...groups.map((group) => valueOf(group) ?? 0));
  return (
    <section className="rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <div className="space-y-2">
        {groups.map((group) => {
          const raw = valueOf(group) ?? 0;
          const width = Math.max(5, Math.round((raw / max) * 100));
          return (
            <button key={group.id} type="button" onClick={() => onSelect(group.id)} className={`w-full rounded-md border px-2 py-1.5 text-left ${selectedId === group.id ? "border-cyan-500/40 bg-slate-900/80" : "border-slate-800/80 bg-slate-950/45"}`}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-200">{group.title}</span>
                <span className="font-mono text-slate-300">{formatPct(raw)}</span>
              </div>
              <div className="h-2 rounded bg-slate-800">
                <div className="h-2 rounded bg-cyan-500/80" style={{ width: `${width}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GroupTile({ group, selected, onSelect }: { group: StocksGroupView; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`w-full rounded-lg border p-3 text-left ${selected ? "border-cyan-500/40 bg-slate-900/80" : "border-slate-800/90 bg-slate-900/40"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-100">{group.title}</p>
        <span className="text-[10px] text-slate-400">{regimeLabel(group.regime)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{group.description}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
        <MetricRow label="Доля рынка по обороту, %" value={formatPct(group.marketTurnoverSharePct)} />
        <MetricRow label="Доля рынка по сделкам, %" value={formatPct(group.marketTradesSharePct)} />
        <MetricRow label="Ширина" value={formatBreadth(group)} />
        <MetricRow label="Концентрация оборота, %" value={formatPct(group.moneyConcentrationPct)} />
      </div>
    </button>
  );
}

function DriverChip({
  id,
  label,
  active,
  onClick,
}: {
  id: string | null;
  label: string;
  active: boolean;
  onClick: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`rounded-md border px-2 py-1 text-[11px] transition ${active ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "border-slate-700/80 bg-slate-950/70 text-slate-400 hover:text-slate-200"}`}
    >
      {label}
    </button>
  );
}

function HeatLegend({ heatMetric }: { heatMetric: "turnover" | "breadth" | "move" | "concentration" }) {
  const text =
    heatMetric === "turnover"
      ? "Тепловая шкала: ярче = больше оборот кластера."
      : heatMetric === "breadth"
        ? "Тепловая шкала: зеленый/красный = направление ширины участия."
        : heatMetric === "move"
          ? "Тепловая шкала: интенсивность медианного хода внутри группы."
          : "Тепловая шкала: ярче = выше концентрация денег в топ-именах.";
  return (
    <div className="rounded-md border border-slate-800/80 bg-slate-950/50 px-2 py-1 text-[11px] text-slate-400">
      {text}
    </div>
  );
}

function VisualTreemap({
  groups,
  selectedId,
  heatMetric,
  onSelect,
}: {
  groups: StocksGroupView[];
  selectedId: string | null;
  heatMetric: "turnover" | "breadth" | "move" | "concentration";
  onSelect: (id: string) => void;
}) {
  const totalTurnover = groups.reduce((acc, group) => acc + group.turnover, 0);
  return (
    <div className="rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">Карта рынка · tile size = оборот</p>
      <div className="grid auto-rows-[92px] grid-cols-12 gap-2">
        {groups.map((group) => {
          const width = totalTurnover > 0 ? Math.max(3, Math.min(12, Math.round((group.turnover / totalTurnover) * 12))) : 3;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className={`col-span-12 rounded-md border p-2 text-left transition md:col-span-${width} ${selectedId === group.id ? "border-cyan-500/50" : "border-slate-800/90 hover:border-slate-700/90"} ${heatSurface(group, heatMetric)}`}
              style={{ gridColumn: `span ${width} / span ${width}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-slate-100">{group.title}</p>
                <span className="text-[10px] text-slate-300">{regimeLabel(group.regime)}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-300">Оборот: {formatMoney(group.turnover)}</p>
              <p className="text-[11px] text-slate-300">Ширина: {formatBreadth(group)} · Медиана: {formatNum(group.medianMove)}%</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BreadthBars({
  groups,
  selectedId,
  onSelect,
}: {
  groups: StocksGroupView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">Ширина по группам</p>
      <div className="space-y-2">
        {groups.map((group) => {
          const total = Math.max(1, group.up + group.down + group.neutral);
          const upW = (group.up / total) * 100;
          const downW = (group.down / total) * 100;
          const neutralW = Math.max(0, 100 - upW - downW);
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className={`w-full rounded-md border px-2 py-1.5 text-left transition ${selectedId === group.id ? "border-cyan-500/40 bg-slate-900/80" : "border-slate-800/80 bg-slate-950/45 hover:bg-slate-900/60"}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-300">{group.title}</span>
                <span className="font-mono text-slate-400">{formatBreadth(group)}</span>
              </div>
              <div className="flex h-2.5 overflow-hidden rounded">
                <div className="bg-emerald-500/80" style={{ width: `${upW}%` }} />
                <div className="bg-slate-500/70" style={{ width: `${neutralW}%` }} />
                <div className="bg-rose-500/80" style={{ width: `${downW}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TickerList({ title, rows, tone }: { title: string; rows: ScreenerRow[]; tone: "up" | "down" }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 p-2">
      <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="space-y-1">
        {rows.length ? (
          rows.map((row) => (
            <div key={`${title}-${row.ticker}`} className="flex items-center justify-between gap-2">
              <span className="font-mono text-slate-200">{row.ticker}</span>
              <span className="text-slate-400">{row.shortName}</span>
              <span className={tone === "up" ? "text-emerald-300" : "text-rose-300"}>
                {row.percentChange === null ? "—" : `${row.percentChange > 0 ? "+" : ""}${row.percentChange.toFixed(2)}%`}
              </span>
            </div>
          ))
        ) : (
          <p className="text-slate-500">Нет покрытых имен в потоке.</p>
        )}
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

function regimeLabel(regime: StocksGroupView["regime"]): string {
  if (regime === "trend-up") return "Тренд вверх";
  if (regime === "trend-down") return "Тренд вниз";
  if (regime === "broad") return "Широкое участие";
  if (regime === "narrow") return "Узкое участие";
  if (regime === "rotation") return "Ротация";
  return "Нет потока";
}

function heatSurface(group: StocksGroupView, metric: "turnover" | "breadth" | "move" | "concentration"): string {
  if (metric === "turnover") {
    if (group.turnover > 35_000_000_000) return "bg-cyan-500/15";
    if (group.turnover > 20_000_000_000) return "bg-cyan-500/10";
    return "bg-slate-900/45";
  }
  if (metric === "breadth") {
    if ((group.breadthScore ?? 0) > 0.35) return "bg-emerald-500/12";
    if ((group.breadthScore ?? 0) < -0.35) return "bg-rose-500/12";
    return "bg-slate-900/45";
  }
  if (metric === "move") {
    if ((group.medianMove ?? 0) > 1) return "bg-emerald-500/12";
    if ((group.medianMove ?? 0) < -1) return "bg-rose-500/12";
    return "bg-slate-900/45";
  }
  if ((group.moneyConcentrationPct ?? 0) > 0.7) return "bg-amber-500/12";
  return "bg-slate-900/45";
}

function intradayTakeaway(group: StocksGroupView): string {
  if (group.regime === "trend-up") return "Поток широкий, можно искать продолжение в лидерах группы.";
  if (group.regime === "trend-down") return "Давление устойчивое, приоритет шорт-идей в слабых именах.";
  if (group.regime === "narrow") return "Ход концентрирован в 1-2 бумагах, нужен аккуратный отбор исполнения.";
  if (group.regime === "rotation") return "Рынок крутится внутри кластера, работайте от локальных импульсов.";
  if (group.regime === "broad") return "Подтвержденное участие денег, хорошая база для momentum-сценариев.";
  return "Поток слабый, приоритет на другие кластеры.";
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ₽`;
}

function formatInt(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

function formatNum(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function formatKpiValue(value: number | null, format: StocksModeKpi["format"]): string {
  if (format === "percent") return formatPct(value);
  if (format === "money") return formatMoney(value);
  if (format === "integer") return formatInt(value);
  return value === null ? "—" : String(value);
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function formatBreadth(group: StocksGroupView | undefined): string {
  if (!group) return "—";
  return `${group.up}/${group.down}/${group.neutral}`;
}

function formatAggregateBreadth(groups: StocksGroupView[]): string {
  const up = groups.reduce((acc, group) => acc + group.up, 0);
  const neutral = groups.reduce((acc, group) => acc + group.neutral, 0);
  const down = groups.reduce((acc, group) => acc + group.down, 0);
  return `${up}/${neutral}/${down}`;
}

function relativeLabel(relativeTo: StocksMetricRelativeTo): string {
  if (relativeTo === "market") return "весь рынок акций MOEX";
  if (relativeTo === "mode") return "текущий режим";
  if (relativeTo === "group") return "внутри группы";
  return "базис сессии";
}

const plainBtn = "rounded px-2.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100";
const activeBtn = "rounded bg-slate-800 px-2.5 py-1 text-slate-100";
