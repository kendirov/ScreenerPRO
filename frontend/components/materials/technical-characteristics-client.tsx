"use client";

import * as React from "react";
import { MaterialsPageShell } from "@/components/materials/materials-page-shell";
import { TechnicalCharacteristicsTable } from "@/components/materials/technical-characteristics-table";
import { useTechnicalCharacteristicsQuery } from "@/lib/hooks/use-technical-characteristics-query";
import type { MaterialsAssetClassFilter, TechnicalCharacteristicsRow } from "@/lib/materials/contracts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEntryFriction, type DensityMode, type TechnicalMode } from "@/lib/materials/technical-characteristics-view";

function filterBySearch(rows: TechnicalCharacteristicsRow[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) => row.ticker.toLowerCase().includes(normalized) || row.instrumentName.toLowerCase().includes(normalized));
}

function filterByBoard(rows: TechnicalCharacteristicsRow[], board: string) {
  if (board === "all") return rows;
  return rows.filter((row) => row.board === board);
}

export function TechnicalCharacteristicsClient() {
  const [mode, setMode] = React.useState<TechnicalMode>("stocks");
  const [liquidity, setLiquidity] = React.useState<"liquid" | "all">("liquid");
  const [tradableNow, setTradableNow] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [boardFilter, setBoardFilter] = React.useState("all");
  const [selectedTicker, setSelectedTicker] = React.useState<string | null>(null);
  const [density, setDensity] = React.useState<DensityMode>("compact");
  const [heatMode, setHeatMode] = React.useState(false);
  const [summary, setSummary] = React.useState<{ count: number; medianSpread: number | null; totalTurnoverMln: number | null; avgTrades: number | null } | null>(null);
  const assetClass: MaterialsAssetClassFilter = mode === "stocks" ? "stock" : mode === "futures" ? "future" : "all";
  const query = useTechnicalCharacteristicsQuery(assetClass, liquidity);

  const boardOptions = React.useMemo(() => {
    const values = new Set<string>();
    for (const row of query.data?.rows ?? []) {
      if (row.board) values.add(row.board);
    }
    return ["all", ...Array.from(values).sort((a, b) => a.localeCompare(b, "ru"))];
  }, [query.data?.rows]);

  const filteredRows = React.useMemo(() => {
    const searched = filterBySearch(query.data?.rows ?? [], search);
    const byBoard = filterByBoard(searched, boardFilter);
    if (!tradableNow) return byBoard;
    return byBoard.filter((row) => (row.tradesCount.value ?? 0) > 0 && (row.spreadPct.value ?? 99) < 1.2);
  }, [query.data?.rows, search, boardFilter, tradableNow]);
  const selectedRow = React.useMemo(
    () => filteredRows.find((row) => row.ticker === selectedTicker) ?? filteredRows[0] ?? null,
    [filteredRows, selectedTicker],
  );

  const status = query.data?.status;
  const sourceTone = status?.source === "moex" ? "ok" : "warn";
  const freshnessText = status ? `Обновлено ${new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU")}` : "Ожидание данных";
  const sourceLabel = status?.source === "moex" ? "MOEX ISS online" : "Fallback / временно недоступно";

  return (
    <MaterialsPageShell
      title="Технические характеристики"
      description="Оперативный справочник по инструментам MOEX: торговые параметры, микро-структура и прикладные расчетные поля для интрадей."
      freshness={freshnessText}
      sourceLabel={sourceLabel}
      sourceTone={sourceTone}
    >
      <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(value as TechnicalMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="stocks" className="text-xs">Акции</TabsTrigger>
              <TabsTrigger value="futures" className="text-xs">Фьючерсы</TabsTrigger>
              <TabsTrigger value="compare" className="text-xs">Сравнить</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="inline-flex rounded-md border border-slate-700/80 bg-slate-950/80 p-0.5 text-xs">
            <button type="button" onClick={() => setLiquidity("liquid")} className={liquidity === "liquid" ? activeBtn : plainBtn}>
              Ликвидные
            </button>
            <button type="button" onClick={() => setLiquidity("all")} className={liquidity === "all" ? activeBtn : plainBtn}>
              Все
            </button>
          </div>
          <button type="button" onClick={() => setTradableNow((v) => !v)} className={tradableNow ? activeBtn : plainBtn}>
            Только торгуемые
          </button>
          <div className="inline-flex rounded-md border border-slate-700/80 bg-slate-950/80 p-0.5 text-xs">
            <button type="button" onClick={() => setDensity("compact")} className={density === "compact" ? activeBtn : plainBtn}>
              Compact
            </button>
            <button type="button" onClick={() => setDensity("comfortable")} className={density === "comfortable" ? activeBtn : plainBtn}>
              Comfortable
            </button>
          </div>
          <button type="button" onClick={() => setHeatMode((v) => !v)} className={heatMode ? activeBtn : plainBtn}>
            Heat metric
          </button>
          <select
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 outline-none"
            value={boardFilter}
            onChange={(event) => setBoardFilter(event.target.value)}
          >
            {boardOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Все board" : option}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск тикер/название..."
            className="min-w-[260px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          />
          <span className="text-[11px] text-slate-500">Показано {filteredRows.length}</span>
        </div>
      </section>
      <section className="grid gap-2 rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Инструментов" value={summary ? String(summary.count) : "—"} />
        <SummaryItem label="Median spread, %" value={fmt(summary?.medianSpread ?? null)} />
        <SummaryItem label="Total turnover, млн ₽" value={fmt(summary?.totalTurnoverMln ?? null)} />
        <SummaryItem label="Avg trades, шт" value={fmt(summary?.avgTrades ?? null)} />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <TechnicalCharacteristicsTable
          mode={mode}
          rows={filteredRows}
          density={density}
          heatMode={heatMode}
          selectedTicker={selectedRow?.ticker ?? null}
          onSelectTicker={setSelectedTicker}
          onSummaryChange={setSummary}
        />
        <aside className="h-fit rounded-lg border border-slate-800/90 bg-slate-900/45 p-3 xl:sticky xl:top-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Инспектор</p>
          {selectedRow ? (
            <div className="mt-2 space-y-2 text-xs">
              <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="text-sm font-semibold text-slate-100">
                  {selectedRow.ticker} <span className="font-normal text-slate-400">{selectedRow.instrumentName}</span>
                </p>
                <p className="mt-1 text-slate-400">{selectedRow.assetClass === "stock" ? "Акция" : "Фьючерс"} · {selectedRow.board ?? "—"} · {selectedRow.market ?? "—"}</p>
              </div>
              <InspectorRow label="Лот-экономика" value={`${formatMoney(selectedRow.lotPrice.value)} / лот`} />
              <InspectorRow label="Комиссия покрытие" value={`${formatMoney(selectedRow.commissionRub.value)} · ${formatNum(selectedRow.pointsToCoverCommission.value)} тика`} />
              <InspectorRow label="Спред стоимость" value={`${formatMoney(selectedRow.spreadRub.value)} · ${formatNum(selectedRow.spreadTicks.value)} тика`} />
              <InspectorRow label="Cost to be wrong" value={`1 тик: ${formatMoney(selectedRow.stepValue.value)} · 5: ${formatMoney(scale(selectedRow.stepValue.value, 5))} · 10: ${formatMoney(scale(selectedRow.stepValue.value, 10))}`} />
              <InspectorRow label="Ликвидность" value={`${selectedRow.liquidityQuality} · ${selectedRow.scalabilityHint}`} />
              <InspectorRow label="Intraday score" value={formatNum(selectedRow.intradayUsabilityScore.value)} />
              <InspectorRow label="Commission vs range" value={formatNum(selectedRow.commissionToRangeScore.value)} />
              <InspectorRow label="Entry friction" value={formatNum(getEntryFriction(selectedRow))} />
              <InspectorRow label="Field confidence" value={`${selectedRow.availabilityConfidence}%`} />
              {selectedRow.assetClass === "future" ? (
                <>
                  <InspectorRow label="Базовый актив" value={selectedRow.underlying ?? "—"} />
                  <InspectorRow label="Экспирация" value={`${selectedRow.expiryDate ?? "—"} (${formatNum(selectedRow.daysToExpiry.value)} дн)`} />
                  <InspectorRow label="ГО/маржинальность" value={selectedRow.marginFootprintRub.value === null ? "нет в источнике" : formatMoney(selectedRow.marginFootprintRub.value)} />
                </>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Выберите инструмент из таблицы.</p>
          )}
        </aside>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Формулы и интерпретация</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            <li>Цена лота = Текущая цена × Размер лота.</li>
            <li>Стоимость шага (акции) = Шаг цены × Размер лота.</li>
            <li>Крупный лот (1%) = 1% от внутридневного оборота инструмента.</li>
            <li>Пункты до комиссии = Комиссия / Стоимость шага.</li>
            <li>Оборот/сделка = Оборот / Сделки; Slippage прокси растет при тонком потоке.</li>
            <li>Intraday score агрегирует спред, поток сделок и оборот (оперативный скоринг).</li>
          </ul>
        </section>
        <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Источник и валидность</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            <li>Источник: MOEX ISS.</li>
            <li>Незаполненные поля показаны как “—”, без подмены искусственными значениями.</li>
            <li>Комиссионные поля - прикладная оценка для сравнения инструментов и сценарного расчета.</li>
            <li>{status?.message ?? "Статус источника уточняется..."}</li>
          </ul>
        </section>
      </div>

      {query.isLoading ? <p className="text-sm text-slate-400">Загрузка технических характеристик...</p> : null}
      {query.error ? <p className="text-sm text-amber-300">Ошибка загрузки. Показаны последние доступные данные, если есть.</p> : null}
    </MaterialsPageShell>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-200">{value}</span>
    </div>
  );
}

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function formatNum(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/45 px-2 py-1.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-mono text-sm text-slate-100">{value}</p>
    </div>
  );
}

function fmt(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function scale(value: number | null, factor: number) {
  if (value === null) return null;
  return value * factor;
}

const plainBtn = "rounded px-2.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100";
const activeBtn = "rounded bg-slate-800 px-2.5 py-1 text-slate-100";
