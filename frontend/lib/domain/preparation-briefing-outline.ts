import type { MarketDriver, PreparationEvent, PreparationMode } from "@/lib/domain/preparation-events";
import type {
  PreparationInstrumentGroup,
  ResolvedPreparationInstrument,
} from "@/lib/domain/preparation-watchlist";

export type BriefingSection =
  | "context"
  | "events"
  | "external"
  | "commodities"
  | "currency"
  | "index"
  | "bluechips"
  | "sectors"
  | "inplay"
  | "summary";

export type BriefingOutlinePriority = "must" | "should" | "optional";

export type BriefingOutlineStatus = "ready" | "no_data" | "needs_fill";

export type BriefingOutlineItem = {
  id: string;
  section: BriefingSection;
  title: string;
  instruments: string[];
  eventIds: string[];
  talkingPoints: string[];
  priority: BriefingOutlinePriority;
  status: BriefingOutlineStatus;
};

export const BRIEFING_SECTION_ORDER: BriefingSection[] = [
  "context",
  "events",
  "external",
  "commodities",
  "currency",
  "index",
  "bluechips",
  "sectors",
  "inplay",
  "summary",
];

export const BRIEFING_SECTION_TITLES: Record<BriefingSection, string> = {
  context: "Контекст дня/недели",
  events: "Календарь событий",
  external: "Внешний фон",
  commodities: "Товарные рынки",
  currency: "Валюта",
  index: "Индекс МосБиржи",
  bluechips: "Голубые фишки",
  sectors: "Сектора",
  inplay: "Инструменты в игре",
  summary: "Итог",
};

export const BRIEFING_STATUS_LABELS: Record<BriefingOutlineStatus, string> = {
  ready: "готов",
  no_data: "нет данных",
  needs_fill: "нужно заполнить",
};

const GROUP_TO_SECTION: Record<PreparationInstrumentGroup, BriefingSection> = {
  external: "external",
  commodities: "commodities",
  currency: "currency",
  index: "index",
  bluechips: "bluechips",
  sectors: "sectors",
  inplay: "inplay",
};

const SECTION_PRIORITY: Record<BriefingSection, BriefingOutlinePriority> = {
  context: "must",
  events: "must",
  external: "should",
  commodities: "should",
  currency: "must",
  index: "should",
  bluechips: "should",
  sectors: "optional",
  inplay: "must",
  summary: "must",
};

export type BuildBriefingOutlineInput = {
  mode: PreparationMode;
  events: PreparationEvent[];
  instruments: ResolvedPreparationInstrument[];
  drivers: MarketDriver[];
  selectedEventIds: ReadonlySet<string>;
  selectedInstrumentIds: ReadonlySet<string>;
};

function instrumentLabel(item: ResolvedPreparationInstrument): string {
  return item.resolvedSecid ?? item.symbol;
}

function selectedEvents(events: PreparationEvent[], ids: ReadonlySet<string>): PreparationEvent[] {
  return events.filter((event) => ids.has(event.id));
}

function selectedInstruments(
  instruments: ResolvedPreparationInstrument[],
  ids: ReadonlySet<string>,
): ResolvedPreparationInstrument[] {
  return instruments.filter((item) => ids.has(item.id));
}

function instrumentsForSection(
  items: ResolvedPreparationInstrument[],
  section: BriefingSection,
): ResolvedPreparationInstrument[] {
  if (section === "events" || section === "context" || section === "summary") return [];
  return items.filter((item) => GROUP_TO_SECTION[item.group] === section);
}

function hotDrivers(drivers: MarketDriver[]): MarketDriver[] {
  return drivers.filter((d) => d.state === "active" || d.state === "fading");
}

function resolveStatus(
  section: BriefingSection,
  instruments: string[],
  eventIds: string[],
  talkingPoints: string[],
): BriefingOutlineStatus {
  const hasSelection = instruments.length > 0 || eventIds.length > 0;
  const meaningfulPoints = talkingPoints.filter(
    (point) => !point.includes("[") && !point.toLowerCase().includes("заполнить"),
  );

  if (section === "summary") {
    return hasSelection || meaningfulPoints.length >= 2 ? "ready" : "needs_fill";
  }

  if (!hasSelection && meaningfulPoints.length === 0) return "no_data";
  if (hasSelection && meaningfulPoints.length >= 2) return "ready";
  if (hasSelection || meaningfulPoints.length > 0) return "needs_fill";
  return "no_data";
}

