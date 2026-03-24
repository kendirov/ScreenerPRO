import type { ScreenerRow } from "@screenerpro/shared";

export type StocksMode = "sectors" | "capitalization" | "indices" | "drivers";

export type StocksGroupDef = {
  id: string;
  mode: StocksMode;
  title: string;
  description: string;
  tickers: string[];
  driverLabel?: string;
};

export type StocksGroupMetrics = {
  turnover: number;
  trades: number;
  up: number;
  down: number;
  neutral: number;
  active: number;
  medianMove: number | null;
  avgMove: number | null;
  breadthScore: number | null;
  participationPct: number | null; // active names inside group
  moneyConcentrationPct: number | null; // top-2 inside group
  indexConcentrationPct: number | null; // top-3 inside group
  marketTurnoverSharePct: number | null; // group vs full stock universe
  marketTradesSharePct: number | null; // group vs full stock universe
  marketContributionPct: number | null; // proxy contribution to market move
  indexContributionPct: number | null; // proxy contribution to index move
  sessionMoveVsOpenPct: number | null; // group median move from session baseline
  regime: "trend-up" | "trend-down" | "broad" | "narrow" | "rotation" | "inactive";
  leaders: ScreenerRow[];
  laggards: ScreenerRow[];
  topTurnover: ScreenerRow[];
  members: ScreenerRow[];
};

export type StocksGroupView = StocksGroupDef & StocksGroupMetrics;

export type StocksMetricRelativeTo = "market" | "mode" | "group" | "session";

export type StocksModeKpi = {
  id: string;
  label: string;
  value: number | null;
  relativeTo: StocksMetricRelativeTo;
  format: "percent" | "money" | "integer" | "breadth";
};

export type StocksModeViewModel = {
  mode: StocksMode;
  modeLabel: string;
  groups: StocksGroupView[];
  kpis: StocksModeKpi[];
};

