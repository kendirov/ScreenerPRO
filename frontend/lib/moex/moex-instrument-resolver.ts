/**
 * MOEX ISS instrument resolver для страницы «Ставка ЦБ Replay».
 * Server-side: использует ISS securities (futures/forts) и ручной map из data/.
 */

import { lookupManualFuturesContract } from "@/data/moex-futures-contract-map";
import type { MoexFuturesAssetCode } from "@/data/moex-futures-contract-map";
import {
  CBR_FUTURES_ASSET_META,
  type CbrFuturesAssetCode,
} from "@/lib/domain/cbr-rate-instrument-config";
import type { CurrencyInstrumentKey } from "@/lib/domain/cbr-currency-instrument";
import { getCurrencyInstrumentConfig } from "@/lib/domain/cbr-currency-instrument";
import type { FuturesContractCandidate } from "@/lib/domain/futures-contract-resolver";
import { fetchMoexFortsContractCandidates } from "@/lib/server/services/futures-contract-resolver";

export type MoexInstrumentResolveStatus = "resolved" | "no_data";

export type MoexInstrumentSource = "iss" | "manual" | "config";

export type MoexResolvedInstrument = {
  key: string;
  title: string;
  security: string;
  engine: "stock" | "futures";
  market: string;
  board?: string;
  source: MoexInstrumentSource;
  status: MoexInstrumentResolveStatus;
  reason?: string;
  assetCode?: CbrFuturesAssetCode;
  expiryDate?: string;
  resolvedKind?: "equity" | "index" | "perpetual_futures" | "nearest_futures";
};

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const EQUITY_TITLES: Record<string, string> = {
  SBER: "Сбербанк",
  GAZP: "Газпром",
  LKOH: "Лукойл",
  VTBR: "ВТБ",
};

const INDEX_TITLES: Record<string, string> = {
  IMOEX: "Индекс МосБиржи",
  RGBI: "RGBI / ОФЗ",
};

