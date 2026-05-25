import type {
  DriverState,
  EventImpact,
  PreparationEvent,
  PreparationEventCategory,
} from "@/lib/domain/preparation-events";
import type {
  SmartLabCalendarMode,
  SmartLabCalendarResponse,
  SmartLabCalendarStatus,
  SmartLabCalendarType,
} from "@/lib/domain/smartlab-calendar";

const SMARTLAB_CALENDAR_URL = "https://smart-lab.ru/calendar/";
const SMARTLAB_DIVIDENDS_URL = "https://smart-lab.ru/dividends/";
const CACHE_TTL_MS = 45 * 60_000;
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT = "ScreenerPRO-Lab/1.0 (preparation-draft)";

type CacheEntry = {
  expiresAt: number;
  body: SmartLabCalendarResponse;
};

const cache = new Map<string, CacheEntry>();

function cacheKey(mode: SmartLabCalendarMode, type: SmartLabCalendarType): string {
  return `${mode}:${type}`;
}

function moscowDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(now);
}

function addDaysIso(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseRuDate(raw: string): { date: string; timeMsk?: string } | null {
  const match = raw.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min] = match;
  const date = `${yyyy}-${mm}-${dd}`;
  const timeMsk =
    hh != null && min != null ? `${hh.padStart(2, "0")}:${min.padStart(2, "0")}` : undefined;
  return { date, timeMsk };
}

function isDateInMode(dateIso: string, mode: SmartLabCalendarMode, reference = new Date()): boolean {
  const today = moscowDateKey(reference);
  if (mode === "day") return dateIso === today;
  const weekEnd = addDaysIso(today, 7);
  return dateIso >= today && dateIso <= weekEnd;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractHref(html: string): string | undefined {
  const match = html.match(/href=["']([^"']+)["']/i);
  if (!match?.[1]) return undefined;
  const href = match[1];
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `https://smart-lab.ru${href}`;
  return undefined;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function inferImpact(category: PreparationEventCategory, title: string): EventImpact {
  const lower = title.toLowerCase();
  if (
    category === "cb" ||
    category === "macro" ||
    lower.includes("цб") ||
    lower.includes("ставк") ||
    lower.includes("инфляц") ||
    lower.includes("ключев")
  ) {
    return "high";
  }
  if (category === "dividends" || category === "earnings" || category === "company") {
    return "medium";
  }
  if (lower.includes("сд ") || lower.includes("совет директор") || lower.includes("отчет")) {
    return "medium";
  }
  return "low";
}

function inferDriverState(impact: EventImpact): DriverState {
  if (impact === "high") return "potential";
  if (impact === "medium") return "potential";
  return "sleeping";
}

function inferCategory(title: string, fallback: PreparationEventCategory = "other"): PreparationEventCategory {
  const lower = title.toLowerCase();
  if (lower.includes("дивиденд") || lower.includes("отсеч") || lower.includes("реестр")) return "dividends";
  if (lower.includes("отчет") || lower.includes("мсфо") || lower.includes("результат")) return "earnings";
  if (lower.includes("цб") || lower.includes("ставк") || lower.includes("ключев")) return "cb";
  if (lower.includes("инфляц") || lower.includes("ввп") || lower.includes("макро") || lower.includes("опек"))
    return "macro";
  if (lower.includes("сд ") || lower.includes("совет директор") || lower.includes("воса") || lower.includes("собран"))
    return "company";
  if (lower.includes("нефт") || lower.includes("газ") || lower.includes("brent")) return "oil";
  return fallback;
}

function extractTicker(title: string): string | null {
  const match = title.match(/^([A-Z0-9]{1,6}):\s*/);
  return match?.[1] ?? null;
}

function matchesType(event: PreparationEvent, type: SmartLabCalendarType): boolean {
  if (type === "all") return true;
  if (type === "dividends") return event.category === "dividends";
  if (type === "macro") return event.category === "macro" || event.category === "cb";
  if (type === "stocks") {
    return (
      event.affectedInstruments.length > 0 ||
      ["company", "dividends", "earnings"].includes(event.category)
    );
  }
  return true;
}

function buildEvent(input: {
  date: string;
  timeMsk?: string;
  title: string;
  sourceUrl?: string;
  category?: PreparationEventCategory;
  instruments?: string[];
  note?: string;
  suffix?: string;
}): PreparationEvent {
  const category = input.category ?? inferCategory(input.title);
  const impact = inferImpact(category, input.title);
  const instruments = input.instruments ?? [];
  const ticker = extractTicker(input.title);
  if (ticker && !instruments.includes(ticker)) instruments.unshift(ticker);

  const id = `smartlab-${input.date}-${slugify(`${ticker ?? "evt"}-${input.title}`)}${input.suffix ? `-${input.suffix}` : ""}`;

  return {
    id,
    date: input.date,
    timeMsk: input.timeMsk,
    title: input.title,
    sourceName: "Smart-Lab",
    sourceUrl: input.sourceUrl ?? SMARTLAB_CALENDAR_URL,
    category,
    impact,
    driverState: inferDriverState(impact),
    affectedMarkets: category === "macro" || category === "cb" ? ["MOEX", "РФ"] : ["MOEX"],
    affectedInstruments: instruments,
    note: input.note,
    isManual: false,
  };
}

async function fetchSmartLabHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ru-RU,ru;q=0.9",
      },
      cache: "no-store",
      next: { revalidate: 2700 },
    });

    if (!response.ok) {
      throw new Error(`Smart-Lab HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseCalendarHtml(html: string, mode: SmartLabCalendarMode): PreparationEvent[] {
  const events: PreparationEvent[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1]!;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: { text: string; html: string }[] = [];
    let tdMatch: RegExpExecArray | null;

    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push({ html: tdMatch[1]!, text: stripTags(tdMatch[1]!) });
    }

    if (cells.length < 2) continue;

    const dateCell = cells.find((cell) => /\d{2}\.\d{2}\.\d{4}/.test(cell.text));
    if (!dateCell) continue;

    const parsedDate = parseRuDate(dateCell.text);
    if (!parsedDate || !isDateInMode(parsedDate.date, mode)) continue;

    const descriptionCell =
      cells.find((cell) => cell !== dateCell && cell.text.length > 3 && !/^>>>$/i.test(cell.text)) ??
      cells[cells.length - 1]!;

    const title = descriptionCell.text.replace(/^>>>$/i, "").trim();
    if (!title || title.length < 4) continue;

    const linkCell = cells.find((cell) => /href=/i.test(cell.html));
    const sourceUrl = linkCell ? extractHref(linkCell.html) : undefined;

    events.push(
      buildEvent({
        date: parsedDate.date,
        timeMsk: parsedDate.timeMsk,
        title,
        sourceUrl,
      }),
    );
  }

  return events;
}

function parseDividendsHtml(html: string, mode: SmartLabCalendarMode): PreparationEvent[] {
  const events: PreparationEvent[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1]!;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;

    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(stripTags(tdMatch[1]!));
    }

    if (cells.length < 6) continue;

    const ticker = cells[1]?.trim().toUpperCase();
    if (!ticker || !/^[A-Z0-9]{2,6}$/.test(ticker)) continue;

    const period = cells[2]?.trim() ?? "";
    const dividend = cells[3]?.trim() ?? "";

    const dateCandidates = cells
      .map((cell) => parseRuDate(cell))
      .filter((value): value is { date: string; timeMsk?: string } => value != null);

    const registryDate = dateCandidates[0];
    if (!registryDate || !isDateInMode(registryDate.date, mode)) continue;

    const closeRegistry = dateCandidates[1];
    const title = `${ticker}: дивиденды ${dividend ? `${dividend} ₽` : ""}${period ? ` · ${period}` : ""}`.trim();
    const note = closeRegistry
      ? `Закрытие реестра ${closeRegistry.date.split("-").reverse().join(".")}`
      : undefined;

    events.push(
      buildEvent({
        date: registryDate.date,
        title,
        category: "dividends",
        instruments: [ticker],
        sourceUrl: SMARTLAB_DIVIDENDS_URL,
        note,
        suffix: slugify(`${ticker}-${period}-${registryDate.date}`),
      }),
    );
  }

  return events;
}

function dedupeEvents(events: PreparationEvent[]): PreparationEvent[] {
  const seen = new Set<string>();
  const result: PreparationEvent[] = [];
  for (const event of events) {
    const key = `${event.date}|${event.title}|${event.affectedInstruments.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
  }
  return result.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return (a.timeMsk ?? "99:99").localeCompare(b.timeMsk ?? "99:99");
  });
}

