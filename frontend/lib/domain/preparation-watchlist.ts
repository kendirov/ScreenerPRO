import type { ScreenerRow } from "@screenerpro/shared";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";
import { pickActiveContractForFamily } from "@/lib/domain/currency-correlation";
import { selectInPlayStocks, selectTopFutures } from "@/lib/domain/screener-overview";

export type PreparationInstrumentGroup =
  | "external"
  | "commodities"
  | "currency"
  | "index"
  | "bluechips"
  | "sectors"
  | "inplay";

export type PreparationInstrumentMarket = "moex-stock" | "moex-future" | "global" | "manual";

export type PreparationInstrumentPriority = "core" | "watch" | "optional";

export type PreparationInstrument = {
  id: string;
  symbol: string;
  title: string;
  group: PreparationInstrumentGroup;
  market: PreparationInstrumentMarket;
  moexSecid?: string;
  baseAsset?: string;
  reason: string;
  priority: PreparationInstrumentPriority;
};

export type PreparationCandle = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  turnover?: number | null;
};

export type PreparationCandleSeriesStatus = "ok" | "empty" | "error" | "unavailable";

export type PreparationCandleSeries = {
  secid: string;
  market: PreparationInstrumentMarket;
  status: PreparationCandleSeriesStatus;
  candles: PreparationCandle[];
  error?: string;
};

export type PreparationCandlesResponse = {
  days: number;
  source: "moex" | "unavailable";
  series: PreparationCandleSeries[];
  diagnostics: string[];
};

export type PreparationReasonTag =
  | "inplay"
  | "liquid"
  | "news"
  | "commodity"
  | "currency"
  | "index"
  | "external";

export type InertiaLabel = "may_stay_active" | "passive" | "unknown";

export type PreparationWatchlistTab =
  | "all"
  | "external"
  | "commodities"
  | "currency"
  | "index"
  | "bluechips"
  | "sectors"
  | "inplay";

export type PreparationViewMode = "grid" | "focus" | "list";

export const PREPARATION_WATCHLIST_TAB_LABELS: Record<PreparationWatchlistTab, string> = {
  all: "Все",
  external: "Внешний фон",
  commodities: "Товары",
  currency: "Валюта",
  index: "Индекс",
  bluechips: "Фишки",
  sectors: "Сектора",
  inplay: "В игре",
};

export const PREPARATION_VIEW_MODE_LABELS: Record<PreparationViewMode, string> = {
  grid: "Сетка",
  focus: "Фокус",
  list: "Список",
};

export const PREPARATION_GROUP_LABELS: Record<PreparationInstrumentGroup, string> = {
  external: "Внешний фон",
  commodities: "Товары",
  currency: "Валюта",
  index: "Индекс",
  bluechips: "Голубые фишки",
  sectors: "Сектора",
  inplay: "В игре",
};

export const REASON_TAG_LABELS: Record<PreparationReasonTag, string> = {
  inplay: "в игре",
  liquid: "ликвид",
  news: "новость",
  commodity: "сырьё",
  currency: "валюта",
  index: "индекс",
  external: "внешний",
};

export const INERTIA_LABELS: Record<InertiaLabel, string> = {
  may_stay_active: "может остаться в игре",
  passive: "пассив",
  unknown: "нет оценки",
};

const TAB_TO_GROUP: Partial<Record<PreparationWatchlistTab, PreparationInstrumentGroup>> = {
  external: "external",
  commodities: "commodities",
  currency: "currency",
  index: "index",
  bluechips: "bluechips",
  sectors: "sectors",
  inplay: "inplay",
};