function buildContextPoints(
  mode: PreparationMode,
  drivers: MarketDriver[],
  events: PreparationEvent[],
): string[] {
  const active = hotDrivers(drivers);
  const points: string[] = [];

  if (active.length) {
    points.push(`Горячие темы: ${active.map((d) => d.title).join(", ")}.`);
  }

  if (events.length) {
    points.push(
      mode === "day"
        ? `Сегодня в фокусе: ${events.slice(0, 2).map((e) => e.title).join("; ")}.`
        : `На неделе смотрим: ${events.slice(0, 3).map((e) => e.title).join("; ")}.`,
    );
  }

  if (points.length < 2) {
    points.push("[Добавьте контекст: что рынок уже заложил и что может перевернуть день.]");
  }

  return points.slice(0, 3);
}

function buildEventPoints(events: PreparationEvent[]): string[] {
  if (!events.length) {
    return ["[Выберите события кнопкой «В брифинг».]", "[Укажите время и сценарий реакции.]"];
  }

  return events.slice(0, 3).map((event) => {
    const time = event.timeMsk && event.timeMsk !== "—" ? `${event.timeMsk} · ` : "";
    const expectation = event.expectation ? ` Ожидание: ${event.expectation}` : "";
    return `${time}${event.title}.${expectation}`.trim();
  });
}

function buildInstrumentPoints(
  section: BriefingSection,
  items: ResolvedPreparationInstrument[],
): string[] {
  if (!items.length) {
    if (section === "external") {
      return ["[Внешний источник не подключён — заполнить вручную.]", "[Что было в Asia / US close?]"];
    }
    if (section === "sectors") {
      return ["[Выберите сектор или лидера сектора.]", "[Где концентрация оборота?]"];
    }
    return ["[Выберите инструменты кнопкой «В брифинг».]", "[Кратко: движение и почему важно.]"];
  }

  const labels = items.map(instrumentLabel);
  const points: string[] = [
    `Открыть / упомянуть: ${labels.join(", ")}.`,
  ];

  const reasons = items
    .map((item) => item.reason)
    .filter(Boolean)
    .slice(0, 2);
  if (reasons.length) {
    points.push(reasons.join(" "));
  } else {
    points.push("Кратко: что двигало инструмент за 5 дней и что смотреть сегодня.");
  }

  return points.slice(0, 3);
}

function buildSummaryPoints(
  mode: PreparationMode,
  outline: BriefingOutlineItem[],
): string[] {
  const withData = outline.filter(
    (item) =>
      item.section !== "summary" &&
      (item.instruments.length > 0 || item.eventIds.length > 0),
  );

  const inplay = outline.find((item) => item.section === "inplay");
  const events = outline.find((item) => item.section === "events");

  const points: string[] = [
    mode === "day"
      ? "Итог дня: что открываем первым и где ждём реакцию на новости."
      : "Итог недели: главные драйверы и инструменты на 5 торговых дней.",
  ];

  if (events?.instruments.length || events?.eventIds.length) {
    points.push(`События закрываем блоком «${events.title}».`);
  }

  if (inplay?.instruments.length) {
    points.push(`In-play: ${inplay.instruments.join(", ")} — не забыть уровни.`);
  } else if (withData.length >= 3) {
    points.push(`Покрыто блоков: ${withData.length}. Проверить пустые секции перед эфиром.`);
  } else {
    points.push("[Добавьте инструменты в игре и ключевые тезисы для финала.]");
  }

  return points.slice(0, 3);
}

