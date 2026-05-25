import { createHash } from "node:crypto";
import type {
  AnalyzeResult,
  EventReactionDto,
  EventReactionFindingDto,
  MarketEventDto,
  NewsSourceDto,
  ParseNewsResult,
  RawNewsItemDto,
  ReactionDataStatus,
  ReactionWindowKey,
} from "@/lib/event-reactions/reaction-types";
import { parseNewsTextStub } from "@/lib/event-reactions/event-parser-stub";
import { getAnalyzableWindows, getWindowLabel } from "@/lib/event-reactions/reaction-windows";
import { db } from "@/lib/server/db";
import type {
  EventInstrumentLink,
  MarketEvent,
  NewsSource,
  RawNewsItem,
  EventReactionFinding,
  ReactionWindow,
} from "@prisma/client";

const DEFAULT_SOURCES: Array<{
  title: string;
  sourceType: NewsSource["sourceType"];
  url?: string;
  status: NewsSource["status"];
  trustLevel: NewsSource["trustLevel"];
  note?: string;
}> = [
  {
    title: "Ручной ввод",
    sourceType: "manual",
    status: "manual",
    trustLevel: "manual",
    note: "Новости, вставленные вручную на странице Event Reaction Lab",
  },
  {
    title: "MarketTwits",
    sourceType: "markettwits",
    url: "https://markettwits.com",
    status: "planned",
    trustLevel: "secondary",
    note: "Автоимпорт не подключён — пока только ручной paste",
  },
  {
    title: "Smart-Lab",
    sourceType: "smartlab",
    url: "https://smart-lab.ru",
    status: "experimental",
    trustLevel: "secondary",
    note: "Экспериментальный источник — без автоскрейпинга",
  },
  {
    title: "MOEX",
    sourceType: "moex",
    url: "https://www.moex.com",
    status: "planned",
    trustLevel: "primary",
    note: "Официальные корпоративные события — позже",
  },
];

function hashContent(text: string, sourceUrl?: string | null, publishedAt?: Date | null): string {
  const payload = `${text.trim()}|${sourceUrl ?? ""}|${publishedAt?.toISOString() ?? ""}`;
  return createHash("sha256").update(payload).digest("hex");
}