function buildResponse(input: {
  events: PreparationEvent[];
  fetchedUrl: string;
  status: SmartLabCalendarStatus;
  warning?: string;
  fromCache?: boolean;
  staleFallback?: boolean;
}): SmartLabCalendarResponse {
  return {
    source: "Smart-Lab",
    updatedAt: new Date().toISOString(),
    status: input.status,
    events: input.events,
    diagnostics: {
      fetchedUrl: input.fetchedUrl,
      parsedEvents: input.events.length,
      warning: input.warning,
      fromCache: input.fromCache,
      staleFallback: input.staleFallback,
    },
  };
}

export async function fetchSmartLabCalendarResponse(
  mode: SmartLabCalendarMode,
  type: SmartLabCalendarType,
): Promise<SmartLabCalendarResponse> {
  const key = cacheKey(mode, type);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.body,
      diagnostics: { ...cached.body.diagnostics, fromCache: true },
    };
  }

  const urls: string[] = [SMARTLAB_CALENDAR_URL];
  if (type === "dividends" || type === "all" || mode === "week") {
    urls.push(SMARTLAB_DIVIDENDS_URL);
  }

  try {
    const htmlParts = await Promise.all(urls.map((url) => fetchSmartLabHtml(url)));
    let events: PreparationEvent[] = [];

    events.push(...parseCalendarHtml(htmlParts[0]!, mode));

    if (htmlParts[1]) {
      events.push(...parseDividendsHtml(htmlParts[1]!, mode));
    }

    events = dedupeEvents(events.filter((event) => matchesType(event, type)));

    const status: SmartLabCalendarStatus = events.length > 0 ? "ok" : "empty";
    const body = buildResponse({
      events,
      fetchedUrl: urls.join(" · "),
      status,
      warning:
        status === "empty"
          ? "Smart-Lab вернул пустой календарь для выбранного окна. Используйте ручной импорт."
          : undefined,
    });

    if (status === "ok") {
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, body });
    }

    return body;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (cached?.body.status === "ok" && cached.body.events.length > 0) {
      return {
        ...cached.body,
        diagnostics: {
          ...cached.body.diagnostics,
          warning: `Smart-Lab недоступен (${message}). Показан последний успешный кэш.`,
          staleFallback: true,
          fromCache: true,
        },
      };
    }

    return buildResponse({
      events: [],
      fetchedUrl: urls.join(" · "),
      status: "error",
      warning: `Smart-Lab недоступен: ${message}. Используйте ручной импорт.`,
    });
  }
}
