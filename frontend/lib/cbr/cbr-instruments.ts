/**
 * Инструменты replay заседания ЦБ по режимам.
 */

import type { CbrRateInstrumentConfig } from "@/lib/cbr/cbr-rate-events";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import { preferredCurrencyPlaceholderLabel } from "@/lib/domain/cbr-currency-instrument";

function demoMark(reactionDemo?: boolean): "demo" | "moex" {
  return reactionDemo ? "demo" : "moex";
}

export function buildEquitiesReplayInstruments(options?: {
  reactionDemo?: boolean;
}): CbrRateInstrumentConfig[] {
  const mark = demoMark(options?.reactionDemo);

  return [
    {
      key: "equity_index",
      ticker: "IMOEX",
      title: "Индекс МосБиржи",
      role: "equity_index",
      engine: "stock",
      market: "index",
      dataStatus: mark,
    },
    {
      key: "sber",
      ticker: "SBER",
      title: "Сбербанк",
      role: "bank",
      engine: "stock",
      market: "shares",
      board: "TQBR",
      dataStatus: mark,
    },
    {
      key: "gazp",
      ticker: "GAZP",
      title: "Газпром",
      role: "heavy_stock",
      engine: "stock",
      market: "shares",
      board: "TQBR",
      dataStatus: mark,
    },
    {
      key: "lkoh",
      ticker: "LKOH",
      title: "Лукойл",
      role: "heavy_stock",
      engine: "stock",
      market: "shares",
      board: "TQBR",
      dataStatus: mark,
    },
    {
      key: "vtbr",
      ticker: "VTBR",
      title: "ВТБ",
      role: "heavy_stock",
      engine: "stock",
      market: "shares",
      board: "TQBR",
      dataStatus: mark,
    },
    {
      key: "bonds",
      ticker: "RGBI",
      title: "RGBI / ОФЗ",
      role: "bonds",
      engine: "stock",
      market: "index",
      dataStatus: "no_data",
    },
  ];
}

export function buildCurrencyReplayInstruments(): CbrRateInstrumentConfig[] {
  return [
    {
      key: "usd_rub_currency",
      ticker: "USDRUBF",
      title: preferredCurrencyPlaceholderLabel("usd_rub"),
      role: "usd_fut",
      engine: "futures",
      market: "forts",
      dataStatus: "moex",
    },
    {
      key: "cny_rub_currency",
      ticker: "CNYRUBF",
      title: preferredCurrencyPlaceholderLabel("cny_rub"),
      role: "cny_fut",
      engine: "futures",
      market: "forts",
      dataStatus: "moex",
    },
  ];
}

export function buildDerivativesReplayInstruments(options?: {
  reactionDemo?: boolean;
}): CbrRateInstrumentConfig[] {
  const mark = demoMark(options?.reactionDemo);

  return [
    {
      key: "index_fut",
      ticker: "MX",
      title: "IMOEX фьючерс",
      role: "index_fut",
      engine: "futures",
      market: "forts",
      dataStatus: mark,
    },
    {
      key: "usd_rub_fut",
      ticker: "Si",
      title: "USD/RUB фьючерс",
      role: "usd_fut",
      engine: "futures",
      market: "forts",
      dataStatus: mark,
    },
    {
      key: "cny_rub_fut",
      ticker: "CNY",
      title: "CNY/RUB фьючерс",
      role: "cny_fut",
      engine: "futures",
      market: "forts",
      dataStatus: mark,
    },
  ];
}

export function buildReplayInstrumentsForMode(
  mode: CbrReplayMarketMode,
  options?: { reactionDemo?: boolean },
): CbrRateInstrumentConfig[] {
  if (mode === "equities") return buildEquitiesReplayInstruments(options);
  if (mode === "currency") return buildCurrencyReplayInstruments();
  return buildDerivativesReplayInstruments(options);
}

/** Каталог событий — базовый набор «Рынок акций». */
export function buildDefaultCbrInstruments(options?: {
  reactionDemo?: boolean;
}): CbrRateInstrumentConfig[] {
  return buildEquitiesReplayInstruments(options);
}
