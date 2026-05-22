"use client";

import * as React from "react";
import { MaterialsPageShell } from "@/components/materials/materials-page-shell";
import { TechnicalCharacteristicsDataFooter } from "@/components/materials/technical-characteristics-data-footer";
import { TechnicalCharacteristicsInspectorPanel } from "@/components/materials/technical-characteristics-inspector-panel";
import { TechnicalCharacteristicsLessonGuide } from "@/components/materials/technical-characteristics-lesson-guide";
import { TechnicalCharacteristicsPresetPicker } from "@/components/materials/technical-characteristics-preset-picker";
import { TechnicalCharacteristicsPresetTop } from "@/components/materials/technical-characteristics-preset-top";
import { TechnicalCharacteristicsTable } from "@/components/materials/technical-characteristics-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TC_UI } from "@/lib/domain/technical-characteristics-labels";
import { useTechnicalCharacteristicsQuery } from "@/lib/hooks/use-technical-characteristics-query";
import type { MaterialsAssetClassFilter, TechnicalCharacteristicsRow } from "@/lib/materials/contracts";
import {
  buildPresetEvaluationMap,
  getTopPresetRows,
  rankRowsForPreset,
  type TechnicalPreset,
} from "@/lib/domain/technical-characteristics-presets";
import type { DensityMode, TechnicalMode } from "@/lib/materials/technical-characteristics-view";

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
  const [lessonMode, setLessonMode] = React.useState(false);
  const [tradingPreset, setTradingPreset] = React.useState<TechnicalPreset | null>(null);
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

  const presetEvaluations = React.useMemo(() => {
    if (!tradingPreset) return undefined;
    return buildPresetEvaluationMap(filteredRows, tradingPreset);
  }, [filteredRows, tradingPreset]);

  const presetRankByTicker = React.useMemo(() => {
    if (!tradingPreset || filteredRows.length === 0) return new Map<string, number>();
    return new Map(rankRowsForPreset(filteredRows, tradingPreset).map((item) => [item.row.ticker, item.rank]));
  }, [filteredRows, tradingPreset]);

  const presetTopFive = React.useMemo(() => {
    if (!tradingPreset) return [];
    return getTopPresetRows(filteredRows, tradingPreset, 5);
  }, [filteredRows, tradingPreset]);

  const selectedPresetEvaluation = React.useMemo(() => {
    if (!selectedTicker || !presetEvaluations) return null;
    return presetEvaluations.get(selectedTicker) ?? null;
  }, [presetEvaluations, selectedTicker]);

  const selectedRow = React.useMemo(
    () => filteredRows.find((row) => row.ticker === selectedTicker) ?? filteredRows[0] ?? null,
    [filteredRows, selectedTicker],
  );

  const status = query.data?.status;
  const sourceTone = status?.source === "moex" ? "ok" : "warn";
  const freshnessText = status ? `Обновлено ${new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU")}` : "Ожидание данных";
  const sourceLabel = status?.source === "moex" ? TC_UI.sourceOnline : TC_UI.sourceFallback;

  return (
    <MaterialsPageShell
      title="Технические характеристики"
      description={TC_UI.pageDescription}
      freshness={freshnessText}
      sourceLabel={sourceLabel}
      sourceTone={sourceTone}
    >
      {/* 3. Переключатели */}
      <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(value as TechnicalMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="stocks" className="text-xs">
                Акции
              </TabsTrigger>
              <TabsTrigger value="futures" className="text-xs">
                Фьючерсы
              </TabsTrigger>
              <TabsTrigger value="compare" className="text-xs">
                Сравнить
              </TabsTrigger>
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
              {TC_UI.compactDensity}
            </button>
            <button type="button" onClick={() => setDensity("comfortable")} className={density === "comfortable" ? activeBtn : plainBtn}>
              {TC_UI.comfortableDensity}
            </button>
          </div>
          <button type="button" onClick={() => setLessonMode((v) => !v)} className={lessonMode ? lessonActiveBtn : plainBtn}>
            {TC_UI.lessonMode}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-2">
          <select
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none"
            value={boardFilter}
            onChange={(event) => setBoardFilter(event.target.value)}
          >
            {boardOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? TC_UI.allBoards : option}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск…"
            className="min-w-[200px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-400"
          />
          {summary ? (
            <span className="text-[11px] text-slate-500">
              {summary.count} инстр. · спред {fmt(summary.medianSpread)}% · оборот {fmt(summary.totalTurnoverMln)} млн ₽
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">{filteredRows.length} инстр.</span>
          )}
        </div>
      </section>

      {lessonMode ? <TechnicalCharacteristicsLessonGuide /> : null}

      {/* 4. Подобрать инструмент */}
      <TechnicalCharacteristicsPresetPicker selected={tradingPreset} onSelect={setTradingPreset} />

      {/* 5. Топ */}
      {tradingPreset ? (
        <TechnicalCharacteristicsPresetTop
          ranked={presetTopFive}
          selectedTicker={selectedRow?.ticker ?? null}
          onSelectTicker={setSelectedTicker}
        />
      ) : null}

      {/* 6–7. Таблица + инспектор */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <TechnicalCharacteristicsTable
          mode={mode}
          rows={filteredRows}
          density={density}
          heatMode={heatMode}
          selectedTicker={selectedRow?.ticker ?? null}
          onSelectTicker={setSelectedTicker}
          onSummaryChange={setSummary}
          tradingPreset={tradingPreset}
          presetEvaluations={presetEvaluations}
          presetRankByTicker={presetRankByTicker}
        />
        <aside className="h-fit max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-slate-800/90 bg-slate-900/45 p-3 xl:sticky xl:top-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Инспектор</p>
          {selectedRow ? (
            <TechnicalCharacteristicsInspectorPanel
              row={selectedRow}
              tradingPreset={tradingPreset}
              presetEvaluation={selectedPresetEvaluation}
              lessonMode={lessonMode}
            />
          ) : (
            <p className="mt-2 text-xs text-slate-500">{TC_UI.selectInstrument}</p>
          )}
        </aside>
      </div>

      {/* 8. Формулы и источник */}
      <TechnicalCharacteristicsDataFooter statusMessage={status?.message ?? null} showFormulas={!lessonMode} />

      {query.isLoading ? <p className="text-sm text-slate-400">{TC_UI.loading}</p> : null}
      {query.error ? <p className="text-sm text-amber-300">{TC_UI.loadError}</p> : null}
    </MaterialsPageShell>
  );
}

function fmt(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

const plainBtn = "rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100";
const activeBtn = "rounded bg-slate-800 px-2 py-1 text-xs text-slate-100";
const lessonActiveBtn = "rounded bg-violet-500/20 px-2 py-1 text-xs text-violet-200 ring-1 ring-violet-500/30";
