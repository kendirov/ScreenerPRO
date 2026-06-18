import type { ScreenerRow } from "@screenerpro/shared";
import { computePositionInRange } from "@/lib/domain/stock-sparkline";
import {
  getStockActivityDisplayLabel,
  isStockInPlay,
  parseInPlayReasonTags,
} from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";

/**
 * Радар «В игре» vs «Импульс»
 *
 * **В игре**
 * - общий score активности (IN_PLAY);
 * - оборот + сделки + ход;
 * - подходит для списка наблюдения.
 *
 * **Импульс**
 * - событие ускорения / пробоя / давления;
 * - акцент на изменение, ход, пробой, давление;
 * - подходит для быстрого открытия графика.
 */

export type StockImpulseDataStatus = "live" | "partial" | "no-yesterday" | "no-data";

export type ImpulseEventType =
  | "ускорение вверх"
  | "ускорение вниз"
  | "пробой high"
  | "пробой low"
  | "расширение хода"
  | "давление усилилось"
  | "объём пришёл"
  | "тонкий вынос";

export type StockImpulseSignal = {
  ticker: string;
  changePct: number | null;
  rangePct: number | null;
  turnover: number | null;
  trades: number | null;
  relativeTurnover: number | null;
  impulseScore: number;
  eventType: ImpulseEventType;
  eventLabel: string;
  eventReason: string;
  differsFromInPlay: string;
  dataStatus: StockImpulseDataStatus;
};

export type MoneyRowStatus = "ликвид" | "в игре" | "лидер";

