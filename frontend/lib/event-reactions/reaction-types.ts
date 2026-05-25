/** Event Reaction Lab — shared types (mirrors Prisma enums + API shapes) */

export type NewsSourceType =
  | "markettwits"
  | "telegram_manual"
  | "moex"
  | "smartlab"
  | "broker"
  | "cbr"
  | "rosstat"
  | "manual"
  | "other";

export type NewsSourceStatus = "active" | "planned" | "manual" | "experimental" | "broken";

export type NewsSourceTrustLevel = "primary" | "secondary" | "noisy" | "manual";

export type RawNewsItemStatus = "raw" | "parsed" | "linked" | "analyzed" | "ignored" | "error";

export type MarketEventType =
  | "dividend"
  | "earnings"
  | "guidance"
  | "buyback"
  | "sanction"
  | "rate"
  | "inflation"
  | "oil"
  | "gas"
  | "currency"
  | "geopolitics"
  | "forum"
  | "expiry"
  | "technical"
  | "other";

export type EventImportance = "low" | "medium" | "high" | "critical";

export type SurpriseLevel = "low" | "medium" | "high" | "unknown";

export type InstrumentMarket = "stock" | "future" | "currency" | "index" | "commodity" | "other";

export type RelationType = "direct" | "sector" | "macro" | "derivative" | "watch";

export type ExpectedDirection = "bullish" | "bearish" | "mixed" | "unknown";

export type ReactionWindowKey =
  | "pre_15m"
  | "pre_5m"
  | "plus_1m"
  | "plus_2m"
  | "plus_5m"
  | "plus_15m"
  | "plus_30m"
  | "plus_40m"
  | "plus_1d"
  | "plus_3d"
  | "planned_plus_5s"
  | "planned_plus_30s";

export type ReactionDataStatus = "ok" | "partial" | "no_data" | "planned_tick_data";

export type FindingSeverity = "info" | "watch" | "important" | "critical";

export type NewsSourceDto = {
  id: string;
  title: string;
  sourceType: NewsSourceType;
  url: string | null;
  status: NewsSourceStatus;
  trustLevel: NewsSourceTrustLevel;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RawNewsItemDto = {
  id: string;
  sourceId: string | null;
  sourceTitle: string | null;
  externalId: string | null;
  sourceUrl: string | null;
  title: string | null;
  text: string;
  publishedAt: string | null;
  ingestedAt: string;
  status: RawNewsItemStatus;
  createdAt: string;
};

export type EventInstrumentLinkDto = {
  id: string;
  ticker: string;
  secid: string | null;
  market: InstrumentMarket;
  relationType: RelationType;
  expectedDirection: ExpectedDirection;
  reason: string | null;
  confidence: number | null;
};

export type MarketEventDto = {
  id: string;
  rawNewsItemId: string | null;
  title: string;
  summary: string | null;
  eventTime: string;
  eventType: MarketEventType;
  isScheduled: boolean;
  importance: EventImportance;
  surpriseLevel: SurpriseLevel;
  marketRegime: string | null;
  parsedJson: Record<string, unknown> | null;
  confidence: number | null;
  instrumentLinks: EventInstrumentLinkDto[];
  createdAt: string;
};

export type EventReactionDto = {
  id: string;
  eventId: string;
  ticker: string;
  window: ReactionWindowKey;
  windowLabel: string;
  basePrice: number | null;
  endPrice: number | null;
  priceChangePct: number | null;
  highAfterPct: number | null;
  lowAfterPct: number | null;
  rangePct: number | null;
  turnover: number | null;
  volume: number | null;
  trades: number | null;
  turnoverVsNormal: number | null;
  volumeVsNormal: number | null;
  tradesVsNormal: number | null;
  reactionScore: number | null;
  interpretation: string | null;
  dataStatus: ReactionDataStatus;
};

export type EventReactionFindingDto = {
  id: string;
  eventId: string | null;
  ticker: string | null;
  title: string;
  body: string;
  severity: FindingSeverity;
  confidence: number | null;
  createdAt: string;
};

export type ParseNewsResult = {
  rawNewsItemId: string;
  event: MarketEventDto;
  parser: "rule-based-stub";
  note: string;
};

export type AnalyzeResult = {
  eventId: string;
  reactions: EventReactionDto[];
  findings: EventReactionFindingDto[];
  dataStatus: ReactionDataStatus;
  note: string;
};

export const EVENT_TYPE_LABELS: Record<MarketEventType, string> = {
  dividend: "Дивиденды",
  earnings: "Отчётность",
  guidance: "Прогноз / guidance",
  buyback: "Buyback",
  sanction: "Санкции",
  rate: "Ставка ЦБ",
  inflation: "Инфляция",
  oil: "Нефть",
  gas: "Газ",
  currency: "Валюта",
  geopolitics: "Геополитика",
  forum: "Форум / конференция",
  expiry: "Экспирация",
  technical: "Техническое",
  other: "Другое",
};

export const IMPORTANCE_LABELS: Record<EventImportance, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

export const DIRECTION_LABELS: Record<ExpectedDirection, string> = {
  bullish: "Бычье",
  bearish: "Медвежье",
  mixed: "Смешанное",
  unknown: "Неизвестно",
};