type MarketBaseline = {
  totalTurnover: number;
  totalTrades: number;
  totalAbsMoveWeighted: number;
  indexCoreTurnover: number;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function getStocksModeLabel(mode: StocksMode): string {
  if (mode === "sectors") return "Сектора";
  if (mode === "capitalization") return "Капитализация";
  if (mode === "indices") return "Индексы";
  return "Поводыри";
}

function computeMarketBaseline(rows: ScreenerRow[]): MarketBaseline {
  const stocks = rows.filter((row) => row.assetClass === "stock");
  const totalTurnover = stocks.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  const totalTrades = stocks.reduce((acc, row) => acc + (row.tradesCount ?? 0), 0);
  const totalAbsMoveWeighted = stocks.reduce((acc, row) => acc + Math.abs(row.percentChange ?? 0) * (row.turnover ?? 0), 0);
  const indexCoreTickers = new Set(STOCKS_MODE_GROUPS.indices.find((group) => group.id === "imoex-core")?.tickers ?? []);
  const indexCoreTurnover = stocks
    .filter((row) => indexCoreTickers.has(row.ticker))
    .reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  return { totalTurnover, totalTrades, totalAbsMoveWeighted, indexCoreTurnover };
}

export function computeGroupView(group: StocksGroupDef, rows: ScreenerRow[], baseline?: MarketBaseline): StocksGroupView {
  const stocks = rows.filter((row) => row.assetClass === "stock");
  const market = baseline ?? computeMarketBaseline(stocks);
  const scoped = stocks.filter((row) => group.tickers.includes(row.ticker));
  const turnover = scoped.reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  const trades = scoped.reduce((acc, row) => acc + (row.tradesCount ?? 0), 0);
  const up = scoped.filter((row) => (row.percentChange ?? 0) > 0).length;
  const down = scoped.filter((row) => (row.percentChange ?? 0) < 0).length;
  const neutral = Math.max(0, scoped.length - up - down);
  const moves = scoped.map((row) => row.percentChange).filter((v): v is number => v !== null);
  const medianMove = median(moves);
  const avgMove = average(moves);
  const leaders = [...scoped]
    .filter((row) => row.percentChange !== null)
    .sort((a, b) => (b.percentChange ?? 0) - (a.percentChange ?? 0))
    .slice(0, 3);
  const laggards = [...scoped]
    .filter((row) => row.percentChange !== null)
    .sort((a, b) => (a.percentChange ?? 0) - (b.percentChange ?? 0))
    .slice(0, 3);
  const topTurnover = [...scoped].sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 3);
  const breadthScore = scoped.length > 0 ? (up - down) / scoped.length : null;
  const activeMembers = scoped.filter((row) => (row.turnover ?? 0) > 0).length;
  const participationPct = scoped.length > 0 ? activeMembers / scoped.length : null;
  const top2Turnover = [...scoped]
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, 2)
    .reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  const top3Turnover = [...scoped]
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, 3)
    .reduce((acc, row) => acc + (row.turnover ?? 0), 0);
  const moneyConcentrationPct = turnover > 0 ? top2Turnover / turnover : null;
  const indexConcentrationPct = turnover > 0 ? top3Turnover / turnover : null;
  const weightedMove = scoped.reduce((acc, row) => acc + (row.percentChange ?? 0) * (row.turnover ?? 0), 0);
  const sessionMoveVsOpenPct = turnover > 0 ? weightedMove / turnover : null;
  const marketTurnoverSharePct = market.totalTurnover > 0 ? turnover / market.totalTurnover : null;
  const marketTradesSharePct = market.totalTrades > 0 ? trades / market.totalTrades : null;
  const marketContributionPct = market.totalAbsMoveWeighted > 0 ? Math.abs(weightedMove) / market.totalAbsMoveWeighted : null;
  const indexContributionPct = market.indexCoreTurnover > 0 ? turnover / market.indexCoreTurnover : null;
  const regime = deriveRegime({ up, down, neutral, breadthScore, moneyConcentrationPct });
  return {
    ...group,
    turnover,
    trades,
    up,
    down,
    neutral,
    active: activeMembers,
    medianMove,
    avgMove,
    breadthScore,
    participationPct,
    moneyConcentrationPct,
    indexConcentrationPct,
    marketTurnoverSharePct,
    marketTradesSharePct,
    marketContributionPct,
    indexContributionPct,
    sessionMoveVsOpenPct,
    regime,
    leaders,
    laggards,
    topTurnover,
    members: scoped,
  };
}

function buildModeKpis(mode: StocksMode, groups: StocksGroupView[]): StocksModeKpi[] {
  const sortedByTurnover = [...groups].sort((a, b) => b.turnover - a.turnover);
  const top = sortedByTurnover[0] ?? null;
  const modeTurnover = groups.reduce((acc, group) => acc + group.turnover, 0);
  const modeTrades = groups.reduce((acc, group) => acc + group.trades, 0);
  const modeTop3Turnover = [...sortedByTurnover]
    .slice(0, 3)
    .reduce((acc, group) => acc + group.turnover, 0);
  const modeTop3Share = modeTurnover > 0 ? modeTop3Turnover / modeTurnover : null;

  if (mode === "indices") {
    return [
      { id: "index-top-turnover-share", label: "Доля рынка по обороту, %", value: top?.marketTurnoverSharePct ?? null, relativeTo: "market", format: "percent" },
      { id: "index-top-contribution", label: "Вклад в индекс, %", value: top?.indexContributionPct ?? null, relativeTo: "market", format: "percent" },
      { id: "index-top-3", label: "Доля топ-3, %", value: modeTop3Share, relativeTo: "mode", format: "percent" },
      { id: "index-breadth", label: "Ширина: растут / нейтральны / падают", value: null, relativeTo: "mode", format: "breadth" },
    ];
  }

  if (mode === "drivers") {
    const strongest = [...groups].sort((a, b) => (b.marketContributionPct ?? 0) - (a.marketContributionPct ?? 0))[0] ?? null;
    return [
      { id: "drivers-strongest", label: "Вклад в рынок, %", value: strongest?.marketContributionPct ?? null, relativeTo: "market", format: "percent" },
      { id: "drivers-turnover-share", label: "Доля рынка по обороту, %", value: strongest?.marketTurnoverSharePct ?? null, relativeTo: "market", format: "percent" },
      { id: "drivers-mode-top3", label: "Доля топ-3, %", value: modeTop3Share, relativeTo: "mode", format: "percent" },
      { id: "drivers-concentration", label: "Концентрация оборота, %", value: top?.moneyConcentrationPct ?? null, relativeTo: "group", format: "percent" },
    ];
  }

  if (mode === "capitalization") {
    return [
      { id: "cap-turnover-share", label: "Доля рынка по обороту, %", value: top?.marketTurnoverSharePct ?? null, relativeTo: "market", format: "percent" },
      { id: "cap-trades-share", label: "Доля рынка по сделкам, %", value: top?.marketTradesSharePct ?? null, relativeTo: "market", format: "percent" },
      { id: "cap-top3", label: "Доля топ-3, %", value: modeTop3Share, relativeTo: "mode", format: "percent" },
      { id: "cap-concentration", label: "Концентрация оборота, %", value: top?.indexConcentrationPct ?? null, relativeTo: "group", format: "percent" },
    ];
  }

  return [
    { id: "sec-turnover-share", label: "Доля рынка по обороту, %", value: top?.marketTurnoverSharePct ?? null, relativeTo: "market", format: "percent" },
    { id: "sec-trades-share", label: "Доля рынка по сделкам, %", value: top?.marketTradesSharePct ?? null, relativeTo: "market", format: "percent" },
    { id: "sec-top3", label: "Доля топ-3, %", value: modeTop3Share, relativeTo: "mode", format: "percent" },
    { id: "sec-total-trades", label: "Сделки в режиме, шт", value: modeTrades, relativeTo: "mode", format: "integer" },
  ];
}

