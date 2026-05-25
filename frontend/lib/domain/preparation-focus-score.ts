import type { MarketDriver, PreparationEvent } from "@/lib/domain/preparation-events";
import {
  computePreparationChanges,
  resolveInstrumentDataStatus,
} from "@/lib/domain/market-data-status";
import type {
  PreparationCandlesResponse,
  PreparationInstrumentGroup,
  ResolvedPreparationInstrument,
} from "@/lib/domain/preparation-watchlist";
import { findCandleSeries } from "@/lib/domain/preparation-watchlist";

export type PreparationFocusItem = {
  id: string;
  kind: "event" | "instrument" | "driver";
  title: string;
  score: number;
  reason: string[];
  actionLabel: string;
  actionHref?: string;
  eventId?: string;
  instrumentId?: string;
  driverId?: string;
};

export type PreparationFocusPack = {
  items: PreparationFocusItem[];
  hasEnoughData: boolean;
};

type FocusScoreContext = {
  watchlist: ResolvedPreparationInstrument[];
  candlesResponse?: PreparationCandlesResponse;
  hasLiveData: boolean;
  drivers: MarketDriver[];
  selectedEventIds: ReadonlySet<string>;
  selectedInstrumentIds: ReadonlySet<string>;
};

const MIN_ITEM_SCORE = 12;
const MIN_PACK_ITEMS = 2;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function instrumentLabel(item: ResolvedPreparationInstrument): string {
  return item.resolvedSecid ?? item.symbol;
}

function isExternalInstrument(item: ResolvedPreparationInstrument): boolean {
  return item.market === "global" || item.market === "manual";
}

function groupItems(
  watchlist: ResolvedPreparationInstrument[],
  group: PreparationInstrumentGroup,
): ResolvedPreparationInstrument[] {
  return watchlist.filter((item) => item.group === group);
}

function computeGroupMedianAbsChange1d(
  watchlist: ResolvedPreparationInstrument[],
  candlesResponse: PreparationCandlesResponse | undefined,
  group: PreparationInstrumentGroup,
  hasLiveData: boolean,
): number {
  const values = groupItems(watchlist, group)
    .map((item) => {
      const series = candlesResponse ? findCandleSeries(candlesResponse.series, item) : null;
      if (!series || series.status !== "ok" || series.candles.length < 2) return null;
      const status = resolveInstrumentDataStatus({
        candleSeries: series,
        screenerRow: item.screenerRow,
        hasLiveMoex: hasLiveData,
        isExternal: isExternalInstrument(item),
      });
      const changes = computePreparationChanges(series.candles, status, item.screenerRow);
      return changes.change1d != null ? Math.abs(changes.change1d) : null;
    })
    .filter((value): value is number => value != null && Number.isFinite(value));

  return median(values);
}

function computeGroupMedianTurnover(
  watchlist: ResolvedPreparationInstrument[],
  group: PreparationInstrumentGroup,
): number {
  const values = groupItems(watchlist, group)
    .map((item) => item.screenerRow?.turnover ?? null)
    .filter((value): value is number => value != null && value > 0);

  return median(values);
}

function isInActiveDriver(instrument: ResolvedPreparationInstrument, drivers: MarketDriver[]): boolean {
  const ticker = instrumentLabel(instrument).toUpperCase();
  return drivers.some(
    (driver) =>
      (driver.state === "active" || driver.state === "fading") &&
      driver.affectedInstruments.some((symbol) => symbol.toUpperCase() === ticker),
  );
}

function activeDriverForInstrument(
  instrument: ResolvedPreparationInstrument,
  drivers: MarketDriver[],
): MarketDriver | null {
  const ticker = instrumentLabel(instrument).toUpperCase();
  return (
    drivers.find(
      (driver) =>
        (driver.state === "active" || driver.state === "fading") &&
        driver.affectedInstruments.some((symbol) => symbol.toUpperCase() === ticker),
    ) ?? null
  );
}