export const DEFAULT_PREPARATION_INSTRUMENTS: PreparationInstrument[] = [
  // Валюта
  {
    id: "cur-cnyrub",
    symbol: "CNYRUB",
    title: "Юань / рубль",
    group: "currency",
    market: "moex-future",
    baseAsset: "CNY",
    reason: "Связка экспортёров и импортёров с валютным рынком.",
    priority: "core",
  },
  {
    id: "cur-si-front",
    symbol: "Si front",
    title: "Si · фронт",
    group: "currency",
    market: "moex-future",
    baseAsset: "SI",
    reason: "Главный FX-якорь для MOEX и экспортёров.",
    priority: "core",
  },
  {
    id: "cur-cny-fut",
    symbol: "CNY futures",
    title: "Фьючерс CNY",
    group: "currency",
    market: "moex-future",
    baseAsset: "CNY",
    reason: "Валютная пара и carry-темы внутри FORTS.",
    priority: "watch",
  },
  {
    id: "cur-usdrubf",
    symbol: "USDRUBF",
    title: "USDRUBF",
    group: "currency",
    market: "moex-future",
    moexSecid: "USDRUBF",
    reason: "Бессрочный USD/RUB — быстрый ориентир по рублю.",
    priority: "watch",
  },
  // Товары
  {
    id: "com-br-front",
    symbol: "BR front",
    title: "Brent · фронт",
    group: "commodities",
    market: "moex-future",
    baseAsset: "BR",
    reason: "Нефтяной импульс для экспортёров и BR.",
    priority: "core",
  },
  {
    id: "com-ng-front",
    symbol: "NG front",
    title: "Газ · фронт",
    group: "commodities",
    market: "moex-future",
    baseAsset: "NG",
    reason: "Сырьевой фон для газовых историй.",
    priority: "watch",
  },
  {
    id: "com-gold",
    symbol: "GOLD",
    title: "Золото · фронт",
    group: "commodities",
    market: "moex-future",
    baseAsset: "GD",
    reason: "Risk-off / сырьевой hedge-тема.",
    priority: "watch",
  },
  {
    id: "com-gldrubf",
    symbol: "GLDRUBF",
    title: "GLDRUBF",
    group: "commodities",
    market: "moex-future",
    moexSecid: "GLDRUBF",
    reason: "Бессрочное золото в рублях.",
    priority: "optional",
  },
  {
    id: "com-silver",
    symbol: "SILV",
    title: "Серебро · фронт",
    group: "commodities",
    market: "moex-future",
    baseAsset: "SV",
    reason: "Волатильное сырьё — вторичный radar.",
    priority: "optional",
  },
  // Индекс
  {
    id: "idx-imoex",
    symbol: "IMOEX",
    title: "IMOEX · фронт",
    group: "index",
    market: "moex-future",
    baseAsset: "MX",
    reason: "Бенчмарк акций MOEX для контекста брифинга.",
    priority: "core",
  },
  // Голубые фишки
  { id: "bc-sber", symbol: "SBER", title: "Сбербанк", group: "bluechips", market: "moex-stock", moexSecid: "SBER", reason: "Ликвидный якорь TQBR.", priority: "core" },
  { id: "bc-gazp", symbol: "GAZP", title: "Газпром", group: "bluechips", market: "moex-stock", moexSecid: "GAZP", reason: "Экспортёр + индексный вес.", priority: "core" },
  { id: "bc-lkoh", symbol: "LKOH", title: "Лукойл", group: "bluechips", market: "moex-stock", moexSecid: "LKOH", reason: "Нефтяной beta для IMOEX.", priority: "core" },
  { id: "bc-vtbr", symbol: "VTBR", title: "ВТБ", group: "bluechips", market: "moex-stock", moexSecid: "VTBR", reason: "Банковский сектор и ставка.", priority: "watch" },
  { id: "bc-rosn", symbol: "ROSN", title: "Роснефть", group: "bluechips", market: "moex-stock", moexSecid: "ROSN", reason: "Нефть + dividend/ state theme.", priority: "watch" },
  { id: "bc-nvtk", symbol: "NVTK", title: "Новатэк", group: "bluechips", market: "moex-stock", moexSecid: "NVTK", reason: "Газ/ LNG экспортёр.", priority: "watch" },
  { id: "bc-ydex", symbol: "YDEX", title: "Яндекс", group: "bluechips", market: "moex-stock", moexSecid: "YDEX", reason: "Tech / growth pulse в индексе.", priority: "watch" },
  // Внешний фон (без API)
  { id: "ext-sp500", symbol: "ES", title: "S&P 500 futures", group: "external", market: "global", reason: "Risk appetite перед открытием MOEX.", priority: "core" },
  { id: "ext-nq", symbol: "NQ", title: "Nasdaq futures", group: "external", market: "global", reason: "Tech-risk и growth tone.", priority: "watch" },
  { id: "ext-dxy", symbol: "DXY", title: "DXY", group: "external", market: "global", reason: "Долларовый индекс — фон для Si.", priority: "core" },
  { id: "ext-brent", symbol: "BZ", title: "Brent", group: "external", market: "global", reason: "Внешняя нефть vs MOEX BR.", priority: "core" },
  { id: "ext-gold", symbol: "XAU", title: "Gold", group: "external", market: "global", reason: "Safe-haven контекст.", priority: "watch" },
];

export type ResolvedPreparationInstrument = PreparationInstrument & {
  resolvedSecid: string | null;
  screenerRow: ScreenerRow | null;
};

