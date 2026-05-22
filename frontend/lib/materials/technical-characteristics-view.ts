import type { TechnicalCharacteristicsRow, ValueWithStatus } from "@/lib/materials/contracts";
import {
  formatMetricCell,
  getColumnHeaderLabel,
  TC_COLUMN_TOOLTIPS,
  type TechnicalCharacteristicsColumnKey,
} from "@/lib/domain/technical-characteristics-labels";

export type { TechnicalCharacteristicsColumnKey as ColumnKey };
export type TechnicalMode = "stocks" | "futures" | "compare";
export type DensityMode = "compact" | "comfortable";

/** Ключевые колонки в компактном режиме (остальное — через «Добавить колонки») */
export const COMPACT_DEFAULT_COLUMNS: TechnicalCharacteristicsColumnKey[] = [
  "instrument",
  "ticker",
  "lotSize",
  "currentPrice",
  "lotPrice",
  "priceStep",
  "stepValue",
  "spreadPct",
  "tradesCount",
  "turnoverRubMln",
  "intradayUsabilityScore",
];

export function getDefaultColumnsForMode(mode: TechnicalMode, density: DensityMode): TechnicalCharacteristicsColumnKey[] {
  if (density === "compact") return COMPACT_DEFAULT_COLUMNS;
  return MODE_CONFIGS[mode].defaultColumns;
}

export type ColumnDef = {
  key: TechnicalCharacteristicsColumnKey;
  label: string;
  shortLabel: string;
  tooltip?: string;
  align: "left" | "right";
  priority: "primary" | "secondary";
  sticky?: boolean;
  value: (row: TechnicalCharacteristicsRow) => string;
  cellMeta?: (row: TechnicalCharacteristicsRow) => { title?: string };
  sortValue: (row: TechnicalCharacteristicsRow) => number | string;
  heatValue?: (row: TechnicalCharacteristicsRow) => number | null;
};

export type TablePreset = {
  id: "scalp" | "intraday" | "liquidity" | "stocks" | "futures";
  label: string;
  columns: TechnicalCharacteristicsColumnKey[];
};