function chartHref(item: ResolvedPreparationInstrument): string | undefined {
  if (!item.resolvedSecid) return undefined;
  return item.market === "moex-future"
    ? `/futures/${item.resolvedSecid}`
    : `/stocks/${item.resolvedSecid}`;
}

function screenerHref(item: ResolvedPreparationInstrument): string {
  return item.market === "moex-future" ? "/screener/futures" : "/screener/stocks";
}

function driverAction(driver: MarketDriver): { actionLabel: string; actionHref: string } {
  const lower = driver.title.toLowerCase();
  if (lower.includes("рубл") || lower.includes("si")) {
    return { actionLabel: "валютная связка", actionHref: "/lab/currency-correlation" };
  }
  if (lower.includes("нефт") || lower.includes("ормуз")) {
    return { actionLabel: "карта рынка", actionHref: "/lab/market-map" };
  }
  return { actionLabel: "скринер", actionHref: "/screener" };
}

function instrumentAction(item: ResolvedPreparationInstrument): { actionLabel: string; actionHref?: string } {
  if (item.group === "currency") {
    return { actionLabel: "валютная связка", actionHref: "/lab/currency-correlation" };
  }
  if (item.group === "commodities" || item.group === "index") {
    return { actionLabel: "карта рынка", actionHref: "/lab/market-map" };
  }
  const chart = chartHref(item);
  if (chart) {
    return { actionLabel: "график", actionHref: chart };
  }
  return { actionLabel: "скринер", actionHref: screenerHref(item) };
}

function scoreInstrument(
  item: ResolvedPreparationInstrument,
  ctx: FocusScoreContext,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const external = isExternalInstrument(item);
  const series = ctx.candlesResponse ? findCandleSeries(ctx.candlesResponse.series, item) : null;
  const dataStatus = resolveInstrumentDataStatus({
    candleSeries: series,
    screenerRow: item.screenerRow,
    hasLiveMoex: ctx.hasLiveData,
    isExternal: external,
  });

  if (external) {
    score -= 20;
    reasons.push("внешний источник не подключён");
  }

  const noData =
    dataStatus.freshness === "no-data" ||
    dataStatus.freshness === "error" ||
    !series ||
    series.status !== "ok" ||
    series.candles.length < 2;

  if (noData && !external) {
    score -= 50;
    reasons.push("данных нет");
  } else if (series?.status === "ok" && series.candles.length >= 2) {
    score += 10;
    reasons.push("есть реальные свечи");
  }

  const row = item.screenerRow;
  const hasTurnover = (row?.turnover ?? 0) > 0;
  const hasTrades = (row?.tradesCount ?? 0) > 0;
  const hasSession =
    hasTurnover ||
    hasTrades ||
    dataStatus.freshness === "live" ||
    dataStatus.freshness === "delayed" ||
    dataStatus.freshness === "last-available" ||
    dataStatus.freshness === "closed";

  if (hasSession && !external) {
    score += 10;
    if (dataStatus.freshness === "last-available" || dataStatus.freshness === "closed") {
      reasons.push("последний доступный оборот");
    } else {
      reasons.push("оборот/сделки сегодня");
    }
  }

  if (series?.status === "ok" && series.candles.length >= 2) {
    const changes = computePreparationChanges(series.candles, dataStatus, row);
    const groupMedian = computeGroupMedianAbsChange1d(
      ctx.watchlist,
      ctx.candlesResponse,
      item.group,
      ctx.hasLiveData,
    );

    if (changes.change1d != null && Math.abs(changes.change1d) > groupMedian && groupMedian > 0) {
      score += 15;
      reasons.push("1д выше медианы группы");
    }

    if (changes.change5d != null && Math.abs(changes.change5d) >= 2) {
      score += 10;
      reasons.push("5д движение заметное");
    }
  }

  if (row?.turnover && row.turnover > 0) {
    const groupMedianTurnover = computeGroupMedianTurnover(ctx.watchlist, item.group);
    if (groupMedianTurnover > 0 && row.turnover >= groupMedianTurnover * 1.35) {
      score += 20;
      reasons.push("повышенный оборот");
    }
  }

  const linkedDriver = activeDriverForInstrument(item, ctx.drivers);
  if (linkedDriver) {
    score += 15;
    reasons.push(`драйвер «${linkedDriver.title}» активен`);
  }

  if (ctx.selectedInstrumentIds.has(item.id)) {
    score += 30;
    reasons.push("выбран в брифинг");
  }

  return { score, reasons };
}

