import type {
  EventImportance,
  ExpectedDirection,
  InstrumentMarket,
  MarketEventType,
  RelationType,
  SurpriseLevel,
} from "@/lib/event-reactions/reaction-types";

export type ParsedTicker = {
  ticker: string;
  market: InstrumentMarket;
  relationType: RelationType;
  expectedDirection: ExpectedDirection;
  reason: string;
  confidence: number;
};

export type ParsedEventStub = {
  title: string;
  summary: string;
  eventType: MarketEventType;
  isScheduled: boolean;
  importance: EventImportance;
  surpriseLevel: SurpriseLevel;
  tickers: ParsedTicker[];
  confidence: number;
  parsedJson: Record<string, unknown>;
};

const TICKER_PATTERN = /\b([A-ZА-Я]{2,6})\b(?:\s*\(([A-Z]{2,6})\))?/g;

const KNOWN_TICKERS = new Set([
  "SBER", "GAZP", "LKOH", "ROSN", "GMKN", "NVTK", "TATN", "PLZL", "YNDX",
  "VTBR", "MGNT", "ALRS", "CHMF", "NLMK", "MTSS", "MOEX", "IRAO", "PHOR",
  "Si", "RI", "BR", "GD", "SR", "MX", "CNY",
]);

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function detectEventType(text: string): MarketEventType {
  const lower = text.toLowerCase();

  if (/дивиденд/i.test(lower)) return "dividend";
  if (/отч[её]т|мсфо|рсбу|выручк|ebitda|чист(?:ая|ый)\s+прибыл/i.test(lower)) return "earnings";
  if (/guidance|прогноз\s+компан|обновил\s+прогноз/i.test(lower)) return "guidance";
  if (/buyback|обратн(?:ый|ая)\s+выкуп/i.test(lower)) return "buyback";
  if (/санкц/i.test(lower)) return "sanction";
  if (/цб|центральн(?:ый|ого)\s+банк|ключев(?:ая|ую)\s+ставк|ставк[аи]\s+цб/i.test(lower)) return "rate";
  if (/инфляц/i.test(lower)) return "inflation";
  if (/нефт|brent|urals/i.test(lower)) return "oil";
  if (/\bгаз\b|gazprom/i.test(lower)) return "gas";
  if (/рубл|доллар|юан|usd\/rub|usdrub|cny/i.test(lower)) return "currency";
  if (/геополит|конфликт|переговор/i.test(lower)) return "geopolitics";
  if (/форум|конференц|invest\s+day/i.test(lower)) return "forum";
  if (/экспирац|rollover/i.test(lower)) return "expiry";
  if (/технич|пробой|уровн/i.test(lower)) return "technical";

  return "other";
}

function detectImportance(text: string, eventType: MarketEventType): EventImportance {
  const lower = text.toLowerCase();
  if (/срочно|экстрен|критич|обвал|крах|default/i.test(lower)) return "critical";
  if (/важн|ключев|решени[ея]\s+цб|ставк[аи]/i.test(lower)) return "high";
  if (eventType === "rate" || eventType === "sanction" || eventType === "earnings") return "high";
  if (/наблюден|фон|комментар/i.test(lower)) return "low";
  return "medium";
}

function detectScheduled(text: string): boolean {
  const lower = text.toLowerCase();
  return /запланир|календар|ожида(?:ется|ют)|по\s+графику|scheduled|consensus/i.test(lower);
}

function detectSurprise(text: string): SurpriseLevel {
  const lower = text.toLowerCase();
  if (/неожидан|внезапн|шок|surprise|выше\s+ожидан|ниже\s+ожидан/i.test(lower)) return "high";
  if (/в\s+линии\s+с\s+ожидан|ожидаем|consensus/i.test(lower)) return "low";
  return "unknown";
}

