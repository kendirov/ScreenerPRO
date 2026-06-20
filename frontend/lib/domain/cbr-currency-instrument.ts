/**
 * Абстрактный слой валютных инструментов для CBR rate replay.
 * Client-safe: конфиги и подписи; резолв — server (cbr-currency-instrument-resolver.ts).
 */

export type CurrencyInstrumentKey = "usd_rub" | "cny_rub";

export type CurrencyPreferredType = "perpetual_futures" | "nearest_futures" | "spot";

export type CurrencyFallbackResolver = "nearest_futures_by_date";

export type CurrencyMoexSecurity = {
  engine: "futures";
  market: "forts";
  /** Известные SECID бессрочных контрактов на MOEX FORTS */
  perpetualSecids: readonly string[];
  /** Базовый код для fallback на экспирационный контракт */
  nearestAssetCode: "Si" | "CNY";
};

export type CurrencyInstrumentConfig = {
  key: CurrencyInstrumentKey;
  title: string;
  preferredType: CurrencyPreferredType;
  moexSecurity: CurrencyMoexSecurity;
  fallbackResolver: CurrencyFallbackResolver;
};

export type CurrencyResolvedType = "perpetual_futures" | "nearest_futures" | "unresolved";

export type CurrencyInstrumentResolveMeta = {
  key: CurrencyInstrumentKey;
  resolvedType: CurrencyResolvedType;
  secid: string;
  displayLabel: string;
  displayTicker: string;
  nearestAssetCode?: "Si" | "CNY";
  expiryDate?: string;
};

export const CBR_USD_RUB_CURRENCY: CurrencyInstrumentConfig = {
  key: "usd_rub",
  title: "USD/RUB",
  preferredType: "perpetual_futures",
  moexSecurity: {
    engine: "futures",
    market: "forts",
    perpetualSecids: ["USDRUBF"],
    nearestAssetCode: "Si",
  },
  fallbackResolver: "nearest_futures_by_date",
};

export const CBR_CNY_RUB_CURRENCY: CurrencyInstrumentConfig = {
  key: "cny_rub",
  title: "CNY/RUB",
  preferredType: "perpetual_futures",
  moexSecurity: {
    engine: "futures",
    market: "forts",
    perpetualSecids: ["CNYRUBF"],
    nearestAssetCode: "CNY",
  },
  fallbackResolver: "nearest_futures_by_date",
};

export const CBR_CURRENCY_INSTRUMENTS: Record<CurrencyInstrumentKey, CurrencyInstrumentConfig> = {
  usd_rub: CBR_USD_RUB_CURRENCY,
  cny_rub: CBR_CNY_RUB_CURRENCY,
};

export function getCurrencyInstrumentConfig(key: CurrencyInstrumentKey): CurrencyInstrumentConfig {
  return CBR_CURRENCY_INSTRUMENTS[key];
}

export function perpetualCurrencyLabel(key: CurrencyInstrumentKey): string {
  return key === "usd_rub" ? "USD/RUB бессрочный фьючерс" : "CNY/RUB бессрочный фьючерс";
}

export function nearestCurrencyLabel(assetCode: "Si" | "CNY"): string {
  return `${assetCode} ближайший контракт`;
}

/** Подпись для UI после резолва (или placeholder до загрузки). */
export function formatCurrencyInstrumentLabel(meta: CurrencyInstrumentResolveMeta | null): string {
  if (!meta) return "валюта · загрузка…";
  if (meta.resolvedType === "perpetual_futures") {
    return perpetualCurrencyLabel(meta.key);
  }
  if (meta.resolvedType === "nearest_futures" && meta.nearestAssetCode) {
    return nearestCurrencyLabel(meta.nearestAssetCode);
  }
  return "нет данных MOEX";
}

export function preferredCurrencyPlaceholderLabel(key: CurrencyInstrumentKey): string {
  return perpetualCurrencyLabel(key);
}

export function buildCurrencyResolveMeta(
  config: CurrencyInstrumentConfig,
  partial: Omit<CurrencyInstrumentResolveMeta, "key" | "displayLabel"> & {
    displayLabel?: string;
  },
): CurrencyInstrumentResolveMeta {
  const displayLabel =
    partial.displayLabel ??
    (partial.resolvedType === "perpetual_futures"
      ? perpetualCurrencyLabel(config.key)
      : partial.resolvedType === "nearest_futures" && partial.nearestAssetCode
        ? nearestCurrencyLabel(partial.nearestAssetCode)
        : "нет данных MOEX");

  return {
    key: config.key,
    displayLabel,
    ...partial,
  };
}
