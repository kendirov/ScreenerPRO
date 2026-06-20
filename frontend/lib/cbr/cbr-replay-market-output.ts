/**
 * Рыночные выводы replay — только по live-инструментам, без запрещённых фраз на demo.
 */

import type { CbrReplayConsistencyResult } from "@/lib/cbr/cbr-replay-consistency";
import { CBR_REPLAY_CONSISTENCY_STATUS_LINES } from "@/lib/cbr/cbr-replay-consistency";
import {
  isDemoDataStatus,
  isForbiddenMarketPhrase,
  metricIsMoexAnalyzable,
  patternAllowedForLiveData,
} from "@/lib/cbr/cbr-replay-market-integrity";
import type { CbrReplayMarketMode } from "@/lib/cbr/cbr-replay-market-mode";
import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";
import type { CbrInstrumentReactionMetrics } from "@/lib/domain/cbr-rate-reaction-metrics";
import { CBR_REACTION_PATTERN_LABELS } from "@/lib/domain/cbr-rate-reaction-metrics";

export type CbrReplayLiveScope =
  | "none"
  | "currency_only"
  | "currency_market"
  | "equities_market"
  | "derivatives_market"
  | "mixed";

export type CbrReplayLiveCoverage = {
  scope: CbrReplayLiveScope;
  replayMode: CbrReplayMarketMode;
  liveCurrencyTickers: string[];
  liveIndexTicker: string | null;
  liveStockTickers: string[];
  demoSegments: string[];
};

const MOVE_THRESHOLD_PCT = 0.05;
const BANK_BEAT_INDEX_MARGIN_PCT = 0.12;

function isLiveMetric(row: Pick<CbrInstrumentReactionMetrics, "dataStatus">): boolean {
  return metricIsMoexAnalyzable(row);
}

function formatTickerList(tickers: string[]): string {
  if (tickers.length <= 1) return tickers[0] ?? "";
  if (tickers.length === 2) return `${tickers[0]} и ${tickers[1]}`;
  return `${tickers.slice(0, -1).join(", ")} и ${tickers[tickers.length - 1]}`;
}

function indexVerb(pct: number | null): string {
  if (pct == null || Math.abs(pct) < MOVE_THRESHOLD_PCT) return "стоял на месте";
  return pct < 0 ? "снизился" : "вырос";
}

export function analyzeReplayLiveCoverage(
  metrics: CbrInstrumentReactionMetrics[],
  replayMode: CbrReplayMarketMode,
): CbrReplayLiveCoverage {
  const currencies = metrics.filter((m) => m.role === "currency");
  const index = metrics.find((m) => m.role === "index") ?? null;
  const stocks = metrics.filter(
    (m) => m.role === "bank" || m.role === "heavy" || m.role === "active",
  );

  const liveCurrency = currencies.filter(isLiveMetric);
  const liveStocks = stocks.filter(isLiveMetric);
  const indexLive = index && isLiveMetric(index) ? index : null;

  const demoCurrency = currencies.some((m) => isDemoDataStatus(m.dataStatus));
  const demoIndex = Boolean(index && isDemoDataStatus(index.dataStatus));
  const demoStocks = stocks.some((m) => isDemoDataStatus(m.dataStatus));

  const demoSegments: string[] = [];
  if (demoCurrency) demoSegments.push("валюта");
  if (demoIndex) demoSegments.push(replayMode === "derivatives" ? "фьючерс на индекс" : "индекс");
  if (demoStocks) demoSegments.push("акции");

  const hasLive = liveCurrency.length > 0 || Boolean(indexLive) || liveStocks.length > 0;
  const hasDemo =
    demoCurrency ||
    demoIndex ||
    demoStocks ||
    metrics.some((m) => isDemoDataStatus(m.dataStatus));

  let scope: CbrReplayLiveScope = "none";

  if (replayMode === "currency") {
    if (liveCurrency.length >= 2) {
      scope = "currency_market";
    } else if (liveCurrency.length === 1) {
      scope = "currency_only";
    } else {
      scope = "none";
    }
    return {
      scope,
      replayMode,
      liveCurrencyTickers: liveCurrency.map((m) => m.ticker),
      liveIndexTicker: null,
      liveStockTickers: [],
      demoSegments: demoCurrency ? ["валюта"] : [],
    };
  }

  if (!hasLive) {
    scope = "none";
  } else if (hasLive && hasDemo) {
    if (replayMode === "derivatives") {
      if (liveCurrency.length > 0 && !indexLive) {
        scope = "currency_only";
      } else {
        scope = "mixed";
      }
    } else if (liveStocks.length > 0 && !indexLive) {
      scope = "mixed";
    } else if (indexLive && liveStocks.length === 0 && demoStocks) {
      scope = "mixed";
    } else if (indexLive && demoStocks) {
      scope = "mixed";
    } else if (indexLive && liveStocks.length > 0 && !demoStocks && !demoIndex) {
      scope = "equities_market";
    } else {
      scope = "mixed";
    }
  } else if (replayMode === "derivatives") {
    if (liveCurrency.length > 0 && indexLive) {
      scope = "derivatives_market";
    } else if (liveCurrency.length > 0) {
      scope = "currency_only";
    } else if (indexLive) {
      scope = "derivatives_market";
    }
  } else if (indexLive && liveStocks.length > 0) {
    scope = "equities_market";
  } else if (indexLive) {
    scope = "equities_market";
  } else if (liveStocks.length > 0) {
    scope = "mixed";
  }

  return {
    scope,
    replayMode,
    liveCurrencyTickers: liveCurrency.map((m) => m.ticker),
    liveIndexTicker: indexLive?.ticker ?? null,
    liveStockTickers: liveStocks.map((m) => m.ticker),
    demoSegments,
  };
}