function scoreEvent(
  event: PreparationEvent,
  ctx: FocusScoreContext,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (event.impact === "critical") {
    score += 35;
    reasons.push("критическое событие");
  } else if (event.impact === "high") {
    score += 28;
    reasons.push("высокая важность");
  } else if (event.impact === "medium") {
    score += 16;
  } else {
    score += 6;
  }

  if (event.driverState === "active") {
    score += 18;
    reasons.push("рынок чувствителен");
  } else if (event.driverState === "potential") {
    score += 8;
  }

  if (event.affectedInstruments.length > 0) {
    score += 8;
    reasons.push(`затрагивает ${event.affectedInstruments.slice(0, 3).join(", ")}`);
  }

  if (ctx.selectedEventIds.has(event.id)) {
    score += 30;
    reasons.push("выбрано в брифинг");
  }

  if (event.timeMsk && event.timeMsk !== "—") {
    score += 5;
    reasons.push(`время ${event.timeMsk}`);
  }

  return { score, reasons };
}

function scoreDriver(
  driver: MarketDriver,
  ctx: FocusScoreContext,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (driver.state === "active") {
    score += 45;
    reasons.push("драйвер активен");
  } else if (driver.state === "fading") {
    score += 32;
    reasons.push("драйвер остывает");
  } else if (driver.state === "potential") {
    score += 18;
    reasons.push("потенциальный драйвер");
  } else {
    score += 4;
  }

  const linked = ctx.watchlist.filter((item) => {
    const ticker = instrumentLabel(item).toUpperCase();
    return driver.affectedInstruments.some((symbol) => symbol.toUpperCase() === ticker);
  });

  const withData = linked.filter((item) => {
    const { score: instrumentScore } = scoreInstrument(item, ctx);
    return instrumentScore > MIN_ITEM_SCORE;
  });

  if (withData.length > 0) {
    score += 12;
    reasons.push(`связан с ${withData.slice(0, 2).map(instrumentLabel).join(", ")}`);
  }

  if (driver.whyMatters) {
    reasons.push(driver.whyMatters.replace(/\.$/, ""));
  }

  return { score, reasons: reasons.slice(0, 3) };
}

function buildInstrumentFocusItem(
  item: ResolvedPreparationInstrument,
  ctx: FocusScoreContext,
): PreparationFocusItem {
  const { score, reasons } = scoreInstrument(item, ctx);
  const label = instrumentLabel(item);
  const action = instrumentAction(item);

  return {
    id: `focus-instrument-${item.id}`,
    kind: "instrument",
    title: `${label} · ${item.title}`,
    score,
    reason: reasons,
    actionLabel: action.actionLabel,
    actionHref: action.actionHref,
    instrumentId: item.id,
  };
}

function buildEventFocusItem(event: PreparationEvent, ctx: FocusScoreContext): PreparationFocusItem {
  const { score, reasons } = scoreEvent(event, ctx);

  return {
    id: `focus-event-${event.id}`,
    kind: "event",
    title: event.title,
    score,
    reason: reasons,
    actionLabel: "календарь",
    actionHref: event.sourceUrl ?? "/lab/preparation",
    eventId: event.id,
  };
}

