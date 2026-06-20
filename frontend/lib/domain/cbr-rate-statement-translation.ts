/**
 * CBR official statement → trader briefing translation.
 * Data source: mock/manual for now; official URL later.
 */

import type { CbrRateEvent } from "@/lib/domain/cbr-rate-events";

export type CbrStatementSource = "mock" | "manual" | "official";

export const CBR_STATEMENT_SOURCE_LABELS: Record<CbrStatementSource, string> = {
  mock: "mock · учебный",
  manual: "вручную",
  official: "cbr.ru",
};

export type CbrWatchlistImpactSlot =
  | "rub-futures"
  | "cny-rub"
  | "imoex-spot"
  | "imoex-futures"
  | "banks"
  | "exporters"
  | "bonds";

export const CBR_WATCHLIST_IMPACT_LABELS: Record<CbrWatchlistImpactSlot, string> = {
  "rub-futures": "RUB futures",
  "cny-rub": "CNY/RUB",
  "imoex-spot": "IMOEX (индекс)",
  "imoex-futures": "MX (фьючерс)",
  banks: "Banks",
  exporters: "Exporters",
  bonds: "Bonds",
};

export const CBR_WATCHLIST_IMPACT_TICKERS: Record<CbrWatchlistImpactSlot, string> = {
  "rub-futures": "Si",
  "cny-rub": "CNY",
  "imoex-spot": "IMOEX",
  "imoex-futures": "MX",
  banks: "SBER",
  exporters: "GAZP",
  bonds: "RGBI",
};

export const CBR_WATCHLIST_IMPACT_SLOTS: CbrWatchlistImpactSlot[] = [
  "imoex-spot",
  "banks",
  "exporters",
  "bonds",
  "rub-futures",
  "cny-rub",
  "imoex-futures",
];

export type CbrStatementPhraseBrief = {
  /** Цитата или пересказ формулировки ЦБ. */
  officialPhrase: string;
  /** Что это значит для трейдера — без прогноза цены. */
  marketTranslation: string;
  /** Где смотреть реакцию: слот → короткая подсказка. */
  watchlistImpacts: Partial<Record<CbrWatchlistImpactSlot, string>>;
};

export type CbrStatementBrief = {
  source: CbrStatementSource;
  /** Официальный URL пресс-релиза — для будущего ingest. */
  statementUrl: string | null;
  phrases: CbrStatementPhraseBrief[];
};

export type CbrStatementBriefView = CbrStatementBrief & {
  sourceLabel: string;
  hasPhrases: boolean;
  isUpcoming: boolean;
};

export function buildStatementBriefView(event: CbrRateEvent): CbrStatementBriefView {
  const brief = event.statementBrief;
  const source = brief?.source ?? "mock";

  return {
    source,
    sourceLabel: CBR_STATEMENT_SOURCE_LABELS[source],
    statementUrl: brief?.statementUrl ?? event.statementUrl,
    phrases: brief?.phrases ?? [],
    hasPhrases: (brief?.phrases.length ?? 0) > 0,
    isUpcoming: event.status === "upcoming",
  };
}

export function collectWatchlistImpactsForPhrase(
  phrase: CbrStatementPhraseBrief,
): Array<{ slot: CbrWatchlistImpactSlot; label: string; ticker: string; read: string }> {
  return CBR_WATCHLIST_IMPACT_SLOTS.filter((slot) => phrase.watchlistImpacts[slot])
    .map((slot) => ({
      slot,
      label: CBR_WATCHLIST_IMPACT_LABELS[slot],
      ticker: CBR_WATCHLIST_IMPACT_TICKERS[slot],
      read: phrase.watchlistImpacts[slot]!,
    }));
}