export function sanitizePatternLabel(
  row: CbrInstrumentReactionMetrics | null,
  peers: CbrInstrumentReactionMetrics[] = [],
): string | null {
  if (!row?.pattern || !row.patternLabel) return row?.patternLabel ?? null;
  if (!patternAllowedForLiveData(row.pattern, row, peers)) return null;
  if (isForbiddenMarketPhrase(row.patternLabel)) return null;
  return row.patternLabel;
}

function buildCurrencyOnlyRead(coverage: CbrReplayLiveCoverage): string {
  const tickers = formatTickerList(coverage.liveCurrencyTickers);
  if (coverage.replayMode === "derivatives") {
    const tail = coverage.demoSegments.includes("фьючерс на индекс")
      ? "Фьючерс на индекс без данных MOEX, вывод по срочному рынку ограничен."
      : "Остальные инструменты без данных MOEX.";
    return `По live-данным доступна только валютная часть replay: ${tickers}. ${tail}`;
  }
  return `По live-данным доступна только валютная часть replay: ${tickers}. Вывод по остальным инструментам отключён.`;
}

function buildPartialLiveRead(coverage: CbrReplayLiveCoverage): string {
  if (coverage.scope === "currency_only") {
    return buildCurrencyOnlyRead(coverage);
  }

  if (coverage.replayMode === "equities") {
    if (coverage.liveIndexTicker && coverage.demoSegments.includes("акции")) {
      return `По live-данным доступен только ${coverage.liveIndexTicker}. Акции без данных MOEX, вывод по рынку акций отключён.`;
    }
    if (coverage.liveStockTickers.length > 0 && coverage.demoSegments.includes("индекс")) {
      return `По live-данным доступны акции (${formatTickerList(coverage.liveStockTickers)}). Индекс без данных MOEX, вывод по рынку акций отключён.`;
    }
  }

  if (coverage.replayMode === "derivatives") {
    if (coverage.liveCurrencyTickers.length > 0 && coverage.demoSegments.includes("фьючерс на индекс")) {
      return buildCurrencyOnlyRead(coverage);
    }
    if (coverage.liveIndexTicker && coverage.demoSegments.includes("валюта")) {
      return `По live-данным доступен только ${coverage.liveIndexTicker}. Валютные фьючерсы без данных MOEX, вывод по срочному рынку ограничен.`;
    }
  }

  const liveParts: string[] = [];
  if (coverage.liveCurrencyTickers.length) {
    liveParts.push(`валюта: ${formatTickerList(coverage.liveCurrencyTickers)}`);
  }
  if (coverage.liveIndexTicker) liveParts.push(`индекс: ${coverage.liveIndexTicker}`);
  if (coverage.liveStockTickers.length) {
    liveParts.push(`акции: ${formatTickerList(coverage.liveStockTickers)}`);
  }

  const demoPart =
    coverage.demoSegments.length > 0
      ? `${coverage.demoSegments.join(", ")} без данных MOEX`
      : "часть инструментов без данных MOEX";

  return `Данные частичные: live — ${liveParts.join("; ") || "нет"}. ${demoPart}. Рыночный вывод отключён.`;
}