export function buildStocksModeView(mode: StocksMode, rows: ScreenerRow[], selectedDriver: string | null): StocksModeViewModel {
  const baseline = computeMarketBaseline(rows);
  const defs = STOCKS_MODE_GROUPS[mode];
  const rawGroups = defs.map((group) => computeGroupView(group, rows, baseline));
  const groups = mode === "drivers" && selectedDriver ? rawGroups.filter((group) => group.id === selectedDriver) : rawGroups;
  const ordered = [...groups].sort((a, b) => b.turnover - a.turnover);
  return {
    mode,
    modeLabel: getStocksModeLabel(mode),
    groups: ordered,
    kpis: buildModeKpis(mode, ordered),
  };
}

function deriveRegime(input: {
  up: number;
  down: number;
  neutral: number;
  breadthScore: number | null;
  moneyConcentrationPct: number | null;
}): StocksGroupMetrics["regime"] {
  if (input.up + input.down + input.neutral === 0) return "inactive";
  if ((input.breadthScore ?? 0) > 0.45 && (input.moneyConcentrationPct ?? 0) < 0.55) return "broad";
  if ((input.breadthScore ?? 0) < -0.45 && (input.moneyConcentrationPct ?? 0) < 0.55) return "broad";
  if ((input.breadthScore ?? 0) > 0.3) return "trend-up";
  if ((input.breadthScore ?? 0) < -0.3) return "trend-down";
  if ((input.moneyConcentrationPct ?? 0) >= 0.65) return "narrow";
  return "rotation";
}