const IMPULSE_SURFACE_LABEL: Record<ImpulseEventType, string> = {
  "ускорение вверх": "ускорение",
  "ускорение вниз": "ускорение",
  "пробой high": "пробой high",
  "пробой low": "пробой low",
  "расширение хода": "расширение",
  "давление усилилось": "давление",
  "объём пришёл": "объём",
  "тонкий вынос": "тонкий вынос",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Оборот относительно вчера к текущему времени сессии. */
export function computeRelativeTurnover(row: ScreenerRow): number | null {
  const turnover = row.turnover;
  const previousDay = row.metrics.previousDayTurnoverRub;
  if (turnover == null || previousDay == null || previousDay <= 0) return null;

  const progress = row.metrics.sessionProgress;
  const baseline =
    progress != null && progress > 0 ? previousDay * clamp(progress, 0.05, 1) : previousDay;
  if (baseline <= 0) return null;
  return turnover / baseline;
}

function resolveImpulseDataStatus(row: ScreenerRow, relativeTurnover: number | null): StockImpulseDataStatus {
  const hasCore =
    row.turnover != null ||
    row.percentChange != null ||
    row.metrics.dayRangePct != null ||
    (row.tradesCount ?? 0) > 0;
  if (!hasCore) return "no-data";
  if (relativeTurnover != null) return "live";
  if (row.metrics.turnoverVsAverage != null || row.metrics.activityRatio != null) return "partial";
  return "no-yesterday";
}

/** Короткий оборот для чипов: 830 млн → «830м», 3,9 млрд → «3,9 млрд». */
export function formatTurnoverChipShort(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null;
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} млрд`;
  }
  if (abs >= 1_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value / 1_000_000)}м`;
  }
  if (abs >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

/** Короткий формат сделок для чипов: 48000 → «48k». */
export function formatTradesShort(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null;
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(m)}m`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

/** Компактный формат сделок: 92000 → «92 тыс»; null/0 → null. */
export function formatTradesCompact(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null;
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(m)} млн`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)} тыс`;
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

type ImpulseCandidate = {
  type: ImpulseEventType;
  score: number;
  reason: string;
};

/** Детектор импульса дня (ускорение, пробой, расширение) — для таблицы импульсов и Market Radar shots. */
export function detectStockImpulseEvent(
  row: ScreenerRow,
  position?: number | null,
): ImpulseCandidate | null {
  const pos =
    position ?? computePositionInRange(row.lastPrice, row.low, row.high);
  return detectImpulseEvent(row, pos);
}

function detectImpulseEvent(row: ScreenerRow, position: number | null): ImpulseCandidate | null {
  const change = row.percentChange ?? 0;
  const range = Math.abs(row.metrics.dayRangePct ?? 0);
  const turnoverPct = row.metrics.turnoverPercentile ?? 0;
  const tradesPct = row.metrics.tradesPercentile ?? 0;
  const rangePct = row.metrics.rangePercentile ?? 0;
  const relativeTurnover = computeRelativeTurnover(row);
  const activityHigh = turnoverPct >= 60 || tradesPct >= 60;
  const candidates: ImpulseCandidate[] = [];

  if (range >= 2.0 && turnoverPct < 45 && tradesPct < 45) {
    candidates.push({
      type: "тонкий вынос",
      score: range * 14 + Math.abs(change) * 8,
      reason: "широкий ход при слабом обороте и сделках",
    });
  }

  if (position != null && position >= 0.82 && change > 0.25) {
    candidates.push({
      type: "пробой high",
      score: position * 40 + change * 10 + range * 4,
      reason: "цена у верха дня с положительным изменением",
    });
  }

  if (position != null && position <= 0.18 && change < -0.25) {
    candidates.push({
      type: "пробой low",
      score: (1 - position) * 40 + Math.abs(change) * 10 + range * 4,
      reason: "цена у низа дня с отрицательным изменением",
    });
  }

  if (change >= 0.85 && range >= 1.0) {
    candidates.push({
      type: "ускорение вверх",
      score: change * 16 + range * 6,
      reason: "рост ускоряется на фоне хода",
    });
  }

  if (change <= -0.85 && range >= 1.0) {
    candidates.push({
      type: "ускорение вниз",
      score: Math.abs(change) * 16 + range * 6,
      reason: "снижение ускоряется на фоне хода",
    });
  }

  if (change <= -1.0 && (activityHigh || range >= 1.8)) {
    candidates.push({
      type: "давление усилилось",
      score: Math.abs(change) * 14 + range * 5 + (activityHigh ? 8 : 0),
      reason: "отрицательное изменение при активности или широком ходе",
    });
  }

  if (
    (relativeTurnover != null && relativeTurnover >= 1.25) ||
    (row.metrics.turnoverVsAverage ?? 0) >= 1.35
  ) {
    candidates.push({
      type: "объём пришёл",
      score: (relativeTurnover ?? row.metrics.turnoverVsAverage ?? 1) * 18 + turnoverPct * 0.2,
      reason: "оборот выше нормы сессии или среднего",
    });
  }

  if (range >= 2.2 || rangePct >= 72) {
    candidates.push({
      type: "расширение хода",
      score: range * 10 + rangePct * 0.25,
      reason: "диапазон дня расширился относительно рынка",
    });
  }

  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
}

function buildDiffersFromInPlay(row: ScreenerRow, event: ImpulseCandidate): string {
  if (isStockInPlay(row)) {
    return `есть в «В игре», но импульс — ${event.reason.toLowerCase()}`;
  }
  return "не в «В игре» — отдельное рыночное событие";
}

const IMPULSE_MOVEMENT_EVENTS = new Set<ImpulseEventType>([
  "ускорение вверх",
  "ускорение вниз",
  "пробой high",
  "пробой low",
  "расширение хода",
  "давление усилилось",
  "тонкий вынос",
]);

export function buildStockImpulseSignals(rows: ScreenerRow[], limit = 5): StockImpulseSignal[] {
  const stocks = rows.filter((row) => row.assetClass === "stock");
  if (!stocks.length) return [];

  const signals = stocks
    .map((row) => {
      const position = computePositionInRange(row.lastPrice, row.low, row.high);
      const event = detectImpulseEvent(row, position);
      if (!event) return null;

      const relativeTurnover = computeRelativeTurnover(row);

      return {
        ticker: row.ticker,
        changePct: row.percentChange,
        rangePct: row.metrics.dayRangePct,
        turnover: row.turnover,
        trades: row.tradesCount ?? null,
        relativeTurnover,
        impulseScore: event.score,
        eventType: event.type,
        eventLabel: IMPULSE_SURFACE_LABEL[event.type],
        eventReason: event.reason,
        differsFromInPlay: buildDiffersFromInPlay(row, event),
        dataStatus: resolveImpulseDataStatus(row, relativeTurnover),
      } satisfies StockImpulseSignal;
    })
    .filter((signal): signal is StockImpulseSignal => signal != null)
    .filter((signal) => {
      const row = stocks.find((entry) => entry.ticker === signal.ticker);
      if (!row || !isStockInPlay(row)) return true;
      return IMPULSE_MOVEMENT_EVENTS.has(signal.eventType);
    });

  return signals.sort((a, b) => b.impulseScore - a.impulseScore).slice(0, limit);
}

export function selectMoneyLeaders(rows: ScreenerRow[], limit = 5): ScreenerRow[] {
  return [...rows]
    .filter((row) => row.assetClass === "stock")
    .sort((a, b) => {
      const turnoverDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
      if (turnoverDiff !== 0) return turnoverDiff;
      return (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
    })
    .slice(0, limit);
}

export function selectInPlayForRadar(rows: ScreenerRow[]): ScreenerRow[] {
  return [...rows]
    .filter((row) => row.assetClass === "stock" && isStockInPlay(row))
    .sort((a, b) => (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0));
}

export function getMoneyRowStatus(row: ScreenerRow, maxTurnover: number): MoneyRowStatus {
  if (isStockInPlay(row)) return "в игре";
  const label = getStockActivityDisplayLabel(row, maxTurnover);
  if (label === "Лидер" || (maxTurnover > 0 && (row.turnover ?? 0) >= maxTurnover * 0.9)) return "лидер";
  return "ликвид";
}

/** 2–3 коротких чипа со значениями для карточки «В игре». */
export function buildInPlaySurfaceChips(row: ScreenerRow, position: number | null): string[] {
  const chips: { label: string; weight: number }[] = [];

  const tradesShort = formatTradesShort(row.tradesCount);
  if (tradesShort) {
    chips.push({ label: `${tradesShort} сделок`, weight: (row.metrics.tradesPercentile ?? 0) + 10 });
  }

  const turnoverShort = formatTurnoverChipShort(row.turnover);
  if (turnoverShort) {
    chips.push({ label: turnoverShort, weight: (row.metrics.turnoverPercentile ?? 0) + 8 });
  }

  const range = row.metrics.dayRangePct;
  if (range != null && Math.abs(range) >= 0.5) {
    chips.push({
      label: `диап. ${tradingFormat.formatDayRangeMagnitude(range)}`,
      weight: Math.abs(range) * 12,
    });
  }

  if ((row.percentChange ?? 0) <= -1.0) {
    chips.push({ label: "давление", weight: Math.abs(row.percentChange ?? 0) * 14 });
  }

  if ((row.metrics.turnoverVsAverage ?? 0) >= 1.25) {
    chips.push({ label: "объём", weight: (row.metrics.turnoverVsAverage ?? 0) * 18 });
  }

  if (position != null && position >= 0.72) {
    chips.push({ label: "у high", weight: 72 });
  } else if (position != null && position <= 0.28) {
    chips.push({ label: "у low", weight: 72 });
  }

  const seen = new Set<string>();
  return chips
    .sort((a, b) => b.weight - a.weight)
    .filter(({ label }) => {
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    })
    .slice(0, 3)
    .map(({ label }) => label);
}

/** Текст «почему попал» для tooltip «В игре». */
export function buildInPlayInclusionReason(row: ScreenerRow): string {
  const tags = parseInPlayReasonTags(row);
  const tagLabels: Record<string, string> = {
    оборот: "оборот",
    сделки: "сделки",
    диапазон: "диапазон",
    импульс: "импульс",
  };
  if (tags.length) {
    return `совпали признаки: ${tags.map((tag) => tagLabels[tag] ?? tag).join(" · ")}`;
  }
  return "высокая активность по обороту и сделкам";
}

/** @deprecated Используйте buildInPlaySurfaceChips — чипы со значениями. */
export function buildInPlayReasonChips(row: ScreenerRow): string[] {
  const position = computePositionInRange(row.lastPrice, row.low, row.high);
  return buildInPlaySurfaceChips(row, position);
}

export function formatRelativeTurnoverLabel(value: number | null): string | null {
  if (value == null) return null;
  const pct = (value - 1) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(pct)}% к вчера`;
}