function parseJsonField(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toNewsSourceDto(row: NewsSource): NewsSourceDto {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.sourceType,
    url: row.url,
    status: row.status,
    trustLevel: row.trustLevel,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRawNewsItemDto(row: RawNewsItem & { source?: NewsSource | null }): RawNewsItemDto {
  return {
    id: row.id,
    sourceId: row.sourceId,
    sourceTitle: row.source?.title ?? null,
    externalId: row.externalId,
    sourceUrl: row.sourceUrl,
    title: row.title,
    text: row.text,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    ingestedAt: row.ingestedAt.toISOString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMarketEventDto(
  row: MarketEvent & { instrumentLinks?: EventInstrumentLink[] },
): MarketEventDto {
  return {
    id: row.id,
    rawNewsItemId: row.rawNewsItemId,
    title: row.title,
    summary: row.summary,
    eventTime: row.eventTime.toISOString(),
    eventType: row.eventType,
    isScheduled: row.isScheduled,
    importance: row.importance,
    surpriseLevel: row.surpriseLevel,
    marketRegime: row.marketRegime,
    parsedJson: parseJsonField(row.parsedJson),
    confidence: row.confidence,
    instrumentLinks: (row.instrumentLinks ?? []).map((link) => ({
      id: link.id,
      ticker: link.ticker,
      secid: link.secid,
      market: link.market,
      relationType: link.relationType,
      expectedDirection: link.expectedDirection,
      reason: link.reason,
      confidence: link.confidence,
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

function toFindingDto(row: EventReactionFinding): EventReactionFindingDto {
  return {
    id: row.id,
    eventId: row.eventId,
    ticker: row.ticker,
    title: row.title,
    body: row.body,
    severity: row.severity,
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
  };
}

async function ensureDefaultSources(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const count = await db.newsSource.count();
  if (count > 0) return;
  await db.newsSource.createMany({
    data: DEFAULT_SOURCES,
  });
}

export async function listNewsSources(): Promise<NewsSourceDto[]> {
  if (!process.env.DATABASE_URL) return DEFAULT_SOURCES.map((s, i) => ({
    id: `fallback-${i}`,
    title: s.title,
    sourceType: s.sourceType,
    url: s.url ?? null,
    status: s.status,
    trustLevel: s.trustLevel,
    note: s.note ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  await ensureDefaultSources();
  const rows = await db.newsSource.findMany({ orderBy: { title: "asc" } });
  return rows.map(toNewsSourceDto);
}

export async function listRawNewsItems(limit = 20): Promise<RawNewsItemDto[]> {
  if (!process.env.DATABASE_URL) return [];
  const rows = await db.rawNewsItem.findMany({
    include: { source: true },
    orderBy: { ingestedAt: "desc" },
    take: limit,
  });
  return rows.map(toRawNewsItemDto);
}

export async function listMarketEvents(limit = 20): Promise<MarketEventDto[]> {
  if (!process.env.DATABASE_URL) return [];
  const rows = await db.marketEvent.findMany({
    include: { instrumentLinks: true },
    orderBy: { eventTime: "desc" },
    take: limit,
  });
  return rows.map(toMarketEventDto);
}

export async function listFindings(limit = 30): Promise<EventReactionFindingDto[]> {
  if (!process.env.DATABASE_URL) return [];
  const rows = await db.eventReactionFinding.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toFindingDto);
}

export type ManualNewsInput = {
  sourceId?: string | null;
  sourceUrl?: string | null;
  title?: string | null;
  text: string;
  publishedAt?: string | null;
};

export async function saveManualNews(input: ManualNewsInput): Promise<RawNewsItemDto> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL не настроен — локальная SQLite недоступна");
  }

  const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
  const contentHash = hashContent(input.text, input.sourceUrl, publishedAt);

  const existing = await db.rawNewsItem.findUnique({ where: { contentHash } });
  if (existing) {
    const withSource = await db.rawNewsItem.findUnique({
      where: { id: existing.id },
      include: { source: true },
    });
    return toRawNewsItemDto(withSource!);
  }

  let sourceId = input.sourceId ?? null;
  if (!sourceId) {
    await ensureDefaultSources();
    const manual = await db.newsSource.findFirst({ where: { sourceType: "manual" } });
    sourceId = manual?.id ?? null;
  }

  const row = await db.rawNewsItem.create({
    data: {
      sourceId,
      sourceUrl: input.sourceUrl ?? null,
      title: input.title ?? null,
      text: input.text.trim(),
      publishedAt,
      contentHash,
      status: "raw",
    },
    include: { source: true },
  });

  return toRawNewsItemDto(row);
}

export async function parseNewsItem(rawNewsItemId: string): Promise<ParseNewsResult> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL не настроен");
  }

  const raw = await db.rawNewsItem.findUnique({ where: { id: rawNewsItemId } });
  if (!raw) throw new Error("Новость не найдена");

  const parsed = parseNewsTextStub(raw.text, raw.publishedAt ?? raw.ingestedAt);
  const eventTime = raw.publishedAt ?? raw.ingestedAt;

  const event = await db.$transaction(async (tx) => {
    const created = await tx.marketEvent.create({
      data: {
        rawNewsItemId: raw.id,
        title: parsed.title,
        summary: parsed.summary,
        eventTime,
        eventType: parsed.eventType,
        isScheduled: parsed.isScheduled,
        importance: parsed.importance,
        surpriseLevel: parsed.surpriseLevel,
        parsedJson: JSON.stringify(parsed.parsedJson),
        confidence: parsed.confidence,
        instrumentLinks: {
          create: parsed.tickers.map((t) => ({
            ticker: t.ticker,
            market: t.market,
            relationType: t.relationType,
            expectedDirection: t.expectedDirection,
            reason: t.reason,
            confidence: t.confidence,
          })),
        },
      },
      include: { instrumentLinks: true },
    });

    await tx.rawNewsItem.update({
      where: { id: raw.id },
      data: { status: parsed.tickers.length > 0 ? "linked" : "parsed" },
    });

    return created;
  });

  return {
    rawNewsItemId: raw.id,
    event: toMarketEventDto(event),
    parser: "rule-based-stub",
    note: "Rule-based stub без OpenAI. Добавьте тикеры явно в текст для лучшего разбора.",
  };
}

function stubReactionRow(
  eventId: string,
  ticker: string,
  market: EventInstrumentLink["market"],
  window: ReactionWindow,
): EventReactionDto {
  const key = window as ReactionWindowKey;
  return {
    id: `stub-${eventId}-${ticker}-${window}`,
    eventId,
    ticker,
    window: key,
    windowLabel: getWindowLabel(key),
    basePrice: null,
    endPrice: null,
    priceChangePct: null,
    highAfterPct: null,
    lowAfterPct: null,
    rangePct: null,
    turnover: null,
    volume: null,
    trades: null,
    turnoverVsNormal: null,
    volumeVsNormal: null,
    tradesVsNormal: null,
    reactionScore: null,
    interpretation: null,
    dataStatus: "no_data",
  };
}

export async function analyzeEventReactions(eventId: string): Promise<AnalyzeResult> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL не настроен");
  }

  const event = await db.marketEvent.findUnique({
    where: { id: eventId },
    include: { instrumentLinks: true },
  });
  if (!event) throw new Error("Событие не найдено");

  const windows = getAnalyzableWindows();
  const reactions: EventReactionDto[] = [];

  for (const link of event.instrumentLinks) {
    for (const win of windows) {
      const prismaWindow = win.key as ReactionWindow;
      const existing = await db.eventReaction.findUnique({
        where: {
          eventId_ticker_window: {
            eventId: event.id,
            ticker: link.ticker,
            window: prismaWindow,
          },
        },
      });

      if (existing) {
        reactions.push({
          id: existing.id,
          eventId: existing.eventId,
          ticker: existing.ticker,
          window: existing.window as ReactionWindowKey,
          windowLabel: getWindowLabel(existing.window as ReactionWindowKey),
          basePrice: existing.basePrice,
          endPrice: existing.endPrice,
          priceChangePct: existing.priceChangePct,
          highAfterPct: existing.highAfterPct,
          lowAfterPct: existing.lowAfterPct,
          rangePct: existing.rangePct,
          turnover: existing.turnover,
          volume: existing.volume,
          trades: existing.trades,
          turnoverVsNormal: existing.turnoverVsNormal,
          volumeVsNormal: existing.volumeVsNormal,
          tradesVsNormal: existing.tradesVsNormal,
          reactionScore: existing.reactionScore,
          interpretation: existing.interpretation,
          dataStatus: existing.dataStatus as ReactionDataStatus,
        });
        continue;
      }

      // v1: no minute bar loader — honest no_data placeholders
      const created = await db.eventReaction.create({
        data: {
          eventId: event.id,
          ticker: link.ticker,
          market: link.market,
          window: prismaWindow,
          dataStatus: "no_data",
          interpretation: "Пока нет минутных свечей для расчёта. Подключите ingest intraday на этапе 2.",
        },
      });

      reactions.push({
        id: created.id,
        eventId: created.eventId,
        ticker: created.ticker,
        window: created.window as ReactionWindowKey,
        windowLabel: getWindowLabel(created.window as ReactionWindowKey),
        basePrice: null,
        endPrice: null,
        priceChangePct: null,
        highAfterPct: null,
        lowAfterPct: null,
        rangePct: null,
        turnover: null,
        volume: null,
        trades: null,
        turnoverVsNormal: null,
        volumeVsNormal: null,
        tradesVsNormal: null,
        reactionScore: null,
        interpretation: created.interpretation,
        dataStatus: "no_data",
      });
    }
  }

  const findings: EventReactionFindingDto[] = [];

  if (event.instrumentLinks.length === 0) {
    const finding = await db.eventReactionFinding.create({
      data: {
        eventId: event.id,
        title: "Нет привязанных тикеров",
        body: "Добавьте новость и укажите тикеры явно в тексте (например SBER, GAZP).",
        severity: "watch",
        confidence: 0.9,
      },
    });
    findings.push(toFindingDto(finding));
  } else {
    const finding = await db.eventReactionFinding.create({
      data: {
        eventId: event.id,
        title: "Рыночные данные не подключены",
        body: "Пока нет рыночных данных для расчёта реакции. Заготовки окон созданы со статусом no_data.",
        severity: "info",
        confidence: 1,
      },
    });
    findings.push(toFindingDto(finding));
  }

  if (event.rawNewsItemId) {
    await db.rawNewsItem.update({
      where: { id: event.rawNewsItemId },
      data: { status: "analyzed" },
    });
  }

  await db.marketEvent.update({
    where: { id: event.id },
    data: { updatedAt: new Date() },
  });

  return {
    eventId: event.id,
    reactions,
    findings,
    dataStatus: "no_data",
    note: "Analyze v1: созданы заготовки окон без фейковых цен. Этап 2 — минутные свечи MOEX ISS.",
  };
}

export async function getEventWithReactions(eventId: string): Promise<{
  event: MarketEventDto;
  reactions: EventReactionDto[];
} | null> {
  if (!process.env.DATABASE_URL) return null;

  const event = await db.marketEvent.findUnique({
    where: { id: eventId },
    include: { instrumentLinks: true },
  });
  if (!event) return null;

  const reactionRows = await db.eventReaction.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });

  const reactions: EventReactionDto[] = reactionRows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    ticker: r.ticker,
    window: r.window as ReactionWindowKey,
    windowLabel: getWindowLabel(r.window as ReactionWindowKey),
    basePrice: r.basePrice,
    endPrice: r.endPrice,
    priceChangePct: r.priceChangePct,
    highAfterPct: r.highAfterPct,
    lowAfterPct: r.lowAfterPct,
    rangePct: r.rangePct,
    turnover: r.turnover,
    volume: r.volume,
    trades: r.trades,
    turnoverVsNormal: r.turnoverVsNormal,
    volumeVsNormal: r.volumeVsNormal,
    tradesVsNormal: r.tradesVsNormal,
    reactionScore: r.reactionScore,
    interpretation: r.interpretation,
    dataStatus: r.dataStatus as ReactionDataStatus,
  }));

  return { event: toMarketEventDto(event), reactions };
}

// exported for tests — unused in v1 but keeps stub shape explicit
export { stubReactionRow };
