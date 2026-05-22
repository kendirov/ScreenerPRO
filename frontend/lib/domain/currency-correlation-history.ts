import type { CurrencyCorrelationFamily } from "@/lib/domain/currency-correlation";

export type CurrencyHistoryPoint = {
  date: string;
  close: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
};

export type CurrencyHistoryInstrumentStatus = "ok" | "empty" | "error";

export type CurrencyHistoryCoverageStatus =
  | "ok"
  | "sparse"
  | "empty"
  | "error"
  | "excluded"
  | "no_overlap";

export type CurrencyHistoryPairKey = "SI/CNY" | "SI/ED" | "CNY/ED";

export type CurrencyHistoryInstrument = {
  family: CurrencyCorrelationFamily;
  ticker: string;
  label: string;
  points: CurrencyHistoryPoint[];
  status: CurrencyHistoryInstrumentStatus;
  error?: string;
  pointsCount?: number;
  firstDate?: string | null;
  lastDate?: string | null;
  closeCount?: number;
  hasRecentData?: boolean;
  coverageStatus?: CurrencyHistoryCoverageStatus;
  excludedReason?: string | null;
  selectedContractReason?: string | null;
  /** Тикер с максимальным оборотом/сделками в ленте скринера. */
  activeNowTicker?: string | null;
  /** Совпадает ли выбранный для графика контракт с активным сейчас. */
  sameAsActiveNow?: boolean;
};

/** Строка блока «Выбор контрактов». */
export type CurrencyContractSelection = {
  family: CurrencyCorrelationFamily;
  label: string;
  activeNowTicker: string;
  chartTicker: string;
  pointsCount: number;
  selectionReason: string;
  sameAsActiveNow: boolean;
  excludedFromChart: boolean;
};

export type CurrencyHistoryResponse = {
  source: "MOEX ISS";
  updatedAt: string;
  days: number;
  interval: number;
  endpointUsed: "candles";
  instruments: CurrencyHistoryInstrument[];
  contractSelections: CurrencyContractSelection[];
  chartInstruments: CurrencyCorrelationFamily[];
  chartWarnings: string[];
  commonDatesByPair: Record<CurrencyHistoryPairKey, number>;
  commonDatesOnChart: number;
  basketInstrumentsCount: number;
  basketNote?: string;
};