export type ModeConfig = {
  defaultColumns: TechnicalCharacteristicsColumnKey[];
  defaultSort: { key: TechnicalCharacteristicsColumnKey; desc: boolean };
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

function fromField(field: ValueWithStatus, formatValue: (value: number) => string) {
  const cell = formatMetricCell(field, formatValue);
  return { text: cell.text, title: cell.title };
}

function def(
  key: TechnicalCharacteristicsColumnKey,
  partial: Omit<ColumnDef, "key" | "label" | "tooltip" | "shortLabel"> & {
    label?: string;
    tooltip?: string;
    value: (row: TechnicalCharacteristicsRow) => string;
    cellMeta?: (row: TechnicalCharacteristicsRow) => { title?: string };
  },
): ColumnDef {
  return {
    key,
    label: partial.label ?? getColumnHeaderLabel(key, false),
    shortLabel: getColumnHeaderLabel(key, true),
    tooltip: partial.tooltip ?? TC_COLUMN_TOOLTIPS[key],
    align: partial.align,
    priority: partial.priority,
    sticky: partial.sticky,
    value: partial.value,
    cellMeta: partial.cellMeta,
    sortValue: partial.sortValue,
    heatValue: partial.heatValue,
  };
}

export function getEntryFriction(row: TechnicalCharacteristicsRow): number | null {
  const spread = row.spreadPct.value;
  const trades = row.tradesCount.value;
  const turnover = row.turnoverRub.value;
  if (spread === null || trades === null || turnover === null || trades <= 0 || turnover <= 0) return null;
  return spread * 100 * (1_000_000 / turnover) * (10_000 / trades);
}

export const COLUMN_DEFS: Record<TechnicalCharacteristicsColumnKey, ColumnDef> = {
  instrument: def("instrument", {
    align: "left",
    priority: "primary",
    sticky: true,
    value: (row) => row.instrumentName,
    sortValue: (row) => row.instrumentName,
  }),
  ticker: def("ticker", {
    align: "left",
    priority: "primary",
    sticky: true,
    value: (row) => row.ticker,
    sortValue: (row) => row.ticker,
  }),
  assetClass: def("assetClass", {
    align: "left",
    priority: "secondary",
    value: (r) => (r.assetClass === "stock" ? "Акция" : "Фьючерс"),
    sortValue: (r) => r.assetClass,
  }),
  lotSize: def("lotSize", {
    align: "right",
    priority: "secondary",
    value: (r) => fromField(r.lotSize, (v) => fmtInt(v)).text,
    cellMeta: (r) => ({ title: fromField(r.lotSize, (v) => fmtInt(v)).title }),
    sortValue: (r) => r.lotSize.value ?? -1,
  }),
  currentPrice: def("currentPrice", {
    align: "right",
    priority: "primary",
    value: (r) => fromField(r.currentPrice, (v) => fmt(v, 4)).text,
    cellMeta: (r) => ({ title: fromField(r.currentPrice, (v) => fmt(v, 4)).title }),
    sortValue: (r) => r.currentPrice.value ?? -1,
  }),
  lotPrice: def("lotPrice", {
    align: "right",
    priority: "primary",
    value: (r) => fromField(r.lotPrice, (v) => fmt(v, 2)).text,
    cellMeta: (r) => ({ title: fromField(r.lotPrice, (v) => fmt(v, 2)).title }),
    sortValue: (r) => r.lotPrice.value ?? -1,
  }),
  priceStep: def("priceStep", {
    align: "right",
    priority: "secondary",
    value: (r) => fromField(r.priceStep, (v) => fmt(v, 4)).text,
    cellMeta: (r) => ({ title: fromField(r.priceStep, (v) => fmt(v, 4)).title }),
    sortValue: (r) => r.priceStep.value ?? -1,
  }),
  stepValue: def("stepValue", {
    align: "right",
    priority: "secondary",
    value: (r) => fromField(r.stepValue, (v) => fmt(v, 2)).text,
    cellMeta: (r) => ({ title: fromField(r.stepValue, (v) => fmt(v, 2)).title }),
    sortValue: (r) => r.stepValue.value ?? -1,
  }),
  spreadPct: def("spreadPct", {
    align: "right",
    priority: "primary",
    value: (r) => fromField(r.spreadPct, (v) => fmt(v, 3)).text,
    cellMeta: (r) => ({ title: fromField(r.spreadPct, (v) => fmt(v, 3)).title }),
    sortValue: (r) => r.spreadPct.value ?? -1,
    heatValue: (r) => r.spreadPct.value,
  }),
  tradesCount: def("tradesCount", {
    align: "right",
    priority: "primary",
    value: (r) => fromField(r.tradesCount, (v) => fmtInt(v)).text,
    cellMeta: (r) => ({ title: fromField(r.tradesCount, (v) => fmtInt(v)).title }),
    sortValue: (r) => r.tradesCount.value ?? -1,
    heatValue: (r) => r.tradesCount.value,
  }),
  turnoverRubMln: def("turnoverRubMln", {
    align: "right",
    priority: "primary",
    value: (r) => fromField(r.turnoverRub, (v) => fmt(v / 1_000_000, 2)).text,
    cellMeta: (r) => ({ title: fromField(r.turnoverRub, (v) => fmt(v / 1_000_000, 2)).title }),
    sortValue: (r) => r.turnoverRub.value ?? -1,
    heatValue: (r) => r.turnoverRub.value,
  }),
  turnoverPerTradeRubK: def("turnoverPerTradeRubK", {
    align: "right",
    priority: "secondary",
    value: (r) => fromField(r.turnoverPerTradeRub, (v) => fmt(v / 1_000, 2)).text,
    cellMeta: (r) => ({ title: fromField(r.turnoverPerTradeRub, (v) => fmt(v / 1_000, 2)).title }),
    sortValue: (r) => r.turnoverPerTradeRub.value ?? -1,
  }),
  largeLotRubMln: def("largeLotRubMln", {
    align: "right",
    priority: "secondary",
    value: (r) => fromField(r.largeLotRub, (v) => fmt(v / 1_000_000, 2)).text,
    cellMeta: (r) => ({ title: fromField(r.largeLotRub, (v) => fmt(v / 1_000_000, 2)).title }),
    sortValue: (r) => r.largeLotRub.value ?? -1,
  }),
  intradayUsabilityScore: def("intradayUsabilityScore", {
    align: "right",
    priority: "primary",
    value: (r) => fromField(r.intradayUsabilityScore, (v) => fmt(v, 1)).text,
    cellMeta: (r) => ({ title: fromField(r.intradayUsabilityScore, (v) => fmt(v, 1)).title }),
    sortValue: (r) => r.intradayUsabilityScore.value ?? -1,
    heatValue: (r) => r.intradayUsabilityScore.value,
  }),
  entryFriction: def("entryFriction", {
    align: "right",
    priority: "secondary",
    value: (r) => {
      const v = getEntryFriction(r);
      return v === null ? "—" : fmt(v, 2);
    },
    cellMeta: (r) =>
      getEntryFriction(r) === null ? { title: "Недостаточно данных для расчёта (спред, сделки или оборот)" } : {},
    sortValue: (r) => getEntryFriction(r) ?? -1,
    heatValue: (r) => getEntryFriction(r),
  }),
  commissionToRangeScore: def("commissionToRangeScore", {
    align: "right",
    priority: "secondary",
    value: (r) => fromField(r.commissionToRangeScore, (v) => fmt(v, 1)).text,
    cellMeta: (r) => ({ title: fromField(r.commissionToRangeScore, (v) => fmt(v, 1)).title }),
    sortValue: (r) => r.commissionToRangeScore.value ?? -1,
  }),
  daysToExpiry: def("daysToExpiry", {
    align: "right",
    priority: "primary",
    value: (r) => fromField(r.daysToExpiry, (v) => fmtInt(v)).text,
    cellMeta: (r) => ({ title: fromField(r.daysToExpiry, (v) => fmtInt(v)).title }),
    sortValue: (r) => r.daysToExpiry.value ?? -1,
  }),
  contractSize: def("contractSize", {
    align: "right",
    priority: "secondary",
    value: (r) => fromField(r.contractSize, (v) => fmtInt(v)).text,
    cellMeta: (r) => ({ title: fromField(r.contractSize, (v) => fmtInt(v)).title }),
    sortValue: (r) => r.contractSize.value ?? -1,
  }),
  marginFootprintRub: def("marginFootprintRub", {
    align: "right",
    priority: "secondary",
    value: (r) => fromField(r.marginFootprintRub, (v) => fmt(v, 2)).text,
    cellMeta: (r) => ({ title: fromField(r.marginFootprintRub, (v) => fmt(v, 2)).title }),
    sortValue: (r) => r.marginFootprintRub.value ?? -1,
  }),
  board: def("board", {
    align: "left",
    priority: "secondary",
    value: (r) => r.board ?? "—",
    sortValue: (r) => r.board ?? "",
  }),
  scalabilityHint: def("scalabilityHint", {
    align: "left",
    priority: "secondary",
    value: (r) => r.scalabilityHint,
    sortValue: (r) => r.scalabilityHint,
  }),
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
