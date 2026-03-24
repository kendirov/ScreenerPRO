"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ScreenerRow } from "@screenerpro/shared";
import { EmptyState } from "@/components/ui/primitives";
import {
  buildFuturesFamilies,
  type FuturesFamilyGroup,
} from "@/lib/domain/futures-family";
import { tradingFormat } from "@/lib/formatters/trading";

function compactRub(value: number | null): string {
  return tradingFormat.formatTurnoverRub(value).replace(/\s?₽/g, "");
}

function percentClass(value: number | null): string {
  if ((value ?? 0) > 0) return "text-emerald-300";
  if ((value ?? 0) < 0) return "text-rose-300";
  return "text-slate-300";
}

function curveLabel(value: FuturesFamilyGroup["curve"]["curveShape"]): string {
  if (value === "contango") return "Contango";
  if (value === "backwardation") return "Backwardation";
  return "Flat";
}

function rollClass(status: FuturesFamilyGroup["rollStatus"]): string {
  if (status === "Активный") return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  if (status === "Идёт") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "Слабый") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-slate-500/30 bg-slate-500/10 text-slate-200";
}

type ContractSortKey = "dte" | "lastPrice" | "turnover" | "openInterest";
type CurveDisplayMode = "price" | "relative" | "turnover";
type ChartPoint = {
  ticker: string;
  expiryDate: string | null;
  dte: number | null;
  price: number | null;
  turnover: number;
  openInterest: number;
  turnoverShareWithinGroup: number;
  relativePct: number | null;
  isLiquid: boolean;
  x: number;
  y: number;
};

function isSanePercent(value: number | null, maxAbs = 80): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= maxAbs;
}