function findRow(rows: ScreenerRow[], ticker: string): ScreenerRow | null {
  const key = ticker.trim().toUpperCase();
  return rows.find((row) => row.ticker.toUpperCase() === key) ?? null;
}

function pickFamilyFront(rows: ScreenerRow[], familyKey: string): string | null {
  const families = buildFuturesFamilies(rows);
  const family = families.find((f) => f.familyKey === familyKey);
  return family?.activeContractTicker ?? null;
}

export function resolveInstrumentSecid(
  instrument: PreparationInstrument,
  rows: ScreenerRow[],
): ResolvedPreparationInstrument {
  if (instrument.market === "global" || instrument.market === "manual") {
    return { ...instrument, resolvedSecid: null, screenerRow: null };
  }

  if (instrument.moexSecid) {
    const row = findRow(rows, instrument.moexSecid);
    return {
      ...instrument,
      resolvedSecid: instrument.moexSecid.toUpperCase(),
      screenerRow: row,
    };
  }

  const symbol = instrument.symbol.trim().toLowerCase();

  if (symbol === "si front" || symbol === "si") {
    const active = pickActiveContractForFamily(rows, "SI");
    const secid = active?.status === "найден" ? active.ticker : null;
    return { ...instrument, resolvedSecid: secid, screenerRow: secid ? findRow(rows, secid) : null };
  }

  if (symbol === "cny futures" || symbol === "cnyrub") {
    const active = pickActiveContractForFamily(rows, "CNY");
    const secid = active?.status === "найден" ? active.ticker : null;
    return { ...instrument, resolvedSecid: secid, screenerRow: secid ? findRow(rows, secid) : null };
  }

  if (symbol === "br front") {
    const secid = pickFamilyFront(rows, "brent");
    return { ...instrument, resolvedSecid: secid, screenerRow: secid ? findRow(rows, secid) : null };
  }

  if (symbol === "ng front") {
    const secid = pickFamilyFront(rows, "natural_gas");
    return { ...instrument, resolvedSecid: secid, screenerRow: secid ? findRow(rows, secid) : null };
  }

  if (symbol === "gold") {
    const secid = pickFamilyFront(rows, "gold") ?? findRow(rows, "GLDRUBF")?.ticker ?? null;
    return { ...instrument, resolvedSecid: secid, screenerRow: secid ? findRow(rows, secid) : null };
  }

  if (symbol === "silv") {
    const secid = pickFamilyFront(rows, "silver");
    return { ...instrument, resolvedSecid: secid, screenerRow: secid ? findRow(rows, secid) : null };
  }

  if (symbol === "imoex" || symbol === "imoexf") {
    const secid = pickFamilyFront(rows, "imoex");
    return { ...instrument, resolvedSecid: secid, screenerRow: secid ? findRow(rows, secid) : null };
  }

  const direct = instrument.symbol.toUpperCase();
  const row = findRow(rows, direct);
  return { ...instrument, resolvedSecid: direct, screenerRow: row };
}

export function buildInPlayInstruments(rows: ScreenerRow[], limit = 6): PreparationInstrument[] {
  const stocks = selectInPlayStocks(rows, limit);
  const futures = selectTopFutures(rows, Math.max(2, limit - stocks.length));
  const combined = [...stocks, ...futures].slice(0, limit);

  return combined.map((row) => ({
    id: `inplay-${row.ticker}`,
    symbol: row.ticker,
    title: row.shortName,
    group: "inplay" as const,
    market: row.assetClass === "future" ? ("moex-future" as const) : ("moex-stock" as const),
    moexSecid: row.ticker,
    reason: row.metrics.reasonLabel ?? "In-play по скринеру MOEX.",
    priority: "core" as const,
  }));
}