export const STOCKS_MODE_GROUPS: Record<StocksMode, StocksGroupDef[]> = {
  sectors: [
    { id: "oil-gas", mode: "sectors", title: "Нефтегаз", description: "Секторный блок MOEX: нефть, газ и экспортный поток.", tickers: ["LKOH", "ROSN", "TATN", "SIBN", "GAZP", "NVTK"] },
    { id: "metals-mining", mode: "sectors", title: "Металлы и добыча", description: "Черные/цветные металлы и золотодобыча.", tickers: ["GMKN", "RUAL", "NLMK", "MAGN", "CHMF", "PLZL"] },
    { id: "finance", mode: "sectors", title: "Финансы", description: "Банки, брокерская инфраструктура и биржа.", tickers: ["SBER", "VTBR", "T", "MOEX"] },
    { id: "consumer-tech", mode: "sectors", title: "Потребительский/тех", description: "Ритейл, e-com и связь как прокси внутреннего спроса.", tickers: ["MGNT", "MTSS", "YDEX", "AFKS"] },
  ],
  capitalization: [
    { id: "bluechips", mode: "capitalization", title: "Blue chips", description: "Официальный ликвидный core MOEX.", tickers: ["SBER", "GAZP", "LKOH", "NVTK", "ROSN", "GMKN", "TATN", "MGNT"] },
    { id: "imoex-core", mode: "capitalization", title: "Ядро IMOEX", description: "Тяжеловесы, формирующие индексный импульс.", tickers: ["SBER", "GAZP", "LKOH", "NVTK", "ROSN", "YDEX", "T", "MOEX"] },
    { id: "mid-small", mode: "capitalization", title: "Mid/Small cap", description: "Средняя и малая капитализация с более узкой ликвидностью.", tickers: ["AFKS", "AFLT", "FLOT", "MTLR", "POSI", "SVCB", "RTKM"] },
    { id: "broad-market", mode: "capitalization", title: "Широкий рынок", description: "Расширенный видимый набор ликвидных имен.", tickers: ["SBER", "GAZP", "LKOH", "ROSN", "NVTK", "GMKN", "MAGN", "NLMK", "MTSS", "AFLT", "YDEX", "T", "MOEX"] },
  ],
  indices: [
    { id: "imoex-core", mode: "indices", title: "Индекс МосБиржи (ядро)", description: "Тяжеловесы IMOEX как база бенчмарка рынка акций.", tickers: ["SBER", "GAZP", "LKOH", "NVTK", "ROSN", "TATN", "GMKN", "YDEX", "T"] },
    { id: "blue-chip-index", mode: "indices", title: "Индекс голубых фишек", description: "Core ликвидности и индексный бета-кластер.", tickers: ["SBER", "GAZP", "LKOH", "NVTK", "ROSN", "TATN", "GMKN", "MGNT"] },
    { id: "mid-small-index", mode: "indices", title: "Индекс средней и малой капитализации", description: "Сегмент расширения участия за пределами core.", tickers: ["AFKS", "AFLT", "FLOT", "MTLR", "POSI", "SVCB", "RTKM"] },
    { id: "sectoral-proxy", mode: "indices", title: "Секторный прокси", description: "Группа из ключевых отраслевых тяжеловесов MOEX.", tickers: ["SBER", "GAZP", "LKOH", "ROSN", "NVTK", "GMKN", "NLMK", "MAGN", "MTSS", "MOEX"] },
  ],
  drivers: [
    { id: "oil", mode: "drivers", title: "Поводырь: Нефть", description: "Импульс от нефти и экспортного cashflow.", tickers: ["LKOH", "ROSN", "TATN", "SIBN"], driverLabel: "Нефть" },
    { id: "gas", mode: "drivers", title: "Поводырь: Газ", description: "Газовый контур и чувствительные имена.", tickers: ["GAZP", "NVTK"], driverLabel: "Газ" },
    { id: "gold", mode: "drivers", title: "Поводырь: Золото", description: "Золото как защитный intraday-фактор.", tickers: ["PLZL", "UGLD"], driverLabel: "Золото" },
    { id: "ruble", mode: "drivers", title: "Поводырь: Рубль", description: "Валютный фактор для экспортного блока.", tickers: ["LKOH", "ROSN", "NVTK", "RUAL", "NLMK", "MAGN"], driverLabel: "Рубль" },
    { id: "rates", mode: "drivers", title: "Поводырь: Ставка", description: "Ставочный риск для финансового сегмента.", tickers: ["SBER", "VTBR", "T", "MOEX"], driverLabel: "Ставка" },
    { id: "index-heavy", mode: "drivers", title: "Поводырь: Индекс", description: "Индексные тяжеловесы как направляющий поток.", tickers: ["SBER", "GAZP", "LKOH", "NVTK", "ROSN", "YDEX"], driverLabel: "Индекс" },
  ],
};