function detectBankBeatIndexRead(
  liveMetrics: CbrInstrumentReactionMetrics[],
): string | null {
  const index = liveMetrics.find((m) => m.role === "index");
  const bank = liveMetrics.find((m) => m.role === "bank");
  if (!index || !bank) return null;
  if (!isLiveMetric(index) || !isLiveMetric(bank)) return null;
  if (bank.reactionDayPct == null || index.reactionDayPct == null) return null;
  if (bank.reactionDayPct <= index.reactionDayPct + BANK_BEAT_INDEX_MARGIN_PCT) return null;

  const indexName = index.ticker === "IMOEX" ? "IMOEX" : index.ticker;
  return `${indexName} ${indexVerb(index.reactionDayPct)}, при этом ${bank.ticker} держался лучше индекса. Это точечная сила банка, но не подтверждение широкого спроса на рынок.`;
}

function detectEquityDivergenceRead(
  liveMetrics: CbrInstrumentReactionMetrics[],
): string | null {
  const index = liveMetrics.find((m) => m.role === "index");
  const sber = liveMetrics.find((m) => m.ticker === "SBER" || m.role === "bank");
  const gazp = liveMetrics.find((m) => m.ticker === "GAZP");
  if (!index || !sber || !gazp) return null;
  if (![index, sber, gazp].every(isLiveMetric)) return null;

  const sberUp = (sber.reactionDayPct ?? 0) > MOVE_THRESHOLD_PCT;
  const gazpUp = (gazp.reactionDayPct ?? 0) > MOVE_THRESHOLD_PCT;
  const indexDown = (index.reactionDayPct ?? 0) < -MOVE_THRESHOLD_PCT;
  if (!sberUp || !gazpUp || !indexDown) return null;

  return "Точечный спрос в SBER/GAZP при слабом широком индексе — не равно широкому рыночному ралли.";
}

function buildCurrencyMarketRead(liveMetrics: CbrInstrumentReactionMetrics[]): string | null {
  const currencies = liveMetrics.filter((m) => m.role === "currency");
  if (currencies.length < 2) return null;

  const usd = currencies.find((m) => m.ticker.toUpperCase().includes("USD") || m.ticker.toUpperCase().startsWith("SI"));
  const cny = currencies.find((m) => m.ticker.toUpperCase().includes("CNY") || m.ticker.toUpperCase().startsWith("CR"));
  const lead = currencies.reduce(
    (best, row) => {
      const strength = Math.abs(row.reaction30mPct ?? row.reaction5mPct ?? row.reactionDayPct ?? 0);
      return strength > best.strength ? { row, strength } : best;
    },
    { row: currencies[0]!, strength: 0 },
  );

  if (lead.strength < MOVE_THRESHOLD_PCT) {
    return `По валютным инструментам MOEX (${formatTickerList(currencies.map((c) => c.ticker))}) реакция на решение была слабой.`;
  }

  const runner = currencies.find((c) => c.ticker !== lead.row.ticker);
  if (runner && usd && cny) {
    const sameSign =
      usd.reactionDayPct != null &&
      cny.reactionDayPct != null &&
      Math.sign(usd.reactionDayPct) === Math.sign(cny.reactionDayPct);
    if (sameSign) {
      return `Валютная нога MOEX двигалась согласованно: ${usd.ticker} и ${cny.ticker} дали основной импульс после 13:30.`;
    }
    return `Валютная реакция разошлась: сильнее ${lead.row.ticker}, слабее ${runner.ticker}.`;
  }

  return `Основной валютный импульс по MOEX — ${lead.row.ticker}.`;
}