const PERPETUAL_SECIDS: Record<CurrencyInstrumentKey, readonly string[]> = {
  usd_rub: ["USDRUBF"],
  cny_rub: ["CNYRUBF"],
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function parseEventDate(eventDate: string): Date {
  return new Date(`${eventDate.slice(0, 10)}T12:00:00+03:00`);
}

function parseExpiry(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysToExpiry(expiryDate: string | null | undefined, asOf: Date): number | null {
  const d = parseExpiry(expiryDate);
  if (!d) return null;
  return Math.ceil((d.getTime() - asOf.getTime()) / MS_IN_DAY);
}

function isPerpetualTicker(ticker: string): boolean {
  const t = ticker.trim().toUpperCase();
  return /F$/.test(t) || /^(USDRUBF|CNYRUBF|EURRUBF)$/i.test(t);
}

function matchesFuturesAsset(
  asset: CbrFuturesAssetCode,
  candidate: FuturesContractCandidate,
): boolean {
  const meta = CBR_FUTURES_ASSET_META[asset];
  const secid = candidate.secid.trim().toUpperCase();
  const code = candidate.assetCode?.trim() ?? "";

  if (isPerpetualTicker(secid)) return false;

  if (meta.assetCodes.some((a) => a.toLowerCase() === code.toLowerCase())) {
    if (asset === "Si" && /^(CR|CNY|EU|ED|MX|MXI)/.test(secid)) return false;
    if (asset === "CNY" && /^(SI|EU|ED|MX|MXI)/.test(secid)) return false;
    if (asset === "MX" && /^(SI|CR|CNY|EU|ED|MXI)/.test(secid)) return false;
    if (asset === "MXI" && /^(SI|CR|CNY|EU|ED|MX)/.test(secid)) return false;
    return true;
  }

  return meta.secidPrefixes.some((prefix) => secid.startsWith(prefix));
}

function rankFuturesCandidates(
  assetCode: CbrFuturesAssetCode,
  candidates: FuturesContractCandidate[],
  eventDate: string,
): FuturesContractCandidate[] {
  const asOf = parseEventDate(eventDate);
  const matched = candidates.filter((c) => matchesFuturesAsset(assetCode, c));

  const activeOnDate = matched.filter((c) => {
    const dte = daysToExpiry(c.expiryDate, asOf);
    return dte === null || dte >= 0;
  });

  return [...activeOnDate].sort((a, b) => {
    const ad = daysToExpiry(a.expiryDate, asOf);
    const bd = daysToExpiry(b.expiryDate, asOf);
    if (ad !== null && bd !== null && ad !== bd) return ad - bd;
    const turnoverDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
    if (turnoverDiff !== 0) return turnoverDiff;
    return a.secid.localeCompare(b.secid, "ru");
  });
}

function findPerpetualInIss(
  perpetualSecids: readonly string[],
  candidates: FuturesContractCandidate[],
): string | null {
  const index = new Map(candidates.map((c) => [c.secid.trim().toUpperCase(), c.secid]));
  for (const id of perpetualSecids) {
    const hit = index.get(id.trim().toUpperCase());
    if (hit) return hit;
  }
  return null;
}

function resolvedFutures(
  assetCode: CbrFuturesAssetCode,
  pick: { secid: string; shortName?: string; expiryDate?: string | null },
  source: MoexInstrumentSource,
  resolvedKind: "perpetual_futures" | "nearest_futures",
  reason?: string,
): MoexResolvedInstrument {
  const meta = CBR_FUTURES_ASSET_META[assetCode];
  return {
    key: assetCode.toLowerCase(),
    title: meta.label,
    security: pick.secid,
    engine: "futures",
    market: "forts",
    source,
    status: "resolved",
    reason,
    assetCode,
    expiryDate: pick.expiryDate ?? undefined,
    resolvedKind,
  };
}

function noDataFutures(
  assetCode: CbrFuturesAssetCode,
  reason: string,
  source: MoexInstrumentSource = "iss",
): MoexResolvedInstrument {
  const meta = CBR_FUTURES_ASSET_META[assetCode];
  return {
    key: assetCode.toLowerCase(),
    title: meta.label,
    security: "—",
    engine: "futures",
    market: "forts",
    source,
    status: "no_data",
    reason,
    assetCode,
  };
}

/** Акции TQBR — синхронный резолв маршрута MOEX ISS. */
export function resolveEquityInstrument(ticker: string): MoexResolvedInstrument {
  const security = normalizeTicker(ticker);
  if (!security) {
    return {
      key: "equity",
      title: "Акция",
      security: "—",
      engine: "stock",
      market: "shares",
      board: "TQBR",
      source: "config",
      status: "no_data",
      reason: "Пустой ticker",
      resolvedKind: "equity",
    };
  }

  return {
    key: security.toLowerCase(),
    title: EQUITY_TITLES[security] ?? security,
    security,
    engine: "stock",
    market: "shares",
    board: "TQBR",
    source: "config",
    status: "resolved",
    resolvedKind: "equity",
  };
}

/** Индексы IMOEX / RGBI — синхронный резолв. */
export function resolveIndexInstrument(ticker: string): MoexResolvedInstrument {
  const security = normalizeTicker(ticker);
  const known = security === "IMOEX" || security === "RGBI";

  if (!known) {
    return {
      key: security.toLowerCase() || "index",
      title: security || "Индекс",
      security: security || "—",
      engine: "stock",
      market: "index",
      source: "config",
      status: "no_data",
      reason: `Индекс ${security || "—"} не поддерживается (допустимы IMOEX, RGBI)`,
      resolvedKind: "index",
    };
  }

  return {
    key: security.toLowerCase(),
    title: INDEX_TITLES[security]!,
    security,
    engine: "stock",
    market: "index",
    source: "config",
    status: "resolved",
    resolvedKind: "index",
  };
}

/**
 * Ближайший ликвидный FORTS-контракт на дату заседания.
 * Si / CNY / MX — через ISS; при неудаче — ручной map (TODO data file).
 */
export async function resolveNearestFuturesContract(
  assetCode: MoexFuturesAssetCode | CbrFuturesAssetCode,
  eventDate: string,
): Promise<MoexResolvedInstrument> {
  const code = assetCode as CbrFuturesAssetCode;
  const day = eventDate.slice(0, 10);
  const candidates = await fetchMoexFortsContractCandidates();
  const ranked = rankFuturesCandidates(code, candidates, day);

  if (ranked[0]) {
    const pick = ranked[0];
    return resolvedFutures(
      code,
      pick,
      "iss",
      "nearest_futures",
      `ISS: ${pick.secid}${pick.expiryDate ? ` (эксп. ${pick.expiryDate})` : ""}`,
    );
  }

  const manual = lookupManualFuturesContract(code as MoexFuturesAssetCode, day);
  if (manual) {
    return resolvedFutures(
      code,
      { secid: manual.secid },
      "manual",
      "nearest_futures",
      manual.note ?? `Ручной mapping до стабилизации ISS`,
    );
  }

  return noDataFutures(
    code,
    `${code}: активный контракт на ${day} не найден в ISS и нет записи в moex-futures-contract-map`,
  );
}

/**
 * Валютный режим replay: perpetual → nearest futures → no_data.
 */
export async function resolveCurrencyReplayInstrument(
  pair: CurrencyInstrumentKey,
  eventDate: string,
): Promise<MoexResolvedInstrument> {
  const config = getCurrencyInstrumentConfig(pair);
  const day = eventDate.slice(0, 10);
  const candidates = await fetchMoexFortsContractCandidates();
  const perpetualSecids = PERPETUAL_SECIDS[pair];

  const perpetualSecid = findPerpetualInIss(perpetualSecids, candidates);
  if (perpetualSecid) {
    const candidate = candidates.find(
      (c) => c.secid.trim().toUpperCase() === perpetualSecid.trim().toUpperCase(),
    );
    return {
      key: pair,
      title: config.title,
      security: perpetualSecid,
      engine: "futures",
      market: "forts",
      source: "iss",
      status: "resolved",
      reason: `ISS: бессрочный ${perpetualSecid}`,
      assetCode: config.moexSecurity.nearestAssetCode,
      resolvedKind: "perpetual_futures",
      expiryDate: candidate?.expiryDate ?? undefined,
    };
  }

  const nearest = await resolveNearestFuturesContract(config.moexSecurity.nearestAssetCode, day);
  if (nearest.status === "resolved") {
    return {
      ...nearest,
      key: pair,
      title: config.title,
      resolvedKind: "nearest_futures",
      reason: `Бессрочный (${perpetualSecids.join("/")}) не найден — ${nearest.reason ?? "ближайший фьючерс"}`,
    };
  }

  return {
    key: pair,
    title: config.title,
    security: "—",
    engine: "futures",
    market: "forts",
    source: nearest.source,
    status: "no_data",
    reason:
      nearest.reason ??
      `${pair}: бессрочный и ближайший фьючерс не найдены на ${day}`,
    assetCode: config.moexSecurity.nearestAssetCode,
  };
}

/** @deprecated alias для CBR candles layer */
export type CbrResolvedFuturesFromMoex = MoexResolvedInstrument;