function buildDriverFocusItem(driver: MarketDriver, ctx: FocusScoreContext): PreparationFocusItem {
  const { score, reasons } = scoreDriver(driver, ctx);
  const action = driverAction(driver);

  const linkedInstrument = ctx.watchlist.find((item) => {
    const ticker = instrumentLabel(item).toUpperCase();
    return driver.affectedInstruments.some((symbol) => symbol.toUpperCase() === ticker);
  });

  return {
    id: `focus-driver-${driver.id}`,
    kind: "driver",
    title: driver.title,
    score,
    reason: reasons,
    actionLabel: action.actionLabel,
    actionHref: action.actionHref,
    driverId: driver.id,
    instrumentId: linkedInstrument?.id,
  };
}

export function buildPreparationFocusPack(input: {
  events: PreparationEvent[];
  drivers: MarketDriver[];
  watchlist: ResolvedPreparationInstrument[];
  candlesResponse?: PreparationCandlesResponse;
  hasLiveData: boolean;
  selectedEventIds: ReadonlySet<string>;
  selectedInstrumentIds: ReadonlySet<string>;
}): PreparationFocusPack {
  const ctx: FocusScoreContext = {
    watchlist: input.watchlist,
    candlesResponse: input.candlesResponse,
    hasLiveData: input.hasLiveData,
    drivers: input.drivers,
    selectedEventIds: input.selectedEventIds,
    selectedInstrumentIds: input.selectedInstrumentIds,
  };

  const eventItems = input.events
    .map((event) => buildEventFocusItem(event, ctx))
    .filter((item) => item.score >= MIN_ITEM_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const driverItems = input.drivers
    .map((driver) => buildDriverFocusItem(driver, ctx))
    .filter((item) => item.score >= MIN_ITEM_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const instrumentItems = input.watchlist
    .filter((item) => item.market === "moex-stock" || item.market === "moex-future")
    .map((item) => buildInstrumentFocusItem(item, ctx))
    .filter((item) => item.score >= MIN_ITEM_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const manualFallbackEvents = input.events
    .filter((event) => input.selectedEventIds.has(event.id))
    .filter((event) => !eventItems.some((item) => item.eventId === event.id))
    .slice(0, 2 - eventItems.length)
    .map((event) => buildEventFocusItem(event, ctx));

  const manualFallbackInstruments = input.watchlist
    .filter((item) => input.selectedInstrumentIds.has(item.id))
    .filter((item) => !instrumentItems.some((existing) => existing.instrumentId === item.id))
    .slice(0, 4 - instrumentItems.length)
    .map((item) => buildInstrumentFocusItem(item, ctx));

  const items = [...eventItems, ...driverItems, ...instrumentItems, ...manualFallbackEvents, ...manualFallbackInstruments]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const hasManualSelections =
    input.selectedEventIds.size > 0 || input.selectedInstrumentIds.size > 0;
  const hasEnoughData =
    items.length >= MIN_PACK_ITEMS &&
    items.some((item) => item.score >= MIN_ITEM_SCORE && item.reason.length > 0);

  if (!hasEnoughData && hasManualSelections && items.length > 0) {
    return { items, hasEnoughData: true };
  }

  return { items, hasEnoughData };
}

export function applyFocusItemsToBriefing(
  items: PreparationFocusItem[],
): { eventIds: string[]; instrumentIds: string[] } {
  const eventIds = new Set<string>();
  const instrumentIds = new Set<string>();

  for (const item of items) {
    if (item.eventId) eventIds.add(item.eventId);
    if (item.instrumentId) instrumentIds.add(item.instrumentId);
  }

  return {
    eventIds: [...eventIds],
    instrumentIds: [...instrumentIds],
  };
}

export function formatFocusReasonLine(item: PreparationFocusItem): string {
  const reasons = item.reason.filter(Boolean).slice(0, 3);
  if (!reasons.length) return item.title;
  return `${item.title} — ${reasons.join(", ")}.`;
}