function buildDerivativesMarketRead(liveMetrics: CbrInstrumentReactionMetrics[]): string | null {
  const currencies = liveMetrics.filter((m) => m.role === "currency");
  const index = liveMetrics.find((m) => m.role === "index");
  if (!currencies.length && !index) return null;

  const currencyLead = currencies.reduce(
    (best, row) => {
      const strength = Math.abs(row.reaction30mPct ?? row.reaction5mPct ?? 0);
      return strength > best.strength ? { row, strength } : best;
    },
    { row: currencies[0]!, strength: 0 },
  );

  const indexStrength = Math.abs(index?.reaction30mPct ?? index?.reaction5mPct ?? 0);

  if (currencyLead.strength >= 0.06 && currencyLead.strength > indexStrength * 1.35) {
    return `Основной ход по live-данным — валютные фьючерсы (${formatTickerList(currencies.map((c) => c.ticker))}); фьючерс на индекс отставал.`;
  }
  if (index && indexStrength >= 0.06 && indexStrength > currencyLead.strength * 1.35) {
    return `Основной ход по live-данным — фьючерс на индекс (${index.ticker}); валютная нога отставала.`;
  }
  if (currencies.length && index) {
    return `По live-данным срочного рынка реакция распределилась между ${formatTickerList(currencies.map((c) => c.ticker))} и ${index.ticker}.`;
  }
  return null;
}

function buildEquitiesMarketRead(liveMetrics: CbrInstrumentReactionMetrics[]): string | null {
  const bankBeat = detectBankBeatIndexRead(liveMetrics);
  if (bankBeat) return bankBeat;

  const divergence = detectEquityDivergenceRead(liveMetrics);
  if (divergence) return divergence;

  const index = liveMetrics.find((m) => m.role === "index");
  const stocks = liveMetrics.filter(
    (m) => m.role === "bank" || m.role === "heavy" || m.role === "active",
  );
  if (!index || !stocks.length) return null;

  const stockLead = stocks.reduce(
    (best, row) => {
      const strength = Math.abs(row.reaction30mPct ?? row.reaction5mPct ?? 0);
      return strength > best.strength ? { row, strength } : best;
    },
    { row: stocks[0]!, strength: 0 },
  );
  const indexStrength = Math.abs(index.reaction30mPct ?? index.reaction5mPct ?? 0);

  if (stockLead.strength >= 0.06 && stockLead.strength > indexStrength * 1.35) {
    return `${stockLead.row.ticker} дал основной импульс среди live-акций; ${index.ticker} двигался слабее.`;
  }
  if (indexStrength >= 0.06 && indexStrength > stockLead.strength * 1.35) {
    return `Основной ход по live-данным — ${index.ticker}; отдельные акции отставали.`;
  }

  return `По live-данным рынка акций реакция распределилась между ${index.ticker} и ${formatTickerList(stocks.map((s) => s.ticker))} без явного лидера.`;
}

export function buildConstrainedMarketReaction(
  event: CbrRateEvent,
  allMetrics: CbrInstrumentReactionMetrics[],
  liveMetrics: CbrInstrumentReactionMetrics[],
  replayMode: CbrReplayMarketMode,
  consistency?: Pick<
    CbrReplayConsistencyResult,
    "status" | "equityDivergenceRead" | "constraints"
  > | null,
): string {
  if (event.status === "upcoming") {
    return "Выберите прошедшее заседание для чтения реакции по графикам.";
  }

  const hasMetrics = allMetrics.some(
    (m) =>
      m.reaction5mPct != null ||
      m.reaction30mPct != null ||
      m.reactionPostPressPct != null ||
      m.reactionDayPct != null,
  );
  if (!hasMetrics) {
    return "Нет данных по свечам — вывод по реакции не делаем.";
  }

  if (liveMetrics.length < 2) {
    if (liveMetrics.length === 0) {
      return "Нет live-данных MOEX — рыночный вывод отключён.";
    }
    return "Недостаточно данных MOEX для рыночного вывода (нужно ≥ 2 инструмента).";
  }

  const coverage = analyzeReplayLiveCoverage(allMetrics, replayMode);

  if (consistency?.status === "demo_mixed" && coverage.scope === "mixed") {
    return buildPartialLiveRead(coverage);
  }

  if (consistency?.equityDivergenceRead) {
    if (consistency.equityDivergenceRead.includes("demo")) {
      return "Расхождение SBER/GAZP и индекса не анализируется: часть данных без MOEX.";
    }
    return "Точечный спрос в SBER/GAZP при слабом широком индексе — не равно широкому рыночному ралли.";
  }

  if (coverage.scope === "mixed") {
    return buildPartialLiveRead(coverage);
  }

  if (coverage.scope === "currency_only") {
    return buildCurrencyOnlyRead(coverage);
  }

  if (replayMode === "currency" && coverage.scope === "currency_market") {
    return (
      buildCurrencyMarketRead(liveMetrics) ??
      "Реакция по валютным инструментам MOEX была слабой и разнонаправленной."
    );
  }

  if (replayMode === "currency") {
    return buildPartialLiveRead(coverage);
  }

  if (coverage.scope === "none") {
    return "Нет live-данных MOEX — рыночный вывод отключён.";
  }

  if (replayMode === "equities" && coverage.scope === "equities_market") {
    return buildEquitiesMarketRead(liveMetrics) ?? "Реакция по live-акциям была слабой и разнонаправленной.";
  }

  if (replayMode === "derivatives" && coverage.scope === "derivatives_market") {
    return (
      buildDerivativesMarketRead(liveMetrics) ??
      "Реакция по live-инструментам срочного рынка была слабой и разнонаправленной."
    );
  }

  return buildPartialLiveRead(coverage);
}

