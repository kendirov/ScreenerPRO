"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SectorKDataError, SectorKLoading, SectorKSource } from "@/components/sector-k/sector-k-data-state";
import { TradingFuturesChart } from "@/components/trading/trading-futures-chart";
import {
  buildFuturesFamilies,
  type FuturesContractInFamily,
  type FuturesFamilyGroup,
  type FuturesMarketSegment,
} from "@/lib/domain/futures-family";
import type { StockExpandedChartInterval } from "@/lib/domain/stock-expanded-chart";
import { futuresActivityTone, type FuturesActivityResponse, type FuturesActivitySeries } from "@/lib/domain/trading-futures";
import { useScreenerQuery } from "@/lib/hooks/use-screener-query";
import {
  formatSectorKMagnitudePercent,
  formatSectorKPercent,
  formatSectorKPrice,
  formatSectorKTurnover,
} from "@/lib/sector-k/market";

type FocusMode = "turnover" | "trades" | "range" | "relative";
type FuturesSortKey = "change" | "turnover" | "relative" | "trades" | "range" | "openInterest";
type FuturesSort = { key: FuturesSortKey; direction: "asc" | "desc" };

const SEGMENTS: Array<"Все" | FuturesMarketSegment> = ["Все", "Индексы", "Валюта", "Акции", "Энергия", "Металлы", "Сырьё", "Другое"];

function formatTrades(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

function changeClass(value: number | null): string {
  if ((value ?? 0) > 0) return "sk-change--positive";
  if ((value ?? 0) < 0) return "sk-change--negative";
  return "";
}

function formatExpiry(contract: FuturesContractInFamily): string {
  if (contract.contractKind === "perpetual") return "бессрочный";
  if (!contract.expiryDate) return "экспирация —";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(contract.expiryDate));
}

function kindLabel(contract: FuturesContractInFamily): string {
  if (contract.contractKind === "perpetual") return "вечный";
  if (contract.contractKind === "mini") return "мини";
  return contract.dte == null ? "серия" : `${contract.dte} дн.`;
}