function inferDirection(text: string, eventType: MarketEventType): ExpectedDirection {
  const lower = text.toLowerCase();
  const bullish = /рост|повыш|улучш|рекорд|buy|long|позитив|выше\s+ожидан|снижени[ея]\s+ставк/i.test(lower);
  const bearish = /падени|снижен|ухудш|sell|short|негатив|ниже\s+ожидан|повышени[ея]\s+ставк|санкц/i.test(lower);

  if (bullish && bearish) return "mixed";
  if (bullish) return "bullish";
  if (bearish) return "bearish";

  if (eventType === "sanction") return "bearish";
  if (eventType === "rate") return "mixed";
  return "unknown";
}

function inferMarket(ticker: string): InstrumentMarket {
  const upper = ticker.toUpperCase();
  if (["SI", "CNY", "ED", "EU"].includes(upper)) return "currency";
  if (["RI", "MX", "BR", "GD", "SR"].includes(upper)) return "future";
  if (["IMOEX", "RTSI"].includes(upper)) return "index";
  return "stock";
}

function extractTickers(text: string): ParsedTicker[] {
  const found = new Map<string, ParsedTicker>();
  const direction = inferDirection(text, detectEventType(text));

  let match: RegExpExecArray | null;
  const re = new RegExp(TICKER_PATTERN.source, TICKER_PATTERN.flags);
  while ((match = re.exec(text)) !== null) {
    const candidate = (match[2] ?? match[1]).toUpperCase();
    if (!KNOWN_TICKERS.has(candidate) && candidate.length < 3) continue;
    if (found.has(candidate)) continue;

    found.set(candidate, {
      ticker: candidate,
      market: inferMarket(candidate),
      relationType: "direct",
      expectedDirection: direction,
      reason: "Явно указан в тексте новости",
      confidence: 0.75,
    });
  }

  // Macro events without explicit tickers — suggest watchlist proxies
  const eventType = detectEventType(text);
  if (found.size === 0) {
    const macroMap: Partial<Record<MarketEventType, ParsedTicker[]>> = {
      rate: [{ ticker: "SI", market: "future", relationType: "macro", expectedDirection: direction, reason: "Прокси ставки / USD", confidence: 0.4 }],
      oil: [{ ticker: "BR", market: "future", relationType: "macro", expectedDirection: direction, reason: "Прокси нефти Brent", confidence: 0.4 }],
      currency: [{ ticker: "SI", market: "future", relationType: "macro", expectedDirection: direction, reason: "Валютный прокси", confidence: 0.4 }],
      inflation: [{ ticker: "MX", market: "future", relationType: "macro", expectedDirection: direction, reason: "Индексный прокси", confidence: 0.35 }],
    };
    for (const t of macroMap[eventType] ?? []) {
      found.set(t.ticker, t);
    }
  }

  return [...found.values()];
}

function buildTitle(text: string): string {
  const firstLine = text.split(/[\n.!?]/)[0]?.trim() ?? text;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
}

/**
 * Rule-based parser stub — no OpenAI.
 * Later: replace with AI parser returning structured JSON.
 */
export function parseNewsTextStub(text: string, publishedAt?: Date | null): ParsedEventStub {
  const normalized = normalizeText(text);
  const eventType = detectEventType(normalized);
  const importance = detectImportance(normalized, eventType);
  const isScheduled = detectScheduled(normalized);
  const surpriseLevel = detectSurprise(normalized);
  const tickers = extractTickers(normalized);
  const confidence = tickers.length > 0 ? 0.55 + tickers[0]!.confidence * 0.3 : 0.35;

  return {
    title: buildTitle(normalized),
    summary: normalized.length > 280 ? `${normalized.slice(0, 277)}…` : normalized,
    eventType,
    isScheduled,
    importance,
    surpriseLevel,
    tickers,
    confidence: Math.min(confidence, 0.95),
    parsedJson: {
      parser: "rule-based-stub-v1",
      parserVersion: 1,
      eventType,
      importance,
      isScheduled,
      surpriseLevel,
      tickers,
      publishedAt: publishedAt?.toISOString() ?? null,
      futureNote: "AI structured parser planned — OpenAI not used in v1",
    },
  };
}
