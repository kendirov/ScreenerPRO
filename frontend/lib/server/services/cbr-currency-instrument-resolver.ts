/**
 * Резолв валютного инструмента для CBR replay: perpetual → nearest → unresolved.
 * Делегирует в moex-instrument-resolver.
 */

import {
  buildCurrencyResolveMeta,
  getCurrencyInstrumentConfig,
  type CurrencyInstrumentConfig,
  type CurrencyInstrumentKey,
  type CurrencyInstrumentResolveMeta,
} from "@/lib/domain/cbr-currency-instrument";
import {
  resolveCurrencyReplayInstrument,
  resolveNearestFuturesContract as resolveNearestFromMoex,
} from "@/lib/moex/moex-instrument-resolver";

export type ResolvedCurrencyInstrument = CurrencyInstrumentResolveMeta & {
  source: "iss" | "manual" | "unresolved";
  diagnostics: string[];
};

function fromMoexCurrencyResolved(
  config: CurrencyInstrumentConfig,
  resolved: Awaited<ReturnType<typeof resolveCurrencyReplayInstrument>>,
): ResolvedCurrencyInstrument {
  const diagnostics = resolved.reason ? [resolved.reason] : [];

  if (resolved.status === "no_data") {
    return {
      ...buildCurrencyResolveMeta(config, {
        resolvedType: "unresolved",
        secid: "—",
        displayTicker: "—",
        displayLabel: "нет данных MOEX",
      }),
      source: "unresolved",
      diagnostics,
    };
  }

  const resolvedType =
    resolved.resolvedKind === "perpetual_futures" ? "perpetual_futures" : "nearest_futures";

  return {
    ...buildCurrencyResolveMeta(config, {
      resolvedType,
      secid: resolved.security,
      displayTicker: resolved.security,
      nearestAssetCode:
        resolvedType === "nearest_futures" ? config.moexSecurity.nearestAssetCode : undefined,
      expiryDate: resolved.expiryDate,
    }),
    source: resolved.source === "manual" ? "manual" : "iss",
    diagnostics,
  };
}

export async function resolveCurrencyInstrument(
  key: CurrencyInstrumentKey,
  asOfDate: string,
): Promise<ResolvedCurrencyInstrument> {
  const config = getCurrencyInstrumentConfig(key);
  const resolved = await resolveCurrencyReplayInstrument(key, asOfDate);
  return fromMoexCurrencyResolved(config, resolved);
}

export async function resolveCurrencyInstrumentFromConfig(
  config: CurrencyInstrumentConfig,
  asOfDate: string,
): Promise<ResolvedCurrencyInstrument> {
  const resolved = await resolveCurrencyReplayInstrument(config.key, asOfDate);
  return fromMoexCurrencyResolved(config, resolved);
}

/** Если perpetual без свечей на дату — переключиться на ближайший экспирационный. */
export async function resolveCurrencyInstrumentNearestFallback(
  key: CurrencyInstrumentKey,
  asOfDate: string,
): Promise<ResolvedCurrencyInstrument> {
  const config = getCurrencyInstrumentConfig(key);
  const diagnostics: string[] = ["Perpetual без свечей на дату заседания — ближайший контракт"];

  const nearest = await resolveNearestFromMoex(config.moexSecurity.nearestAssetCode, asOfDate);
  diagnostics.push(nearest.reason ?? `${config.moexSecurity.nearestAssetCode}: nearest`);

  if (nearest.status === "no_data") {
    return {
      ...buildCurrencyResolveMeta(config, {
        resolvedType: "unresolved",
        secid: "—",
        displayTicker: "—",
        displayLabel: "нет данных MOEX",
      }),
      source: "unresolved",
      diagnostics,
    };
  }

  return {
    ...buildCurrencyResolveMeta(config, {
      resolvedType: "nearest_futures",
      secid: nearest.security,
      displayTicker: nearest.security,
      nearestAssetCode: config.moexSecurity.nearestAssetCode,
      expiryDate: nearest.expiryDate,
    }),
    source: nearest.source === "manual" ? "manual" : "iss",
    diagnostics,
  };
}
