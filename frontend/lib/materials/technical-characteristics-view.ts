import type { TechnicalCharacteristicsRow } from "@/lib/materials/contracts";

export type TechnicalMode = "stocks" | "futures" | "compare";
export type DensityMode = "compact" | "comfortable";

export type ColumnKey =
  | "instrument"
  | "ticker"
  | "assetClass"
  | "lotSize"
  | "currentPrice"
  | "lotPrice"
  | "priceStep"
  | "stepValue"
  | "spreadPct"
  | "tradesCount"
  | "turnoverRubMln"
  | "turnoverPerTradeRubK"
  | "largeLotRubMln"
  | "intradayUsabilityScore"
  | "entryFriction"
  | "commissionToRangeScore"
  | "daysToExpiry"
  | "contractSize"
  | "marginFootprintRub"
  | "board"
  | "scalabilityHint";

export type ColumnDef = {
  key: ColumnKey;
  label: string;
  align: "left" | "right";
  priority: "primary" | "secondary";
  sticky?: boolean;
  value: (row: TechnicalCharacteristicsRow) => string;
  sortValue: (row: TechnicalCharacteristicsRow) => number | string;
  heatValue?: (row: TechnicalCharacteristicsRow) => number | null;
};

export type TablePreset = {
  id: "scalp" | "intraday" | "liquidity" | "stocks" | "futures";
  label: string;
  columns: ColumnKey[];
};

export type ModeConfig = {
  defaultColumns: ColumnKey[];
  defaultSort: { key: ColumnKey; desc: boolean };
  quickFilters: Array<"tradableNow" | "liquidOnly">;
};

function fmt(value: number | null, digits = 2) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);
}

