"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialsPageShell } from "@/components/materials/materials-page-shell";
import { useTechnicalCharacteristicsQuery } from "@/lib/hooks/use-technical-characteristics-query";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import { buildFuturesChains, getFuturesModeLabel, type FuturesMode } from "@/lib/materials/futures-map";

export function FuturesMaterialsClient() {
  const [mode, setMode] = React.useState<FuturesMode>("underlyings");
  const [selectedUnderlying, setSelectedUnderlying] = React.useState<string | null>(null);
  const [heatMetric, setHeatMetric] = React.useState<"turnover" | "oi" | "dte" | "friction">("turnover");
  const [compareEnabled, setCompareEnabled] = React.useState(false);
  const technicalQuery = useTechnicalCharacteristicsQuery("future", "all");
  const futuresQuery = useScreenerQuery("future");
  const chains = React.useMemo(
    () => buildFuturesChains(technicalQuery.data?.rows ?? [], futuresQuery.data?.rows ?? []),
    [technicalQuery.data?.rows, futuresQuery.data?.rows],
  );

  React.useEffect(() => {
    const first = chains[0];
    if (!first) {
      setSelectedUnderlying(null);
      return;
    }
    if (!selectedUnderlying || !chains.some((chain) => chain.id === selectedUnderlying)) {
      setSelectedUnderlying(first.id);
    }
  }, [chains, selectedUnderlying]);

  const selectedChain = chains.find((chain) => chain.id === selectedUnderlying) ?? chains[0] ?? null;
  const status = technicalQuery.data?.status ?? futuresQuery.data?.status ?? null;
  const freshnessText = status ? `Обновлено ${new Date(status.fetchTimestamp).toLocaleTimeString("ru-RU")}` : "Ожидание данных";
  const sourceLabel = status?.source === "moex" ? "MOEX ISS online" : "Fallback / временно недоступно";
  const sourceTone = status?.source === "moex" ? "ok" : "warn";

  return (
    <MaterialsPageShell
      title="Фьючерсы"
      description="Карта срочного рынка MOEX по базовым активам: цепочки экспираций, кривая, ролл и базисные сигналы для интрадей."
      freshness={freshnessText}
      sourceLabel={sourceLabel}
      sourceTone={sourceTone}
    >
      <section className="rounded-lg border border-slate-800/90 bg-slate-900/40 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(value as FuturesMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="underlyings" className="text-xs">Базовые активы</TabsTrigger>
              <TabsTrigger value="curve" className="text-xs">Кривая</TabsTrigger>
              <TabsTrigger value="roll" className="text-xs">Ролл и ликвидность</TabsTrigger>
              <TabsTrigger value="basis" className="text-xs">Связи и базис</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="inline-flex rounded-md border border-slate-700/80 bg-slate-950/80 p-0.5 text-xs">
            <button type="button" onClick={() => setHeatMetric("turnover")} className={heatMetric === "turnover" ? activeBtn : plainBtn}>Heat: оборот</button>
            <button type="button" onClick={() => setHeatMetric("oi")} className={heatMetric === "oi" ? activeBtn : plainBtn}>Heat: OI</button>
            <button type="button" onClick={() => setHeatMetric("dte")} className={heatMetric === "dte" ? activeBtn : plainBtn}>Heat: DTE</button>
            <button type="button" onClick={() => setHeatMetric("friction")} className={heatMetric === "friction" ? activeBtn : plainBtn}>Heat: фрикция</button>
          </div>
          <button type="button" onClick={() => setCompareEnabled((v) => !v)} className={compareEnabled ? activeBtn : plainBtn}>
            Compare F1 vs F2
          </button>
          <span className="ml-auto text-[11px] text-slate-500">Режим: {getFuturesModeLabel(mode)} · Базовых активов: {chains.length}</span>
        </div>
      </section>

      <section className="grid gap-2 rounded-lg border border-slate-800/90 bg-slate-900/35 p-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Где деньги (цепочка №1)" value={formatMoney(chains[0]?.totalTurnover ?? null)} />
        <SummaryCard label="Где позиция (цепочка №1)" value={formatInt(chains[0]?.totalOpenInterest ?? null)} />
        <SummaryCard label="Roll watch" value={rollStateLabel(chains[0]?.rollState)} />
        <SummaryCard label="Режим кривой" value={curveLabel(chains[0]?.curveShape)} />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-2">
          {mode === "underlyings" ? (
            <UnderlyingBoard chains={chains} selectedId={selectedChain?.id ?? null} onSelect={setSelectedUnderlying} heatMetric={heatMetric} />
          ) : null}
          {mode === "curve" ? <CurveBoard chain={selectedChain} compareEnabled={compareEnabled} /> : null}
          {mode === "roll" ? <RollBoard chain={selectedChain} /> : null}
          {mode === "basis" ? <BasisBoard chain={selectedChain} /> : null}
        </section>

        <aside className="h-fit rounded-lg border border-slate-800/90 bg-slate-900/45 p-3 xl:sticky xl:top-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Инспектор цепочки</p>
          {selectedChain ? (
            <div className="mt-2 space-y-2 text-xs">
              <MetricRow label="Базовый актив" value={selectedChain.title} />
              <MetricRow label="Главный контракт" value={selectedChain.front?.ticker ?? "—"} />
              <MetricRow label="Следующий контракт" value={selectedChain.next?.ticker ?? "—"} />
              <MetricRow label="DTE front/next" value={`${fmtDte(selectedChain.front?.dte ?? null)} / ${fmtDte(selectedChain.next?.dte ?? null)}`} />
              <MetricRow label="Front dominance" value={formatShare(selectedChain.frontTurnoverShare)} />
              <MetricRow label="Next dominance" value={formatShare(selectedChain.nextTurnoverShare)} />
              <MetricRow label="Curve regime" value={curveLabel(selectedChain.curveShape)} />
              <MetricRow label="Roll interpretation" value={rollStateLabel(selectedChain.rollState)} />
              <MetricRow label="Практическая заметка" value={traderNote(selectedChain.rollState, selectedChain.curveShape)} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">Нет данных по фьючерсам.</p>
          )}
        </aside>
      </div>
    </MaterialsPageShell>
  );
}