export function buildPreparationWatchlist(rows: ScreenerRow[] = []): ResolvedPreparationInstrument[] {
  const staticResolved = DEFAULT_PREPARATION_INSTRUMENTS.map((item) => resolveInstrumentSecid(item, rows));
  const inPlay = buildInPlayInstruments(rows).map((item) => resolveInstrumentSecid(item, rows));

  const seen = new Set<string>();
  const merged: ResolvedPreparationInstrument[] = [];

  for (const item of [...staticResolved, ...inPlay]) {
    const key = item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function filterWatchlistByTab(
  items: ResolvedPreparationInstrument[],
  tab: PreparationWatchlistTab,
): ResolvedPreparationInstrument[] {
  if (tab === "all") return items;
  const group = TAB_TO_GROUP[tab];
  if (!group) return items;
  return items.filter((item) => item.group === group);
}

export function resolveReasonTag(instrument: PreparationInstrument, row: ScreenerRow | null): PreparationReasonTag {
  if (instrument.group === "inplay" || row?.metrics.isInPlay) return "inplay";
  if (instrument.group === "commodities") return "commodity";
  if (instrument.group === "currency") return "currency";
  if (instrument.group === "index") return "index";
  if (instrument.group === "external") return "external";
  if (instrument.group === "bluechips" || instrument.group === "sectors") return "liquid";
  return "liquid";
}

export function computeChangePct(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from == null || to == null || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (from === 0 || to === 0) return null;
  const value = ((to - from) / Math.abs(from)) * 100;
  if (!Number.isFinite(value) || Math.abs(value) >= 99.95) return null;
  return value;
}

/** @deprecated Используйте computePreparationChanges из market-data-status */
export function computeChange1d(
  candles: PreparationCandle[],
  liveClose?: number | null,
): number | null {
  if (candles.length < 2) return null;
  const valid = candles.filter(
    (candle) => candle.close != null && Number.isFinite(candle.close) && candle.close !== 0,
  );
  if (valid.length < 2) return null;
  const last = valid[valid.length - 1]!;
  const prev = valid[valid.length - 2]!;
  if (liveClose != null && Number.isFinite(liveClose) && liveClose > 0) {
    return computeChangePct(prev.close, liveClose);
  }
  return computeChangePct(prev.close, last.close);
}

/** @deprecated Используйте computePreparationChanges из market-data-status */
export function computeChange5d(candles: PreparationCandle[]): number | null {
  const valid = candles.filter(
    (candle) => candle.close != null && Number.isFinite(candle.close) && candle.close !== 0,
  );
  if (valid.length < 5) return null;
  const anchor = valid[valid.length - 5]!;
  const last = valid[valid.length - 1]!;
  return computeChangePct(anchor.close, last.close);
}

function barRangePct(bar: PreparationCandle): number | null {
  if (bar.close == null || bar.high == null || bar.low == null || bar.close === 0) return null;
  return ((bar.high - bar.low) / Math.abs(bar.close)) * 100;
}

export function computeInertia(
  candles: PreparationCandle[],
  live?: {
    dayRangePct?: number | null;
    turnover?: number | null;
    isInPlay?: boolean;
  },
): { label: InertiaLabel; text: string } {
  if (candles.length < 2) {
    return { label: "unknown", text: INERTIA_LABELS.unknown };
  }

  const change5d = computeChange5d(candles);
  const last = candles[candles.length - 1]!;
  const prev = candles[candles.length - 2]!;
  const lastRange = barRangePct(last) ?? live?.dayRangePct ?? null;
  const prevRange = barRangePct(prev);
  const avgRange =
    candles
      .map(barRangePct)
      .filter((v): v is number => v != null)
      .reduce((acc, v, _, arr) => acc + v / arr.length, 0) || null;

  const moved5d = change5d != null && Math.abs(change5d) >= 1;
  const elevatedYesterday =
    prevRange != null && avgRange != null ? prevRange >= avgRange * 1.15 : false;
  const elevatedToday =
    lastRange != null && avgRange != null ? lastRange >= avgRange * 1.15 : false;
  const inPlay = live?.isInPlay === true;

  if (moved5d && (elevatedYesterday || elevatedToday || inPlay)) {
    return { label: "may_stay_active", text: INERTIA_LABELS.may_stay_active };
  }

  if (change5d != null && Math.abs(change5d) < 0.5 && !inPlay) {
    return { label: "passive", text: INERTIA_LABELS.passive };
  }

  if (moved5d || inPlay) {
    return { label: "may_stay_active", text: INERTIA_LABELS.may_stay_active };
  }

  return { label: "passive", text: INERTIA_LABELS.passive };
}

export function buildCandlesQueryItems(items: ResolvedPreparationInstrument[]): string[] {
  return items
    .filter((item) => item.market === "moex-stock" || item.market === "moex-future")
    .filter((item) => item.resolvedSecid)
    .map((item) => `${item.resolvedSecid}:${item.market}`);
}

export function findCandleSeries(
  series: PreparationCandleSeries[],
  instrument: ResolvedPreparationInstrument,
): PreparationCandleSeries | null {
  if (!instrument.resolvedSecid) return null;
  return (
    series.find(
      (s) =>
        s.secid.toUpperCase() === instrument.resolvedSecid!.toUpperCase() &&
        s.market === instrument.market,
    ) ?? null
  );
}