function fmtInt(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

export function getEntryFriction(row: TechnicalCharacteristicsRow): number | null {
  const spread = row.spreadPct.value;
  const trades = row.tradesCount.value;
  const turnover = row.turnoverRub.value;
  if (spread === null || trades === null || turnover === null || trades <= 0 || turnover <= 0) return null;
  return spread * 100 * (1_000_000 / turnover) * (10_000 / trades);
}

export const COLUMN_DEFS: Record<ColumnKey, ColumnDef> = {
  instrument: {
    key: "instrument",
    label: "Инструмент",
    align: "left",
    priority: "primary",
    sticky: true,
    value: (row) => row.instrumentName,
    sortValue: (row) => row.instrumentName,
  },
  ticker: {
    key: "ticker",
    label: "Тикер",
    align: "left",
    priority: "primary",
    sticky: true,
    value: (row) => row.ticker,
    sortValue: (row) => row.ticker,
  },
  assetClass: { key: "assetClass", label: "Тип", align: "left", priority: "secondary", value: (r) => (r.assetClass === "stock" ? "Акция" : "Фьючерс"), sortValue: (r) => r.assetClass },
  lotSize: { key: "lotSize", label: "Лот, шт/контр.", align: "right", priority: "secondary", value: (r) => fmtInt(r.lotSize.value), sortValue: (r) => r.lotSize.value ?? -1 },
  currentPrice: { key: "currentPrice", label: "Цена, ₽", align: "right", priority: "primary", value: (r) => fmt(r.currentPrice.value, 4), sortValue: (r) => r.currentPrice.value ?? -1 },
  lotPrice: { key: "lotPrice", label: "Цена лота, ₽", align: "right", priority: "primary", value: (r) => fmt(r.lotPrice.value, 2), sortValue: (r) => r.lotPrice.value ?? -1 },
  priceStep: { key: "priceStep", label: "Шаг цены, ₽", align: "right", priority: "secondary", value: (r) => fmt(r.priceStep.value, 4), sortValue: (r) => r.priceStep.value ?? -1 },
  stepValue: { key: "stepValue", label: "Стоимость шага, ₽", align: "right", priority: "secondary", value: (r) => fmt(r.stepValue.value, 2), sortValue: (r) => r.stepValue.value ?? -1 },
  spreadPct: {
    key: "spreadPct",
    label: "Спред, %",
    align: "right",
    priority: "primary",
    value: (r) => fmt(r.spreadPct.value, 3),
    sortValue: (r) => r.spreadPct.value ?? -1,
    heatValue: (r) => r.spreadPct.value,
  },
  tradesCount: { key: "tradesCount", label: "Сделки, шт", align: "right", priority: "primary", value: (r) => fmtInt(r.tradesCount.value), sortValue: (r) => r.tradesCount.value ?? -1, heatValue: (r) => r.tradesCount.value },
  turnoverRubMln: {
    key: "turnoverRubMln",
    label: "Оборот, млн ₽",
    align: "right",
    priority: "primary",
    value: (r) => fmt(r.turnoverRub.value === null ? null : r.turnoverRub.value / 1_000_000, 2),
    sortValue: (r) => r.turnoverRub.value ?? -1,
    heatValue: (r) => r.turnoverRub.value,
  },
  turnoverPerTradeRubK: {
    key: "turnoverPerTradeRubK",
    label: "Оборот/сделка, тыс ₽",
    align: "right",
    priority: "secondary",
    value: (r) => fmt(r.turnoverPerTradeRub.value === null ? null : r.turnoverPerTradeRub.value / 1_000, 2),
    sortValue: (r) => r.turnoverPerTradeRub.value ?? -1,
  },
  largeLotRubMln: {
    key: "largeLotRubMln",
    label: "1% оборота, млн ₽",
    align: "right",
    priority: "secondary",
    value: (r) => fmt(r.largeLotRub.value === null ? null : r.largeLotRub.value / 1_000_000, 2),
    sortValue: (r) => r.largeLotRub.value ?? -1,
  },
  intradayUsabilityScore: {
    key: "intradayUsabilityScore",
    label: "Trader Readiness, 0-100",
    align: "right",
    priority: "primary",
    value: (r) => fmt(r.intradayUsabilityScore.value, 1),
    sortValue: (r) => r.intradayUsabilityScore.value ?? -1,
    heatValue: (r) => r.intradayUsabilityScore.value,
  },
  entryFriction: {
    key: "entryFriction",
    label: "Entry friction, idx",
    align: "right",
    priority: "secondary",
    value: (r) => fmt(getEntryFriction(r), 2),
    sortValue: (r) => getEntryFriction(r) ?? -1,
    heatValue: (r) => getEntryFriction(r),
  },
  commissionToRangeScore: {
    key: "commissionToRangeScore",
    label: "Cost-to-error, 0-100",
    align: "right",
    priority: "secondary",
    value: (r) => fmt(r.commissionToRangeScore.value, 1),
    sortValue: (r) => r.commissionToRangeScore.value ?? -1,
  },
  daysToExpiry: { key: "daysToExpiry", label: "DTE, дни", align: "right", priority: "primary", value: (r) => fmtInt(r.daysToExpiry.value), sortValue: (r) => r.daysToExpiry.value ?? -1 },
  contractSize: { key: "contractSize", label: "Размер контракта", align: "right", priority: "secondary", value: (r) => fmtInt(r.contractSize.value), sortValue: (r) => r.contractSize.value ?? -1 },
  marginFootprintRub: { key: "marginFootprintRub", label: "ГО, ₽", align: "right", priority: "secondary", value: (r) => fmt(r.marginFootprintRub.value, 2), sortValue: (r) => r.marginFootprintRub.value ?? -1 },
  board: { key: "board", label: "Board", align: "left", priority: "secondary", value: (r) => r.board ?? "—", sortValue: (r) => r.board ?? "" },
  scalabilityHint: { key: "scalabilityHint", label: "Пригодность", align: "left", priority: "secondary", value: (r) => r.scalabilityHint, sortValue: (r) => r.scalabilityHint },
};

export const TABLE_PRESETS: TablePreset[] = [
  { id: "scalp", label: "Скальп", columns: ["instrument", "ticker", "currentPrice", "spreadPct", "tradesCount", "turnoverRubMln", "entryFriction", "intradayUsabilityScore"] },
  { id: "intraday", label: "Интрадей", columns: ["instrument", "ticker", "currentPrice", "lotPrice", "spreadPct", "turnoverRubMln", "turnoverPerTradeRubK", "commissionToRangeScore", "intradayUsabilityScore"] },
  { id: "liquidity", label: "Ликвидность", columns: ["instrument", "ticker", "spreadPct", "tradesCount", "turnoverRubMln", "largeLotRubMln", "entryFriction", "board"] },
  { id: "stocks", label: "Акции", columns: ["instrument", "ticker", "lotSize", "currentPrice", "lotPrice", "spreadPct", "tradesCount", "turnoverRubMln", "largeLotRubMln", "intradayUsabilityScore"] },
  { id: "futures", label: "Фьючерсы", columns: ["instrument", "ticker", "currentPrice", "priceStep", "stepValue", "contractSize", "daysToExpiry", "spreadPct", "tradesCount", "turnoverRubMln", "intradayUsabilityScore"] },
];

export const MODE_CONFIGS: Record<TechnicalMode, ModeConfig> = {
  stocks: {
    defaultColumns: ["instrument", "ticker", "lotSize", "currentPrice", "lotPrice", "spreadPct", "tradesCount", "turnoverRubMln", "largeLotRubMln", "intradayUsabilityScore", "entryFriction"],
    defaultSort: { key: "turnoverRubMln", desc: true },
    quickFilters: ["tradableNow", "liquidOnly"],
  },
  futures: {
    defaultColumns: ["instrument", "ticker", "currentPrice", "priceStep", "stepValue", "contractSize", "daysToExpiry", "spreadPct", "tradesCount", "turnoverRubMln", "intradayUsabilityScore", "commissionToRangeScore"],
    defaultSort: { key: "intradayUsabilityScore", desc: true },
    quickFilters: ["tradableNow", "liquidOnly"],
  },
  compare: {
    defaultColumns: ["instrument", "ticker", "assetClass", "currentPrice", "spreadPct", "tradesCount", "turnoverRubMln", "entryFriction", "intradayUsabilityScore", "scalabilityHint"],
    defaultSort: { key: "intradayUsabilityScore", desc: true },
    quickFilters: ["tradableNow", "liquidOnly"],
  },
};