export function buildConstrainedConfirmation(
  event: CbrRateEvent,
  allMetrics: CbrInstrumentReactionMetrics[],
  liveMetrics: CbrInstrumentReactionMetrics[],
  replayMode: CbrReplayMarketMode,
  consistency?: Pick<CbrReplayConsistencyResult, "status"> | null,
): string {
  const coverage = analyzeReplayLiveCoverage(allMetrics, replayMode);

  if (liveMetrics.length < 2) {
    return "Подтверждение по рынку не строим — недостаточно данных MOEX (нужно ≥ 2 инструмента).";
  }

  if (consistency?.status === "demo_mixed" && coverage.scope === "mixed") {
    return "Подтверждение по рынку не строим — live-данные не покрывают весь выбранный режим.";
  }

  if (coverage.scope === "mixed" || coverage.scope === "currency_only" || coverage.scope === "none") {
    return "Подтверждение по рынку не строим — live-данные не покрывают весь выбранный режим.";
  }

  if (replayMode === "currency" && coverage.scope === "currency_market") {
    const currencies = liveMetrics.filter((m) => m.role === "currency");
    const confirmed = currencies.filter(
      (r) =>
        r.reaction30mPct != null &&
        r.reactionPostPressPct != null &&
        Math.sign(r.reaction30mPct) === Math.sign(r.reactionPostPressPct) &&
        Math.abs(r.reactionPostPressPct) >= 0.06,
    );
    if (confirmed.length > 0) {
      const tickers = confirmed.map((r) => r.ticker).slice(0, 2).join(", ");
      return `Валютный импульс 13:30 частично удержался после 15:00 (${tickers}).`;
    }
    return "После 15:00 валютная картина по MOEX смешанная.";
  }

  if (replayMode === "currency") {
    return "Подтверждение по валюте не строим — недостаточно live-данных MOEX.";
  }

  const candidates = liveMetrics.filter(
    (r) => r.reaction30mPct != null && r.reactionPostPressPct != null,
  );
  if (!candidates.length) {
    return "После 15:00 live-данных по свечам нет — удержание импульса не оцениваем.";
  }

  const meaningful = candidates.filter(
    (r) =>
      Math.abs(r.reaction30mPct ?? 0) >= 0.06 || Math.abs(r.reactionPostPressPct ?? 0) >= 0.06,
  );
  if (!meaningful.length) {
    return "После 15:00 движение по live-инструментам было слабым.";
  }

  const confirmed = meaningful.filter(
    (r) =>
      r.reaction30mPct != null &&
      r.reactionPostPressPct != null &&
      Math.sign(r.reaction30mPct) === Math.sign(r.reactionPostPressPct) &&
      Math.abs(r.reactionPostPressPct) >= 0.06,
  );

  if (confirmed.length > 0) {
    const tickers = confirmed.map((r) => r.ticker).slice(0, 2).join(", ");
    return `Импульс 13:30 частично подтвердился после 15:00 по live-данным${tickers ? ` (${tickers})` : ""}.`;
  }

  return "После 15:00 картина по live-инструментам смешанная.";
}

/** Паттерны матрицы, которые нельзя показывать без live-участников. */
export function matrixPatternLabel(
  row: CbrInstrumentReactionMetrics | null,
  allRows: CbrInstrumentReactionMetrics[],
): string | null {
  if (!row?.patternLabel) return null;
  const sanitized = sanitizePatternLabel(row, allRows);
  if (sanitized) return sanitized;
  if (row.pattern && CBR_REACTION_PATTERN_LABELS[row.pattern]) {
    if (!patternAllowedForLiveData(row.pattern, row, allRows)) return null;
  }
  return null;
}