async function fetchActivity(secids: string[]): Promise<FuturesActivityResponse> {
  const params = new URLSearchParams({ secids: secids.join(",") });
  const response = await fetch(`/api/trading/futures/activity?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as FuturesActivityResponse;
}

function rankFamilies(
  families: FuturesFamilyGroup[],
  mode: FocusMode,
  activity: Map<string, FuturesActivitySeries>,
): FuturesFamilyGroup[] {
  return [...families].sort((left, right) => {
    if (mode === "trades") return right.totalTrades - left.totalTrades;
    if (mode === "range") return Math.abs(right.activeRangePct ?? 0) - Math.abs(left.activeRangePct ?? 0);
    if (mode === "relative") {
      const leftRatio = activity.get(left.activeContractTicker.toUpperCase())?.sameTimeVolumeRatio;
      const rightRatio = activity.get(right.activeContractTicker.toUpperCase())?.sameTimeVolumeRatio;
      if (leftRatio == null && rightRatio == null) return right.totalTurnover - left.totalTurnover;
      if (leftRatio == null) return 1;
      if (rightRatio == null) return -1;
      return rightRatio - leftRatio;
    }
    return right.totalTurnover - left.totalTurnover;
  });
}

function sortValue(family: FuturesFamilyGroup, key: FuturesSortKey, activity: Map<string, FuturesActivitySeries>): number | null {
  if (key === "change") return family.activePercentChange;
  if (key === "turnover") return family.totalTurnover;
  if (key === "relative") return activity.get(family.activeContractTicker.toUpperCase())?.sameTimeVolumeRatio ?? null;
  if (key === "trades") return family.totalTrades;
  if (key === "range") return family.activeRangePct;
  return family.totalOpenInterest;
}

function sortTable(families: FuturesFamilyGroup[], sort: FuturesSort, activity: Map<string, FuturesActivitySeries>): FuturesFamilyGroup[] {
  return [...families].sort((left, right) => {
    const leftValue = sortValue(left, sort.key, activity);
    const rightValue = sortValue(right, sort.key, activity);
    if (leftValue == null && rightValue == null) return left.familyLabel.localeCompare(right.familyLabel, "ru");
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    return sort.direction === "desc" ? rightValue - leftValue : leftValue - rightValue;
  });
}

export function TradingFutures() {
  const query = useScreenerQuery("future");
  const families = useMemo(() => buildFuturesFamilies(query.data?.rows ?? []), [query.data?.rows]);
  const activitySecids = useMemo(() => [...families].sort((left, right) => right.totalTurnover - left.totalTurnover).slice(0, 12).map((family) => family.activeContractTicker), [families]);
  const activityQuery = useQuery({
    queryKey: ["trading-futures-activity", ...activitySecids] as const,
    queryFn: () => fetchActivity(activitySecids),
    enabled: activitySecids.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const activity = useMemo(
    () => new Map((activityQuery.data?.series ?? []).map((series) => [series.secid.toUpperCase(), series])),
    [activityQuery.data?.series],
  );
  const [focusMode, setFocusMode] = useState<FocusMode>("turnover");
  const [segment, setSegment] = useState<"Все" | FuturesMarketSegment>("Все");
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [sort, setSort] = useState<FuturesSort>({ key: "turnover", direction: "desc" });
  const [selectedFamilyKey, setSelectedFamilyKey] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [chartInterval, setChartInterval] = useState<StockExpandedChartInterval>(5);

  const focusFamilies = useMemo(() => rankFamilies(families.filter((family) => family.totalTurnover > 0), focusMode, activity).slice(0, 8), [activity, families, focusMode]);
  const liquidity = useMemo(() => [...families].filter((family) => family.totalTurnover > 0).sort((left, right) => right.totalTurnover - left.totalTurnover).slice(0, 6), [families]);
  const volatility = useMemo(() => [...families].filter((family) => family.totalTurnover >= 5_000_000).sort((left, right) => Math.abs(right.activeRangePct ?? 0) - Math.abs(left.activeRangePct ?? 0)).slice(0, 6), [families]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = families.filter((family) => {
      if (segment !== "Все" && family.segment !== segment) return false;
      if (hideEmpty && family.totalTurnover <= 0 && family.totalTrades <= 0) return false;
      if (!needle) return true;
      return `${family.familyLabel} ${family.contracts.map((contract) => `${contract.ticker} ${contract.shortName}`).join(" ")}`.toLowerCase().includes(needle);
    });
    return sortTable(filtered, sort, activity);
  }, [activity, families, hideEmpty, search, segment, sort]);

  const selectedFamily = families.find((family) => family.familyKey === selectedFamilyKey) ?? focusFamilies[0] ?? families[0] ?? null;
  const selectedContract = selectedFamily?.contracts.find((contract) => contract.ticker === selectedTicker)
    ?? selectedFamily?.contracts.find((contract) => contract.ticker === selectedFamily.activeContractTicker)
    ?? selectedFamily?.contracts[0]
    ?? null;

  const totalTurnover = families.reduce((sum, family) => sum + family.totalTurnover, 0);
  const totalTrades = families.reduce((sum, family) => sum + family.totalTrades, 0);
  const rising = families.filter((family) => (family.activePercentChange ?? 0) > 0).length;
  const falling = families.filter((family) => (family.activePercentChange ?? 0) < 0).length;
  const error = query.error instanceof Error ? query.error : null;

  function chooseFamily(family: FuturesFamilyGroup, scroll = false) {
    setSelectedFamilyKey(family.familyKey);
    setSelectedTicker(family.activeContractTicker);
    setChartInterval(5);
    if (scroll) window.requestAnimationFrame(() => document.getElementById("tr-futures-detail")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function setSortKey(key: FuturesSortKey) {
    setSort((current) => current.key === key ? { key, direction: current.direction === "desc" ? "asc" : "desc" } : { key, direction: "desc" });
  }

  return (
    <div className="sk-page tr-futures-page">
      <h1 className="sk-sr-only">Фьючерсы</h1>

      <section className="tr-futures-market">
        <div className="tr-futures-market__title">
          <span className="tr-label">MOEX · срочный рынок</span>
          <strong>Где сейчас деньги и движение</strong>
          <SectorKSource status={query.data?.status} error={error} />
        </div>
        <FutureMarketFact label="Оборот" value={formatSectorKTurnover(totalTurnover)} />
        <FutureMarketFact label="Сделки" value={formatTrades(totalTrades)} />
        <FutureMarketFact label="Семейства" value={String(families.length || "—")} note={`${query.data?.rows.length ?? 0} контрактов`} />
        <FutureMarketFact label="Ширина" value={`${rising} ↑  ${falling} ↓`} tone="split" />
      </section>

      {error ? <SectorKDataError error={error} /> : null}
      {query.isPending && !query.data ? <SectorKLoading label="Получаем фьючерсы MOEX…" /> : null}

      <section className="tr-futures-focus">
        <header>
          <div><span className="tr-label">Главный фокус</span><h2>Семейства в работе</h2></div>
          <div role="group" aria-label="Ранжирование фьючерсов">
            {([ ["turnover", "Оборот"], ["trades", "Сделки"], ["range", "Диапазон"], ["relative", "Объём ×"] ] as Array<[FocusMode, string]>).map(([value, label]) => (
              <button className={focusMode === value ? "is-active" : undefined} type="button" key={value} onClick={() => setFocusMode(value)}>{label}</button>
            ))}
          </div>
        </header>
        <div className="tr-futures-focus__grid">
          {focusFamilies.map((family) => <FuturesFamilyCard family={family} activity={activity.get(family.activeContractTicker.toUpperCase())} selected={selectedFamily?.familyKey === family.familyKey} onClick={() => chooseFamily(family, true)} key={family.familyKey} />)}
        </div>
      </section>

      <aside className="tr-futures-rails" aria-label="Ликвидность и волатильность фьючерсов">
        <FuturesRail title="Ликвидность" note="по обороту семейства" families={liquidity} kind="liquidity" onSelect={(family) => chooseFamily(family, true)} />
        <FuturesRail title="Волатильность" note="диапазон при обороте от 5 млн" families={volatility} kind="volatility" onSelect={(family) => chooseFamily(family, true)} />
      </aside>

      {selectedFamily && selectedContract ? (
        <section className="tr-futures-detail" id="tr-futures-detail">
          <TradingFuturesChart secid={selectedContract.ticker} interval={chartInterval} onIntervalChange={setChartInterval} />
          <div className="tr-futures-contracts">
            <header>
              <div><span className="tr-label">{selectedFamily.segment}</span><h2>{selectedFamily.familyLabel}</h2></div>
              <span className="sk-mono">{selectedFamily.contracts.length} контр.</span>
            </header>
            <div className="tr-futures-contracts__list">
              {[...selectedFamily.contracts].sort((left, right) => right.turnover - left.turnover).map((contract) => (
                <button className={selectedContract.ticker === contract.ticker ? "is-active" : undefined} type="button" key={contract.ticker} onClick={() => { setSelectedTicker(contract.ticker); setChartInterval(5); }}>
                  <span><strong className="sk-mono">{contract.ticker}</strong><small>{contract.shortName}</small></span>
                  <span><b>{kindLabel(contract)}</b><small>{formatExpiry(contract)}</small></span>
                  <span><b className="sk-mono">{formatSectorKTurnover(contract.turnover)}</b><small>{formatTrades(contract.tradesCount)} сделок</small></span>
                </button>
              ))}
            </div>
            <footer>Ведущий контракт выбирается по фактическому обороту. Базис скрыт до синхронной spot-цены.</footer>
          </div>
        </section>
      ) : null}

      <section className="sk-panel tr-futures-screener">
        <div className="tr-futures-table-head">
          <div><span className="tr-label">Скринер фьючерсов</span><strong>По базовым активам</strong><span className="sk-mono">{visible.length} из {families.length}</span></div>
          <div>
            <label><input type="checkbox" checked={hideEmpty} onChange={(event) => setHideEmpty(event.target.checked)} />Скрыть пустые</label>
            <label className="sk-search"><Search size={14} aria-hidden /><input name="futures-search" autoComplete="off" className="sk-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Актив или контракт…" /></label>
          </div>
        </div>
        <div className="tr-futures-segments" role="group" aria-label="Класс базового актива">
          {SEGMENTS.map((item) => <button className={segment === item ? "is-active" : undefined} type="button" key={item} onClick={() => setSegment(item)}>{item}</button>)}
        </div>
        <div className="sk-table-wrap tr-table-wrap">
          <table className="sk-table tr-futures-table">
            <thead><tr>
              <th>Базовый актив / лидер</th><th>Контракты</th>
              <FuturesSortableHeader label="%" sortKey="change" state={sort} onSort={setSortKey} />
              <FuturesSortableHeader label="Оборот" sortKey="turnover" state={sort} onSort={setSortKey} />
              <FuturesSortableHeader label="Объём ×" sortKey="relative" state={sort} onSort={setSortKey} />
              <FuturesSortableHeader label="Сделки" sortKey="trades" state={sort} onSort={setSortKey} />
              <FuturesSortableHeader label="Диапазон" sortKey="range" state={sort} onSort={setSortKey} />
              <FuturesSortableHeader label="ОИ" sortKey="openInterest" state={sort} onSort={setSortKey} />
              <th>Экспирация / роль</th>
            </tr></thead>
            <tbody>{visible.map((family) => {
              const activeContract = family.contracts.find((contract) => contract.ticker === family.activeContractTicker) ?? family.contracts[0];
              const context = activity.get(family.activeContractTicker.toUpperCase());
              return (
                <tr className={selectedFamily?.familyKey === family.familyKey ? "is-selected" : undefined} key={family.familyKey} onClick={() => chooseFamily(family, true)}>
                  <td><span className="sk-ticker"><strong>{family.familyLabel}</strong><small>{family.segment} · <b className="sk-mono">{family.activeContractTicker}</b> · {formatSectorKPrice(family.activePrice)}</small></span></td>
                  <td><div className="tr-contract-badges">{family.contracts.slice(0, 4).map((contract) => <i key={contract.ticker}>{contract.ticker}</i>)}{family.contracts.length > 4 ? <i>+{family.contracts.length - 4}</i> : null}</div></td>
                  <td className={`sk-mono ${changeClass(family.activePercentChange)}`}>{formatSectorKPercent(family.activePercentChange)}</td>
                  <td className="sk-mono">{formatSectorKTurnover(family.totalTurnover)}</td>
                  <td><ActivityRatio context={context} /></td>
                  <td className="sk-mono">{formatTrades(family.totalTrades)}</td>
                  <td className="sk-mono">{formatSectorKMagnitudePercent(family.activeRangePct)}</td>
                  <td className="sk-mono">{Math.round(family.totalOpenInterest).toLocaleString("ru-RU")}</td>
                  <td>{activeContract ? <span className="tr-contract-role"><b>{kindLabel(activeContract)}</b><small>{formatExpiry(activeContract)}</small></span> : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <footer className="sk-table-meta"><span>MOEX ISS · точные SECID и ASSETCODE</span><span>Базис и FUTOI не имитируются</span></footer>
      </section>
    </div>
  );
}

function FutureMarketFact({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "split" }) {
  return <div className={`tr-futures-market__fact ${tone ? `is-${tone}` : ""}`}><span className="tr-label">{label}</span><strong className="sk-mono">{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

function FuturesFamilyCard({ family, activity, selected, onClick }: { family: FuturesFamilyGroup; activity?: FuturesActivitySeries; selected: boolean; onClick: () => void }) {
  return (
    <button className={`tr-futures-family-card ${selected ? "is-selected" : ""}`} type="button" onClick={onClick}>
      <span className="tr-futures-family-card__identity"><small>{family.segment}</small><strong>{family.familyLabel}</strong><b className="sk-mono">{family.activeContractTicker}</b></span>
      <FuturesActivitySparkline context={activity} />
      <span className="tr-futures-family-card__facts">
        <i><small>Оборот</small><b className="sk-mono">{formatSectorKTurnover(family.totalTurnover)}</b></i>
        <i><small>Сделки</small><b className="sk-mono">{formatTrades(family.totalTrades)}</b></i>
        <i><small>Диапазон</small><b className="sk-mono">{formatSectorKMagnitudePercent(family.activeRangePct)}</b></i>
        <i><small>Объём ×</small><ActivityRatio context={activity} compact /></i>
      </span>
      <span className="tr-contract-badges">{family.contracts.slice(0, 3).map((contract) => <i key={contract.ticker}>{contract.ticker}</i>)}{family.contracts.length > 3 ? <i>+{family.contracts.length - 3}</i> : null}</span>
    </button>
  );
}

function FuturesActivitySparkline({ context }: { context?: FuturesActivitySeries }) {
  const points = context?.currentPath ?? [];
  if (points.length < 2) return <span className="tr-futures-sparkline is-empty">10м —</span>;
  const low = Math.min(...points.map((point) => point.value));
  const high = Math.max(...points.map((point) => point.value));
  const span = high - low || 1;
  const path = points.map((point, index) => {
    const x = 2 + (index / Math.max(1, points.length - 1)) * 116;
    const y = 30 - ((point.value - low) / span) * 26;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <span className="tr-futures-sparkline"><small>{context?.usedInterval}м · сегодня</small><svg viewBox="0 0 120 34" preserveAspectRatio="none"><line x1="0" x2="120" y1="17" y2="17" /><path d={path} /></svg></span>;
}

function ActivityRatio({ context, compact = false }: { context?: FuturesActivitySeries; compact?: boolean }) {
  const ratio = context?.sameTimeVolumeRatio ?? null;
  const tone = futuresActivityTone(ratio);
  const title = ratio == null
    ? "Same-time база недоступна: нужно минимум три прошлые сессии"
    : `Объём контрактов к ${context?.timeMsk ?? "этому времени"} против ${context?.baselineSessions ?? 0} прошлых сессий`;
  return <span className={`tr-futures-ratio is-${tone} ${compact ? "is-compact" : ""}`} title={title}>{ratio == null ? "—" : `${ratio.toFixed(1)}×`}</span>;
}

function FuturesRail({ title, note, families, kind, onSelect }: { title: string; note: string; families: FuturesFamilyGroup[]; kind: "liquidity" | "volatility"; onSelect: (family: FuturesFamilyGroup) => void }) {
  return (
    <section className={`tr-futures-rail is-${kind}`}>
      <header><div><span className="tr-label">{note}</span><h3>{title}</h3></div><b className="sk-mono">{families.length}</b></header>
      <div>{families.map((family, index) => (
        <button type="button" key={family.familyKey} onClick={() => onSelect(family)}>
          <i className="sk-mono">{String(index + 1).padStart(2, "0")}</i>
          <span><strong>{family.familyLabel}</strong><small className="sk-mono">{family.activeContractTicker}</small></span>
          <span><b className="sk-mono">{kind === "liquidity" ? formatSectorKTurnover(family.totalTurnover) : formatSectorKMagnitudePercent(family.activeRangePct)}</b><small>{kind === "liquidity" ? `${formatTrades(family.totalTrades)} сделок` : `${formatSectorKPercent(family.activePercentChange)} · ${formatSectorKTurnover(family.totalTurnover)}`}</small></span>
        </button>
      ))}</div>
    </section>
  );
}

function FuturesSortableHeader({ label, sortKey, state, onSort }: { label: string; sortKey: FuturesSortKey; state: FuturesSort; onSort: (key: FuturesSortKey) => void }) {
  const active = state.key === sortKey;
  const Icon = !active ? ArrowUpDown : state.direction === "desc" ? ArrowDown : ArrowUp;
  return <th aria-sort={active ? state.direction === "desc" ? "descending" : "ascending" : "none"}><button className={`sk-sort-button ${active ? "is-active" : ""}`} type="button" onClick={() => onSort(sortKey)}><span>{label}</span><Icon size={12} aria-hidden /></button></th>;
}