export function buildBriefingOutline(input: BuildBriefingOutlineInput): BriefingOutlineItem[] {
  const pickedEvents = selectedEvents(input.events, input.selectedEventIds);
  const pickedInstruments = selectedInstruments(input.instruments, input.selectedInstrumentIds);
  const activeDrivers = hotDrivers(input.drivers);

  const draft: BriefingOutlineItem[] = BRIEFING_SECTION_ORDER.map((section) => {
    const id = `outline-${section}`;
    const title = BRIEFING_SECTION_TITLES[section];
    const priority = SECTION_PRIORITY[section];

    if (section === "context") {
      const instruments = [
        ...new Set(activeDrivers.flatMap((d) => d.affectedInstruments)),
      ].slice(0, 6);
      const talkingPoints = buildContextPoints(input.mode, input.drivers, pickedEvents);
      return {
        id,
        section,
        title,
        instruments,
        eventIds: pickedEvents.slice(0, 2).map((e) => e.id),
        talkingPoints,
        priority,
        status: resolveStatus(section, instruments, pickedEvents.slice(0, 2).map((e) => e.id), talkingPoints),
      };
    }

    if (section === "events") {
      const talkingPoints = buildEventPoints(pickedEvents);
      return {
        id,
        section,
        title,
        instruments: pickedEvents.flatMap((e) => e.affectedInstruments).slice(0, 8),
        eventIds: pickedEvents.map((e) => e.id),
        talkingPoints,
        priority,
        status: resolveStatus(section, [], pickedEvents.map((e) => e.id), talkingPoints),
      };
    }

    if (section === "summary") {
      return {
        id,
        section,
        title,
        instruments: [],
        eventIds: [],
        talkingPoints: [],
        priority,
        status: "needs_fill" as const,
      };
    }

    const sectionItems = instrumentsForSection(pickedInstruments, section);
    const instruments = sectionItems.map(instrumentLabel);
    const talkingPoints = buildInstrumentPoints(section, sectionItems);

    return {
      id,
      section,
      title,
      instruments,
      eventIds: [],
      talkingPoints,
      priority,
      status: resolveStatus(section, instruments, [], talkingPoints),
    };
  });

  const summaryIndex = draft.findIndex((item) => item.section === "summary");
  if (summaryIndex >= 0) {
    const withoutSummary = draft.filter((item) => item.section !== "summary");
    const talkingPoints = buildSummaryPoints(input.mode, withoutSummary);
    draft[summaryIndex] = {
      ...draft[summaryIndex]!,
      talkingPoints,
      instruments: withoutSummary.flatMap((item) => item.instruments).slice(0, 8),
      eventIds: withoutSummary.flatMap((item) => item.eventIds).slice(0, 5),
      status: resolveStatus("summary", [], [], talkingPoints),
    };
  }

  return draft;
}

function isSectionEmpty(item: BriefingOutlineItem): boolean {
  return item.status === "no_data" && item.instruments.length === 0 && item.eventIds.length === 0;
}

export function buildBriefingScriptText(
  outline: BriefingOutlineItem[],
  mode: PreparationMode,
  hideEmpty: boolean,
): string {
  const header =
    mode === "day"
      ? "Черновик эфира · дневной брифинг MOEX\n"
      : "Черновик эфира · недельный обзор MOEX\n";

  const lines: string[] = [header];

  for (const item of outline) {
    if (hideEmpty && isSectionEmpty(item)) continue;

    const instruments =
      item.instruments.length > 0 ? item.instruments.join(", ") : "[не выбрано]";
    const events =
      item.eventIds.length > 0
        ? `[${item.eventIds.length} событ.]`
        : item.section === "events"
          ? "[не выбрано]"
          : "";

    if (item.section === "context") {
      lines.push(`Контекст: ${item.talkingPoints[0] ?? "[драйверы]"}`);
      continue;
    }

    if (item.section === "events") {
      lines.push(`События: ${item.talkingPoints[0] ?? events}`);
      continue;
    }

    if (item.section === "summary") {
      lines.push(`Итог: ${item.talkingPoints.join(" ")}`);
      continue;
    }

    const label = item.title.replace(/:.*/, "");
    lines.push(`${label}: ${instruments}. ${item.talkingPoints[0] ?? ""}`.trim());
  }

  lines.push("", "— Шаблон без AI. Проверьте данные перед эфиром.");
  return lines.join("\n");
}

export function buildTelegramSummary(
  outline: BriefingOutlineItem[],
  drivers: MarketDriver[],
  inflationTelegramLine?: string | null,
): string {
  const active = hotDrivers(drivers).map((d) => d.title);
  const events = outline.find((i) => i.section === "events");
  const inplay = outline.find((i) => i.section === "inplay");
  const currency = outline.find((i) => i.section === "currency");
  const commodities = outline.find((i) => i.section === "commodities");

  const lines: string[] = ["🌅 MOEX · короткий итог", ""];

  if (active.length) lines.push(`• Драйверы: ${active.slice(0, 3).join(", ")}`);
  if (inflationTelegramLine) lines.push(`• ${inflationTelegramLine}`);
  if (events?.talkingPoints[0]) lines.push(`• События: ${events.talkingPoints[0]!.slice(0, 120)}`);
  if (commodities?.instruments.length) lines.push(`• Товары: ${commodities.instruments.join(", ")}`);
  if (currency?.instruments.length) lines.push(`• Валюта: ${currency.instruments.join(", ")}`);
  if (inplay?.instruments.length) lines.push(`• В игре: ${inplay.instruments.join(", ")}`);

  if (lines.length <= 2) {
    lines.push("• [Добавьте события и инструменты кнопкой «В брифинг»]");
  }

  lines.push("", "#MOEX #брифинг");
  return lines.join("\n");
}

export function toggleBriefingSelection(ids: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function countBriefingSelections(
  eventIds: ReadonlySet<string>,
  instrumentIds: ReadonlySet<string>,
): number {
  return eventIds.size + instrumentIds.size;
}