function UnderlyingBoard({
  chains,
  selectedId,
  onSelect,
  heatMetric,
}: {
  chains: ReturnType<typeof buildFuturesChains>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  heatMetric: "turnover" | "oi" | "dte" | "friction";
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/55">
      <table className="w-full min-w-[1160px] table-fixed border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
          <tr className="border-b border-slate-800/90 text-[11px] uppercase tracking-[0.08em] text-slate-500">
            <th className="px-3 py-2 text-left">Базовый актив</th>
            <th className="px-3 py-2 text-right">Оборот цепочки, ₽</th>
            <th className="px-3 py-2 text-right">Сделки, шт</th>
            <th className="px-3 py-2 text-right">OI, контр.</th>
            <th className="px-3 py-2 text-left">Front / Next</th>
            <th className="px-3 py-2 text-right">Доля front / next</th>
            <th className="px-3 py-2 text-left">Кривая</th>
            <th className="px-3 py-2 text-left">Ролл</th>
          </tr>
        </thead>
        <tbody>
          {chains.map((chain) => (
            <tr
              key={chain.id}
              onClick={() => onSelect(chain.id)}
              className={`cursor-pointer border-b border-slate-800/50 transition hover:bg-slate-800/45 ${selectedId === chain.id ? "bg-slate-800/45" : ""} ${heatRowClass(chain, heatMetric)}`}
            >
              <td className="px-3 py-2 text-left font-medium text-slate-100">{chain.title}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-200">{formatMoney(chain.totalTurnover)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-200">{formatInt(chain.totalTrades)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-200">{formatInt(chain.totalOpenInterest)}</td>
              <td className="px-3 py-2 text-left text-slate-300">{chain.front?.ticker ?? "—"} / {chain.next?.ticker ?? "—"}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-300">{formatShare(chain.frontTurnoverShare)} / {formatShare(chain.nextTurnoverShare)}</td>
              <td className="px-3 py-2 text-left text-slate-200">{curveLabel(chain.curveShape)}</td>
              <td className="px-3 py-2 text-left text-slate-200">{rollStateLabel(chain.rollState)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CurveBoard({ chain, compareEnabled }: { chain: ReturnType<typeof buildFuturesChains>[number] | null; compareEnabled: boolean }) {
  if (!chain) return <p className="text-sm text-slate-500">Нет цепочки для отображения.</p>;
  const front = chain.front;
  const next = chain.next;
  return (
    <div className="space-y-2">
      {compareEnabled && front && next ? (
        <div className="grid gap-2 rounded-lg border border-slate-800/90 bg-slate-900/40 p-2.5 md:grid-cols-2">
          <SummaryCard label="F1 vs F2: спред цены" value={priceDiff(front.price, next.price)} />
          <SummaryCard label="F1 vs F2: спред DTE" value={dteDiff(front.dte, next.dte)} />
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/55">
        <table className="w-full min-w-[1240px] table-fixed border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm">
            <tr className="border-b border-slate-800/90 text-[11px] uppercase tracking-[0.08em] text-slate-500">
              <th className="px-3 py-2 text-left">Контракт</th>
              <th className="px-3 py-2 text-left">Экспирация</th>
              <th className="px-3 py-2 text-right">DTE, дни</th>
              <th className="px-3 py-2 text-right">Цена</th>
              <th className="px-3 py-2 text-right">Оборот, ₽</th>
              <th className="px-3 py-2 text-right">Сделки, шт</th>
              <th className="px-3 py-2 text-right">OI, контр.</th>
              <th className="px-3 py-2 text-right">Спред, %</th>
              <th className="px-3 py-2 text-right">Шаг / тик, ₽</th>
              <th className="px-3 py-2 text-right">GO, ₽</th>
              <th className="px-3 py-2 text-right">Confidence, %</th>
            </tr>
          </thead>
          <tbody>
            {chain.contracts.map((contract, idx) => (
              <tr key={contract.ticker} className={`border-b border-slate-800/50 ${idx === 0 ? "bg-cyan-950/20" : idx === 1 ? "bg-indigo-950/15" : ""}`}>
                <td className="px-3 py-2 text-left font-mono text-slate-100">{contract.ticker}</td>
                <td className="px-3 py-2 text-left text-slate-300">{contract.expiry ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-200">{fmtDte(contract.dte)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-200">{formatNum(contract.price)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-200">{formatMoney(contract.turnover)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-200">{formatInt(contract.trades)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-200">{formatInt(contract.openInterest)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-200">{formatNum(contract.spreadPct)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-200">{formatNum(contract.tickSize)} / {formatNum(contract.tickValue)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-400">{contract.marginFootprintRub === null ? "н/д" : formatMoney(contract.marginFootprintRub)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-300">{contract.availabilityConfidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RollBoard({ chain }: { chain: ReturnType<typeof buildFuturesChains>[number] | null }) {
  if (!chain) return <p className="text-sm text-slate-500">Нет цепочки для отображения.</p>;
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <SummaryCard label="Front dominance" value={formatShare(chain.frontTurnoverShare)} />
      <SummaryCard label="Next dominance" value={formatShare(chain.nextTurnoverShare)} />
      <SummaryCard label="Состояние ролла" value={rollStateLabel(chain.rollState)} />
      <SummaryCard label="Фрикционность входа (front)" value={frictionLabel(chain.front?.spreadPct ?? null, chain.front?.trades ?? null, chain.front?.turnover ?? null)} />
      <SummaryCard label="Ликвидность front" value={`${formatMoney(chain.front?.turnover ?? null)} / ${formatInt(chain.front?.trades ?? null)} сделок`} />
      <SummaryCard label="Ликвидность next" value={`${formatMoney(chain.next?.turnover ?? null)} / ${formatInt(chain.next?.trades ?? null)} сделок`} />
    </div>
  );
}

function BasisBoard({ chain }: { chain: ReturnType<typeof buildFuturesChains>[number] | null }) {
  if (!chain) return <p className="text-sm text-slate-500">Нет цепочки для отображения.</p>;
  const front = chain.front;
  const next = chain.next;
  const calendarAbs = front?.price !== null && next?.price !== null && front?.price !== undefined && next?.price !== undefined ? next.price - front.price : null;
  const calendarPct = front?.price ? ((next?.price ?? front.price) - front.price) / front.price * 100 : null;
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <SummaryCard label="Календарный спред, абс" value={formatNum(calendarAbs)} />
      <SummaryCard label="Календарный спред, %" value={formatNum(calendarPct)} />
      <SummaryCard label="Режим кривой" value={curveLabel(chain.curveShape)} />
      <SummaryCard label="Basis vs базовый актив" value="н/д в текущем потоке" />
      <SummaryCard label="Basis stress" value={basisStressLabel(chain.curveShape, calendarPct)} />
      <SummaryCard label="Цена ошибки, 1/5/10 тиков" value={costToBeWrong(front?.tickValue ?? null)} />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
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

function heatRowClass(chain: ReturnType<typeof buildFuturesChains>[number], metric: "turnover" | "oi" | "dte" | "friction") {
  if (metric === "turnover" && chain.totalTurnover > 10_000_000_000) return "text-cyan-100";
  if (metric === "oi" && chain.totalOpenInterest > 150_000) return "text-indigo-100";
  if (metric === "dte" && (chain.front?.dte ?? 999) <= 14) return "text-amber-100";
  if (metric === "friction" && (chain.front?.spreadPct ?? 0) >= 0.25) return "text-rose-100";
  return "";
}

function curveLabel(shape: "contango" | "backwardation" | "flat" | "unavailable" | undefined): string {
  if (shape === "contango") return "Contango";
  if (shape === "backwardation") return "Backwardation";
  if (shape === "flat") return "Flat";
  return "н/д";
}

function rollStateLabel(state: "front-dominant" | "next-taking-over" | "roll-started" | "fragmented" | undefined): string {
  if (state === "front-dominant") return "Front still dominant";
  if (state === "next-taking-over") return "Next taking over";
  if (state === "roll-started") return "Начинается ролл";
  if (state === "fragmented") return "Ликвидность распадается";
  return "н/д";
}

function traderNote(state: "front-dominant" | "next-taking-over" | "roll-started" | "fragmented", shape: "contango" | "backwardation" | "flat" | "unavailable"): string {
  if (state === "next-taking-over") return "Смещайте исполнение в next-контракт, front теряет глубину.";
  if (state === "roll-started") return "Следите за проскальзыванием: ликвидность делится между F1/F2.";
  if (state === "fragmented") return "Исполнение фрагментировано, избегайте агрессивного входа крупным размером.";
  if (shape === "backwardation") return "Back-часть может давать аномальные реакции на новостной поток.";
  return "Front ликвиден, базовое исполнение предпочтительно в главном контракте.";
}

function frictionLabel(spreadPct: number | null, trades: number | null, turnover: number | null): string {
  if (spreadPct === null || trades === null || turnover === null || trades <= 0 || turnover <= 0) return "н/д";
  const score = spreadPct * 100 * (1_000_000 / turnover) * (10_000 / trades);
  if (score < 1) return "Низкая";
  if (score < 5) return "Средняя";
  return "Высокая";
}

function basisStressLabel(shape: "contango" | "backwardation" | "flat" | "unavailable", calendarPct: number | null): string {
  if (shape === "unavailable" || calendarPct === null) return "н/д";
  if (Math.abs(calendarPct) >= 1.5) return "Высокий";
  if (Math.abs(calendarPct) >= 0.7) return "Средний";
  return "Низкий";
}

function costToBeWrong(tickValue: number | null): string {
  if (tickValue === null) return "н/д";
  return `${formatMoney(tickValue)} / ${formatMoney(tickValue * 5)} / ${formatMoney(tickValue * 10)}`;
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
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
}

function formatShare(value: number | null): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function fmtDte(value: number | null): string {
  if (value === null) return "—";
  return String(Math.max(0, Math.round(value)));
}

function priceDiff(front: number | null, next: number | null): string {
  if (front === null || next === null) return "—";
  return formatNum(next - front);
}

function dteDiff(front: number | null, next: number | null): string {
  if (front === null || next === null) return "—";
  return `${Math.round(next - front)} дн`;
}

const plainBtn = "rounded px-2.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100";
const activeBtn = "rounded bg-slate-800 px-2.5 py-1 text-slate-100";