function FamilyExpandedContent({ group }: { group: FuturesFamilyGroup }) {
  const [sortKey, setSortKey] = React.useState<ContractSortKey>("turnover");
  const [sortDesc, setSortDesc] = React.useState(true);
  const [curveMode, setCurveMode] = React.useState<CurveDisplayMode>("price");
  const [hoveredPoint, setHoveredPoint] = React.useState<ChartPoint | null>(null);
  const [selectedLineKey, setSelectedLineKey] = React.useState<string | null>(group.mainTradingLineKey);

  React.useEffect(() => {
    setSelectedLineKey(group.mainTradingLineKey);
  }, [group.mainTradingLineKey, group.familyKey]);

  const sortedContracts = React.useMemo(() => {
    const list = [...group.contracts];
    list.sort((a, b) => {
      let diff = 0;
      if (sortKey === "dte") diff = (a.dte ?? Number.POSITIVE_INFINITY) - (b.dte ?? Number.POSITIVE_INFINITY);
      if (sortKey === "lastPrice") diff = (a.lastPrice ?? Number.NEGATIVE_INFINITY) - (b.lastPrice ?? Number.NEGATIVE_INFINITY);
      if (sortKey === "turnover") diff = a.turnover - b.turnover;
      if (sortKey === "openInterest") diff = a.openInterest - b.openInterest;
      return sortDesc ? -diff : diff;
    });
    return list;
  }, [group.contracts, sortDesc, sortKey]);

  const selectedLine = React.useMemo(
    () => group.subfamilies.find((line) => line.key === selectedLineKey) ?? group.subfamilies.find((line) => line.key === group.mainTradingLineKey) ?? group.subfamilies[0] ?? null,
    [group.mainTradingLineKey, group.subfamilies, selectedLineKey],
  );

  const activeContract = React.useMemo(
    () => group.contracts.find((contract) => contract.ticker === group.activeContractTicker) ?? selectedLine?.frontContract ?? group.contracts[0] ?? null,
    [group.activeContractTicker, group.contracts, selectedLine],
  );

  const fullComparableCurve = React.useMemo(
    () => [...(selectedLine?.contracts ?? group.comparableContracts)].sort((a, b) => (a.dte ?? Number.POSITIVE_INFINITY) - (b.dte ?? Number.POSITIVE_INFINITY)),
    [group.comparableContracts, selectedLine],
  );

  const chart = React.useMemo(() => {
    const width = 360;
    const height = 170;
    const pad = { l: 38, r: 12, t: 14, b: 30 };
    const plotWidth = width - pad.l - pad.r;
    const plotHeight = height - pad.t - pad.b;
    const basePrice = activeContract?.lastPrice ?? null;
    const source = fullComparableCurve
      .map((contract) => {
        const relativePct =
          basePrice && contract.lastPrice && basePrice > 0
            ? ((contract.lastPrice - basePrice) / basePrice) * 100
            : null;
        const isLiquid = contract.turnoverShareWithinGroup >= 0.003 || contract.turnover >= 5_000_000;
        const value = curveMode === "price" ? contract.lastPrice : curveMode === "turnover" ? contract.turnover : relativePct;
        return { contract, value, relativePct, isLiquid };
      })
      .filter((item) => {
        if (item.value === null || !Number.isFinite(item.value)) return false;
        if (curveMode === "relative") return isSanePercent(item.value, 40);
        if (curveMode === "turnover") return item.value >= 0;
        return item.value > 0;
      });

    if (source.length < 2) {
      return { width, height, pad, points: [] as ChartPoint[], path: "", tailPath: "", yTicks: [] as number[] };
    }

    const yValues = source.map((item) => item.value as number);
    const minYRaw = Math.min(...yValues);
    const maxYRaw = Math.max(...yValues);
    const span = Math.max(maxYRaw - minYRaw, Math.abs(maxYRaw) * 0.005, 0.0001);
    const minY = minYRaw - span * 0.08;
    const maxY = maxYRaw + span * 0.08;
    const ySpan = maxY - minY;
    const stepX = source.length > 1 ? plotWidth / (source.length - 1) : 0;

    const points: ChartPoint[] = source.map((item, idx) => {
      const x = source.length > 1 ? pad.l + idx * stepX : pad.l + plotWidth / 2;
      const y = pad.t + (maxY - (item.value as number)) / ySpan * plotHeight;
      return {
        ticker: item.contract.ticker,
        expiryDate: item.contract.expiryDate,
        dte: item.contract.dte,
        price: item.contract.lastPrice,
        turnover: item.contract.turnover,
        openInterest: item.contract.openInterest,
        turnoverShareWithinGroup: item.contract.turnoverShareWithinGroup,
        relativePct: item.relativePct,
        isLiquid: item.isLiquid,
        x,
        y,
      };
    });

    const path = points.map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const liquidIndices = points.map((point, idx) => (point.isLiquid ? idx : -1)).filter((idx) => idx >= 0);
    const lastLiquidIdx = liquidIndices.length ? Math.max(...liquidIndices) : -1;
    const tailPath =
      lastLiquidIdx >= 0 && lastLiquidIdx < points.length - 1
        ? points
            .slice(lastLiquidIdx)
            .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
            .join(" ")
        : "";
    const yTicks = [0, 1, 2, 3].map((idx) => minY + (ySpan * idx) / 3);

    return { width, height, pad, points, path, tailPath, yTicks };
  }, [activeContract?.lastPrice, curveMode, fullComparableCurve]);

  const spreadValid = isSanePercent(group.curve.frontNextSpread, 40);
  const hasChart = chart.points.length >= 2;
  const liquidPointsCount = chart.points.filter((point) => point.isLiquid).length;
  const nextComparable = fullComparableCurve[1] ?? null;
  const nextTurnoverShare = nextComparable?.turnoverShareWithinGroup ?? 0;
  const alternativeLine = React.useMemo(() => {
    const main = group.subfamilies.find((line) => line.key === group.mainTradingLineKey);
    const candidate = group.subfamilies.find((line) => line.key !== main?.key);
    if (!candidate) return null;
    return candidate.totalTurnoverShare >= 0.1 || candidate.totalOIShare >= 0.2 ? candidate : null;
  }, [group.mainTradingLineKey, group.subfamilies]);

  function toggleSort(nextKey: ContractSortKey) {
    if (sortKey === nextKey) {
      setSortDesc((prev) => !prev);
      return;
    }
    setSortKey(nextKey);
    setSortDesc(nextKey === "turnover" || nextKey === "openInterest");
  }

  return (
    <div className="grid gap-2 border-t border-white/5 bg-slate-950/60 p-3 lg:grid-cols-2">
      <section className="rounded-lg border border-white/5 bg-black/25 p-2.5">
        <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">Контракты</p>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
              <th className="py-1 text-left font-medium">Контракт</th>
              <th className="py-1 text-left font-medium">Экспирация</th>
              <th className="py-1 text-right font-medium">
                <button type="button" onClick={() => toggleSort("dte")} className="text-slate-300 hover:text-white">
                  Дней
                </button>
              </th>
              <th className="py-1 text-right font-medium">
                <button type="button" onClick={() => toggleSort("lastPrice")} className="text-slate-300 hover:text-white">
                  Цена
                </button>
              </th>
              <th className="py-1 text-right font-medium">
                <button type="button" onClick={() => toggleSort("turnover")} className="text-slate-300 hover:text-white">
                  Оборот
                </button>
              </th>
              <th className="py-1 text-right font-medium">
                <button type="button" onClick={() => toggleSort("openInterest")} className="text-slate-300 hover:text-white">
                  ОИ
                </button>
              </th>
              <th className="py-1 text-right font-medium">Доля оборота</th>
            </tr>
          </thead>
          <tbody>
            {sortedContracts.map((contract) => (
              <tr key={contract.ticker} className="border-b border-white/5 last:border-b-0">
                <td className="py-1.5 font-semibold text-slate-200">{contract.ticker}</td>
                <td className="py-1.5 text-slate-400">{contract.expiryDate ? new Date(contract.expiryDate).toLocaleDateString("ru-RU") : "—"}</td>
                <td className="py-1.5 text-right text-slate-300">{contract.dte ?? "—"}</td>
                <td className="py-1.5 text-right font-mono text-slate-300">{tradingFormat.formatDynamicPrice(contract.lastPrice)}</td>
                <td className="py-1.5 text-right font-mono text-slate-300">{compactRub(contract.turnover)}</td>
                <td className="py-1.5 text-right font-mono text-slate-300">{tradingFormat.formatInteger(contract.openInterest)}</td>
                <td className="py-1.5 text-right font-mono text-slate-400">{Math.round(contract.turnoverShareWithinGroup * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-white/5 bg-black/25 p-2.5">
        {alternativeLine ? (
          <div className="mb-2 inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5">
            <button
              type="button"
              onClick={() => setSelectedLineKey(group.mainTradingLineKey)}
              className={`rounded-md px-2 py-1 text-[10px] ${selectedLine?.key === group.mainTradingLineKey ? "bg-slate-700 text-white" : "text-slate-400"}`}
            >
              Основная линия
            </button>
            <button
              type="button"
              onClick={() => setSelectedLineKey(alternativeLine.key)}
              className={`rounded-md px-2 py-1 text-[10px] ${selectedLine?.key === alternativeLine.key ? "bg-slate-700 text-white" : "text-slate-400"}`}
            >
              Альтернативная линия
            </button>
          </div>
        ) : null}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Кривая</p>
          <div className="inline-flex rounded-lg border border-white/10 bg-black/25 p-0.5">
            <button
              type="button"
              onClick={() => setCurveMode("price")}
              className={`rounded-md px-2 py-1 text-[10px] ${curveMode === "price" ? "bg-slate-700 text-white" : "text-slate-400"}`}
            >
              Цена
            </button>
            <button
              type="button"
              onClick={() => setCurveMode("relative")}
              className={`rounded-md px-2 py-1 text-[10px] ${curveMode === "relative" ? "bg-slate-700 text-white" : "text-slate-400"}`}
            >
              % к активному
            </button>
            <button
              type="button"
              onClick={() => setCurveMode("turnover")}
              className={`rounded-md px-2 py-1 text-[10px] ${curveMode === "turnover" ? "bg-slate-700 text-white" : "text-slate-400"}`}
            >
              Оборот
            </button>
          </div>
        </div>
        <div className="relative mb-2 rounded-md border border-white/10 bg-slate-950/45 p-2">
          {hasChart ? (
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-[190px] w-full">
              <line x1={chart.pad.l} y1={chart.height - chart.pad.b} x2={chart.width - chart.pad.r} y2={chart.height - chart.pad.b} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
              <line x1={chart.pad.l} y1={chart.pad.t} x2={chart.pad.l} y2={chart.height - chart.pad.b} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
              {chart.yTicks.map((tick) => {
                const y = chart.pad.t + ((Math.max(...chart.yTicks) - tick) / (Math.max(...chart.yTicks) - Math.min(...chart.yTicks) || 1)) * (chart.height - chart.pad.t - chart.pad.b);
                return (
                  <g key={`tick-${tick}`}>
                    <line x1={chart.pad.l} y1={y} x2={chart.width - chart.pad.r} y2={y} stroke="rgba(71,85,105,0.25)" strokeWidth="1" />
                    <text x={6} y={y + 3} fontSize="10" fill="rgba(148,163,184,0.75)">
                      {curveMode === "price"
                        ? tradingFormat.formatDynamicPrice(tick)
                        : curveMode === "turnover"
                          ? compactRub(tick)
                          : `${tick.toFixed(2)}%`}
                    </text>
                  </g>
                );
              })}
              <path d={chart.path} fill="none" stroke="rgba(129,140,248,0.6)" strokeWidth="2" />
              {chart.tailPath ? <path d={chart.tailPath} fill="none" stroke="rgba(129,140,248,0.55)" strokeWidth="2.2" strokeDasharray="4 4" /> : null}
              {chart.points.map((point) => {
                const isActive = point.ticker === group.activeContractTicker;
                const isNext = point.ticker === group.nextSeriesTicker;
                return (
                  <g key={`${group.familyKey}-point-${point.ticker}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={isActive || isNext ? 5 : 3.6}
                      fill={
                        isActive
                          ? "rgba(16,185,129,1)"
                          : isNext
                            ? "rgba(34,211,238,0.95)"
                            : point.isLiquid
                              ? "rgba(99,102,241,0.95)"
                              : "rgba(148,163,184,0.45)"
                      }
                      stroke="rgba(15,23,42,0.9)"
                      strokeWidth="1.2"
                      onMouseEnter={() => setHoveredPoint(point)}
                      onMouseLeave={() => setHoveredPoint((prev) => (prev?.ticker === point.ticker ? null : prev))}
                    />
                    <text x={point.x} y={chart.height - 8} textAnchor="middle" fontSize="10" fill={isActive ? "rgba(16,185,129,0.95)" : "rgba(148,163,184,0.82)"}>
                      {point.expiryDate ? new Date(point.expiryDate).toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }) : point.ticker}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="rounded-md border border-white/5 bg-black/25 p-2 text-[11px] text-slate-400">
              Недостаточно сопоставимых серий для построения кривой.
            </div>
          )}
          {hoveredPoint ? (
            <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-md border border-white/10 bg-slate-900/95 px-2 py-1.5 text-[10px] text-slate-200 shadow-xl">
              <div className="font-semibold text-white">{hoveredPoint.ticker}</div>
              <div>Экспирация: {hoveredPoint.expiryDate ? new Date(hoveredPoint.expiryDate).toLocaleDateString("ru-RU") : "—"}</div>
              <div>DTE: {hoveredPoint.dte ?? "—"}</div>
              <div>Цена: {tradingFormat.formatDynamicPrice(hoveredPoint.price)}</div>
              <div>Оборот: {compactRub(hoveredPoint.turnover)}</div>
              <div>ОИ: {tradingFormat.formatInteger(hoveredPoint.openInterest)}</div>
              <div>Доля оборота: {`${Math.round(hoveredPoint.turnoverShareWithinGroup * 1000) / 10}%`}</div>
              <div>% к активному: {hoveredPoint.relativePct !== null && isSanePercent(hoveredPoint.relativePct, 40) ? tradingFormat.formatSignedPercent(hoveredPoint.relativePct) : "—"}</div>
            </div>
          ) : null}
        </div>
        {group.anchorContracts.length > 0 ? (
          <div className="mb-2 rounded-md border border-white/5 bg-black/25 px-2 py-1.5 text-[11px] text-slate-400">
            Якорь: {group.anchorContracts.map((item) => `${item.ticker} ${tradingFormat.formatDynamicPrice(item.lastPrice)}`).join(" · ")}
          </div>
        ) : null}
        <div className="space-y-1 text-[11px] text-slate-300">
          <div className="flex items-center justify-between"><span>Ликвидных серий</span><span>{liquidPointsCount}</span></div>
          <div className="flex items-center justify-between"><span>Всего сопоставимых серий</span><span>{fullComparableCurve.length}</span></div>
          <div className="flex items-center justify-between"><span>Следующая серия</span><span>{nextComparable?.ticker ?? group.nextSeriesTicker ?? "—"}</span></div>
          <div className="flex items-center justify-between"><span>Спред к следующей</span><span className="font-mono">{spreadValid ? tradingFormat.formatSignedPercent(group.curve.frontNextSpread) : "—"}</span></div>
          <div className="flex items-center justify-between"><span>Форма кривой</span><span>{curveLabel(group.curve.curveShape)}</span></div>
          <div className="flex items-center justify-between"><span>Фронт % оборота</span><span className="font-mono">{`${Math.round(group.frontTurnoverShare * 100)}%`}</span></div>
          <div className="flex items-center justify-between"><span>Следующая % оборота</span><span className="font-mono">{`${Math.round(nextTurnoverShare * 100)}%`}</span></div>
          <div className="flex items-center justify-between"><span>Статус переката</span><span>{group.rollStatus}</span></div>
        </div>
      </section>
    </div>
  );
}

export function FuturesFamilyTable({ rows }: { rows: ScreenerRow[] }) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  type MainSortKey =
    | "familyLabel"
    | "activeContractTicker"
    | "activePrice"
    | "activePercentChange"
    | "totalTurnover"
    | "totalOpenInterest"
    | "activeRangePct"
    | "curveShape"
    | "frontNextSpread"
    | "rollStatus";
  const [mainSort, setMainSort] = React.useState<{ key: MainSortKey; desc: boolean }>({ key: "totalTurnover", desc: true });

  const groups = React.useMemo(() => {
    const list = buildFuturesFamilies(rows);
    const shapeRank: Record<FuturesFamilyGroup["curve"]["curveShape"], number> = {
      backwardation: 0,
      flat: 1,
      contango: 2,
    };
    list.sort((a, b) => {
      let cmp = 0;
      if (mainSort.key === "familyLabel") cmp = a.familyLabel.localeCompare(b.familyLabel, "ru");
      if (mainSort.key === "activeContractTicker") cmp = a.activeContractTicker.localeCompare(b.activeContractTicker, "ru");
      if (mainSort.key === "activePrice") cmp = (a.activePrice ?? Number.NEGATIVE_INFINITY) - (b.activePrice ?? Number.NEGATIVE_INFINITY);
      if (mainSort.key === "activePercentChange") cmp = (a.activePercentChange ?? Number.NEGATIVE_INFINITY) - (b.activePercentChange ?? Number.NEGATIVE_INFINITY);
      if (mainSort.key === "totalTurnover") cmp = a.totalTurnover - b.totalTurnover;
      if (mainSort.key === "totalOpenInterest") cmp = a.totalOpenInterest - b.totalOpenInterest;
      if (mainSort.key === "activeRangePct") cmp = (a.activeRangePct ?? Number.NEGATIVE_INFINITY) - (b.activeRangePct ?? Number.NEGATIVE_INFINITY);
      if (mainSort.key === "curveShape") cmp = shapeRank[a.curve.curveShape] - shapeRank[b.curve.curveShape];
      if (mainSort.key === "frontNextSpread") cmp = (a.curve.frontNextSpread ?? Number.NEGATIVE_INFINITY) - (b.curve.frontNextSpread ?? Number.NEGATIVE_INFINITY);
      if (mainSort.key === "rollStatus") {
        const rollRank = { Фронт: 0, Слабый: 1, "Идёт": 2, Активный: 3 } as const;
        cmp = rollRank[a.rollStatus] - rollRank[b.rollStatus];
      }
      return mainSort.desc ? -cmp : cmp;
    });
    return list;
  }, [mainSort, rows]);

  function toggleMainSort(key: MainSortKey) {
    setMainSort((prev) => (prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== "familyLabel" && key !== "activeContractTicker" && key !== "curveShape" }));
  }

  function sortMark(key: MainSortKey): string {
    if (mainSort.key !== key) return "•";
    return mainSort.desc ? "▼" : "▲";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/45 px-3 py-2">
        <span className="text-xs font-medium text-slate-300">Группы базовых активов</span>
        <span className="rounded-full border border-white/10 bg-black/35 px-2.5 py-1 font-mono text-[11px] tabular-nums text-slate-300">
          Групп: {groups.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-[linear-gradient(180deg,rgba(2,6,23,0.68),rgba(2,6,23,0.58))] shadow-[0_14px_34px_rgba(2,6,23,0.3)] backdrop-blur-md">
        {groups.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Нет доступных фьючерсов" text="По текущему фильтру ничего не найдено." />
          </div>
        ) : (
          <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/88 backdrop-blur-md">
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-[0.08em] text-slate-400">
                <th className="px-4 py-2.5 text-left font-medium"><button type="button" onClick={() => toggleMainSort("familyLabel")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">База <span className="text-[10px]">{sortMark("familyLabel")}</span></button></th>
                <th className="px-4 py-2.5 text-left font-medium"><button type="button" onClick={() => toggleMainSort("activeContractTicker")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">Активный контракт <span className="text-[10px]">{sortMark("activeContractTicker")}</span></button></th>
                <th className="px-4 py-2.5 text-right font-medium"><button type="button" onClick={() => toggleMainSort("activePrice")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">Цена <span className="text-[10px]">{sortMark("activePrice")}</span></button></th>
                <th className="px-4 py-2.5 text-right font-medium"><button type="button" onClick={() => toggleMainSort("activePercentChange")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">% <span className="text-[10px]">{sortMark("activePercentChange")}</span></button></th>
                <th className="px-4 py-2.5 text-right font-medium"><button type="button" onClick={() => toggleMainSort("totalTurnover")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">Оборот <span className="text-[10px]">{sortMark("totalTurnover")}</span></button></th>
                <th className="px-4 py-2.5 text-right font-medium"><button type="button" onClick={() => toggleMainSort("totalOpenInterest")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">ОИ <span className="text-[10px]">{sortMark("totalOpenInterest")}</span></button></th>
                <th className="px-4 py-2.5 text-right font-medium"><button type="button" onClick={() => toggleMainSort("activeRangePct")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">Диапазон % <span className="text-[10px]">{sortMark("activeRangePct")}</span></button></th>
                <th className="px-4 py-2.5 text-left font-medium"><button type="button" onClick={() => toggleMainSort("curveShape")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">Форма <span className="text-[10px]">{sortMark("curveShape")}</span></button></th>
                <th className="px-4 py-2.5 text-right font-medium"><button type="button" onClick={() => toggleMainSort("frontNextSpread")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">Спред к след. <span className="text-[10px]">{sortMark("frontNextSpread")}</span></button></th>
                <th className="px-4 py-2.5 text-left font-medium"><button type="button" onClick={() => toggleMainSort("rollStatus")} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">Перекат <span className="text-[10px]">{sortMark("rollStatus")}</span></button></th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, index) => {
                const isOpen = Boolean(expanded[group.familyKey]);
                return (
                  <React.Fragment key={group.familyKey}>
                    <tr className={`border-b border-white/5 transition hover:bg-slate-800/40 ${index % 2 === 1 ? "bg-white/[0.02]" : "bg-transparent"}`}>
                      <td className="px-4 py-2.5 text-slate-200">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 text-left"
                          onClick={() => setExpanded((prev) => ({ ...prev, [group.familyKey]: !isOpen }))}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          <span className="font-semibold text-white">{group.familyLabel}</span>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        <div className="leading-tight">
                          <div>{group.activeContractTicker}</div>
                          {group.secondaryOiLineContract ? (
                            <div className="text-[10px] text-slate-500">ОИ-линия: {group.secondaryOiLineContract}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-200">{tradingFormat.formatDynamicPrice(group.activePrice)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${percentClass(group.activePercentChange)}`}>{tradingFormat.formatSignedPercent(group.activePercentChange)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-200">{compactRub(group.totalTurnover)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300">{tradingFormat.formatInteger(group.totalOpenInterest)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300">{tradingFormat.formatSignedPercent(group.activeRangePct)}</td>
                      <td className="px-4 py-2.5 text-slate-300">{curveLabel(group.curve.curveShape)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                        {isSanePercent(group.curve.frontNextSpread, 40) ? tradingFormat.formatSignedPercent(group.curve.frontNextSpread) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${rollClass(group.rollStatus)}`}>{group.rollStatus}</span>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <FamilyExpandedContent group={group} />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
