export type PreparationMode = "day" | "week";

export type EventImpact = "low" | "medium" | "high" | "critical";

export type DriverState =
  | "active"
  | "fading"
  | "sleeping"
  | "potential"
  | "unknown";

export type PreparationEventCategory =
  | "macro"
  | "cb"
  | "oil"
  | "gas"
  | "company"
  | "dividends"
  | "earnings"
  | "geopolitics"
  | "forum"
  | "expiry"
  | "other";

export type PreparationEvent = {
  id: string;
  date: string;
  timeMsk?: string;
  title: string;
  sourceName: string;
  sourceUrl?: string;
  category: PreparationEventCategory;
  impact: EventImpact;
  driverState: DriverState;
  affectedMarkets: string[];
  affectedInstruments: string[];
  expectation?: string;
  scenarioAbove?: string;
  scenarioBase?: string;
  scenarioBelow?: string;
  note?: string;
  isManual: boolean;
};

export type MarketDriver = {
  id: string;
  title: string;
  state: DriverState;
  whyMatters: string;
  affectedInstruments: string[];
  evidence?: string;
  lastReaction?: string;
};

export type EventRadarFilter =
  | "today"
  | "week"
  | "important"
  | "ru"
  | "us"
  | "companies"
  | "commodities"
  | "dividends";

export type DriverBoardColumn = "hot" | "fading" | "potential" | "sleeping";

export const EVENT_RADAR_FILTER_LABELS: Record<EventRadarFilter, string> = {
  today: "Сегодня",
  week: "Неделя",
  important: "Важные",
  ru: "РФ",
  us: "США",
  companies: "Компании",
  commodities: "Сырьё",
  dividends: "Дивиденды",
};

export const EVENT_IMPACT_LABELS: Record<EventImpact, string> = {
  low: "низкая",
  medium: "средняя",
  high: "высокая",
  critical: "критическая",
};

export const DRIVER_STATE_LABELS: Record<DriverState, string> = {
  active: "активный",
  fading: "остывает",
  sleeping: "спит",
  potential: "потенциальный",
  unknown: "неизвестно",
};

export const EVENT_CATEGORY_LABELS: Record<PreparationEventCategory, string> = {
  macro: "макро",
  cb: "ЦБ",
  oil: "нефть",
  gas: "газ",
  company: "компания",
  dividends: "дивиденды",
  earnings: "отчётность",
  geopolitics: "геополитика",
  forum: "форум",
  expiry: "экспирация",
  other: "прочее",
};

export const DRIVER_BOARD_COLUMN_LABELS: Record<DriverBoardColumn, string> = {
  hot: "Горячие",
  fading: "Остывают",
  potential: "Потенциальные",
  sleeping: "Спят",
};

export const DRIVER_STATE_TO_COLUMN: Record<DriverState, DriverBoardColumn> = {
  active: "hot",
  fading: "fading",
  potential: "potential",
  sleeping: "sleeping",
  unknown: "potential",
};

export const PREPARATION_READ_HINT =
  "Событие важно только тогда, когда рынок на него реагирует. Статус драйвера показывает не календарную важность, а текущую чувствительность рынка.";

export const PREPARATION_DEMO_DISCLAIMER =
  "Примеры структуры. Реальный календарь подключим позже.";

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isEventToday(event: PreparationEvent, reference = new Date()): boolean {
  return event.date === toIsoDate(reference);
}

export function isEventThisWeek(event: PreparationEvent, reference = new Date()): boolean {
  const start = startOfWeekMonday(reference);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const eventDate = new Date(`${event.date}T12:00:00`);
  return eventDate >= start && eventDate <= end;
}

export function isImportantEvent(event: PreparationEvent): boolean {
  return event.impact === "high" || event.impact === "critical";
}

export function eventMatchesMarket(event: PreparationEvent, market: string): boolean {
  return event.affectedMarkets.some((m) => m.toLowerCase().includes(market.toLowerCase()));
}

