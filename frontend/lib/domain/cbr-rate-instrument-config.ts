import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import { preferredCurrencyPlaceholderLabel } from "@/lib/domain/cbr-currency-instrument";
import type { CurrencyInstrumentKey } from "@/lib/domain/cbr-currency-instrument";
import type { CbrChartSlotId } from "@/lib/domain/cbr-rate-chart-model";

/** Базовый код фьючерса — не SECID контракта. */
export type CbrFuturesAssetCode = "Si" | "CNY" | "MX" | "MXI";

export type CbrMoexEngine = "stock" | "futures";

export type CbrMoexInstrumentSpec = {
  slotId: CbrChartSlotId;
  label: string;
  displayTicker: string;
  engine: CbrMoexEngine;
  market: string;
  board?: string;
  /** Прямой SECID (акции / индекс) */
  secid?: string;
  /** Для FORTS — резолв ближайшего контракта по ASSETCODE */
  futuresAssetCode?: CbrFuturesAssetCode;
  /** Валютный слой (режим «Валюта»): perpetual → nearest */
  currencyKey?: CurrencyInstrumentKey;
  placeholder?: boolean;
  placeholderReason?: string;
  /** false — без demo-fallback (только live или no_data) */
  allowDemoFallback?: boolean;
  marketSegment: CbrReplayMarketMode;
};

export const CBR_FUTURES_ASSET_META: Record<
  CbrFuturesAssetCode,
  { label: string; assetCodes: readonly string[]; secidPrefixes: readonly string[] }
> = {
  Si: { label: "USD/RUB", assetCodes: ["Si", "SI"], secidPrefixes: ["SI"] },
  CNY: { label: "CNY/RUB", assetCodes: ["CNY", "CR"], secidPrefixes: ["CR", "CNY"] },
  MX: { label: "IMOEX фьючерс", assetCodes: ["MX"], secidPrefixes: ["MX"] },
  MXI: { label: "MOEX index fut", assetCodes: ["MXI"], secidPrefixes: ["MXI"] },
};

export const CBR_FUTURES_MANUAL_SECID: Partial<Record<CbrFuturesAssetCode, string>> = {};

/** @deprecated ручной mapping перенесён в data/moex-futures-contract-map.ts */

/** Режим 1 — акции: IMOEX spot, без MX. */
export const CBR_EQUITIES_INSTRUMENT_SPECS: CbrMoexInstrumentSpec[] = [
  {
    slotId: "equity-index",
    label: "Индекс МосБиржи",
    displayTicker: "IMOEX",
    engine: "stock",
    market: "index",
    secid: "IMOEX",
    allowDemoFallback: false,
    marketSegment: "equities",
  },
  {
    slotId: "sber",
    label: "Сбербанк",
    displayTicker: "SBER",
    engine: "stock",
    market: "shares",
    board: "TQBR",
    secid: "SBER",
    allowDemoFallback: false,
    marketSegment: "equities",
  },
  {
    slotId: "gazp",
    label: "Газпром",
    displayTicker: "GAZP",
    engine: "stock",
    market: "shares",
    board: "TQBR",
    secid: "GAZP",
    allowDemoFallback: false,
    marketSegment: "equities",
  },
  {
    slotId: "lkoh",
    label: "Лукойл",
    displayTicker: "LKOH",
    engine: "stock",
    market: "shares",
    board: "TQBR",
    secid: "LKOH",
    allowDemoFallback: false,
    marketSegment: "equities",
  },
  {
    slotId: "vtbr",
    label: "ВТБ",
    displayTicker: "VTBR",
    engine: "stock",
    market: "shares",
    board: "TQBR",
    secid: "VTBR",
    allowDemoFallback: false,
    marketSegment: "equities",
  },
  {
    slotId: "bonds",
    label: "RGBI / ОФЗ",
    displayTicker: "RGBI",
    engine: "stock",
    market: "index",
    secid: "RGBI",
    allowDemoFallback: false,
    marketSegment: "equities",
  },
];

/** Режим 2 — валюта: perpetual → ближайший Si/CNY. */
export const CBR_CURRENCY_INSTRUMENT_SPECS: CbrMoexInstrumentSpec[] = [
  {
    slotId: "usd-rub",
    label: preferredCurrencyPlaceholderLabel("usd_rub"),
    displayTicker: "USDRUBF",
    engine: "futures",
    market: "forts",
    currencyKey: "usd_rub",
    allowDemoFallback: false,
    marketSegment: "currency",
  },
  {
    slotId: "cny-rub",
    label: preferredCurrencyPlaceholderLabel("cny_rub"),
    displayTicker: "CNYRUBF",
    engine: "futures",
    market: "forts",
    currencyKey: "cny_rub",
    allowDemoFallback: false,
    marketSegment: "currency",
  },
];

/** Режим 3 — срочный: MX benchmark + ближайшие Si/CNY (без perpetual resolver). */
export const CBR_DERIVATIVES_INSTRUMENT_SPECS: CbrMoexInstrumentSpec[] = [
  {
    slotId: "mx-futures",
    label: "IMOEX фьючерс",
    displayTicker: "MX",
    engine: "futures",
    market: "forts",
    futuresAssetCode: "MX",
    allowDemoFallback: false,
    marketSegment: "derivatives",
  },
  {
    slotId: "usd-rub",
    label: "USD/RUB фьючерс",
    displayTicker: "Si",
    engine: "futures",
    market: "forts",
    futuresAssetCode: "Si",
    allowDemoFallback: false,
    marketSegment: "derivatives",
  },
  {
    slotId: "cny-rub",
    label: "CNY/RUB фьючерс",
    displayTicker: "CNY",
    engine: "futures",
    market: "forts",
    futuresAssetCode: "CNY",
    allowDemoFallback: false,
    marketSegment: "derivatives",
  },
];

/** @deprecated используйте resolveCbrReplayInstrumentSpecs */
export const CBR_DEFAULT_INSTRUMENT_SPECS = CBR_EQUITIES_INSTRUMENT_SPECS;

export function resolveCbrReplayInstrumentSpecs(
  mode: CbrReplayMarketMode = "equities",
): CbrMoexInstrumentSpec[] {
  if (mode === "equities") return [...CBR_EQUITIES_INSTRUMENT_SPECS];
  if (mode === "currency") return [...CBR_CURRENCY_INSTRUMENT_SPECS];
  return [...CBR_DERIVATIVES_INSTRUMENT_SPECS];
}

export function resolveBondsInstrumentSpec(): CbrMoexInstrumentSpec {
  const bonds = CBR_EQUITIES_INSTRUMENT_SPECS.find((s) => s.slotId === "bonds");
  return bonds ?? CBR_EQUITIES_INSTRUMENT_SPECS[CBR_EQUITIES_INSTRUMENT_SPECS.length - 1]!;
}

/** @deprecated */
export function resolveActiveStockInstrumentSpec(
  ticker: string,
  title: string,
): CbrMoexInstrumentSpec {
  return {
    slotId: "gazp",
    label: title,
    displayTicker: ticker,
    engine: "stock",
    market: "shares",
    board: "TQBR",
    secid: ticker,
    marketSegment: "equities",
  };
}