export function filterPreparationEvents(
  events: PreparationEvent[],
  filter: EventRadarFilter,
  reference = new Date(),
): PreparationEvent[] {
  return events.filter((event) => {
    switch (filter) {
      case "today":
        return isEventToday(event, reference);
      case "week":
        return isEventThisWeek(event, reference);
      case "important":
        return isImportantEvent(event);
      case "ru":
        return eventMatchesMarket(event, "РФ") || event.category === "cb";
      case "us":
        return eventMatchesMarket(event, "США");
      case "companies":
        return event.category === "company" || event.category === "earnings";
      case "commodities":
        return event.category === "oil" || event.category === "gas" || event.category === "geopolitics";
      case "dividends":
        return event.category === "dividends";
      default:
        return true;
    }
  });
}

export function defaultEventFilterForMode(mode: PreparationMode): EventRadarFilter {
  return mode === "day" ? "today" : "week";
}

export function filterEventsForMode(
  events: PreparationEvent[],
  mode: PreparationMode,
  filter: EventRadarFilter,
  reference = new Date(),
): PreparationEvent[] {
  const byChip = filterPreparationEvents(events, filter, reference);
  if (filter === "today" || filter === "week") return byChip;
  const byMode = filterPreparationEvents(
    events,
    mode === "day" ? "today" : "week",
    reference,
  );
  const ids = new Set(byMode.map((e) => e.id));
  return byChip.filter((e) => ids.has(e.id));
}

export function sortEventsByDateTime(events: PreparationEvent[]): PreparationEvent[] {
  return [...events].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return (a.timeMsk ?? "99:99").localeCompare(b.timeMsk ?? "99:99");
  });
}

export function countActiveDrivers(drivers: MarketDriver[]): number {
  return drivers.filter((d) => d.state === "active" || d.state === "fading").length;
}

export function findNextImportantEvent(
  events: PreparationEvent[],
  reference = new Date(),
): PreparationEvent | null {
  const todayIso = toIsoDate(reference);
  const nowMinutes = reference.getHours() * 60 + reference.getMinutes();

  const upcoming = sortEventsByDateTime(events).filter((event) => {
    if (!isImportantEvent(event)) return false;
    if (event.date < todayIso) return false;
    if (event.date > todayIso) return true;
    if (!event.timeMsk) return true;
    const [h, m] = event.timeMsk.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return true;
    return h * 60 + m >= nowMinutes;
  });

  return upcoming[0] ?? null;
}

export function groupDriversByColumn(
  drivers: MarketDriver[],
): Record<DriverBoardColumn, MarketDriver[]> {
  const columns: Record<DriverBoardColumn, MarketDriver[]> = {
    hot: [],
    fading: [],
    potential: [],
    sleeping: [],
  };

  for (const driver of drivers) {
    columns[DRIVER_STATE_TO_COLUMN[driver.state]].push(driver);
  }

  return columns;
}

export function formatEventDateLabel(date: string, reference = new Date()): string {
  if (date === toIsoDate(reference)) return "сегодня";
  const tomorrow = new Date(reference);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === toIsoDate(tomorrow)) return "завтра";
  return new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

export function impactToneClass(impact: EventImpact): string {
  switch (impact) {
    case "critical":
      return "border-lab-red/40 bg-lab-red/10 text-lab-red";
    case "high":
      return "border-lab-amber/40 bg-lab-amber/10 text-lab-amber";
    case "medium":
      return "border-lab-violet/30 bg-lab-violet/8 text-lab-violet";
    default:
      return "border-lab-border bg-lab-surface-2/50 text-lab-muted";
  }
}

export function driverStateToneClass(state: DriverState): string {
  switch (state) {
    case "active":
      return "border-lab-red/35 bg-lab-red/10 text-lab-red";
    case "fading":
      return "border-lab-amber/35 bg-lab-amber/10 text-lab-amber";
    case "potential":
      return "border-lab-cyan/30 bg-lab-cyan/8 text-lab-cyan";
    case "sleeping":
      return "border-lab-border bg-lab-surface-2/40 text-lab-dim";
    default:
      return "border-lab-border text-lab-muted";
  }
}
