import type { StrategyTimeframeMinutes } from "@/lib/screener/strategies/strategy-candles";
import type { ApproachDirection } from "@/lib/strategies/round-buffer-direction-engine";
import type { RoundLevelImportance } from "@/lib/strategies/round-levels-engine";
import type { RoundLevelOutcome, RoundLevelApproach } from "@/lib/strategies/round-level-reaction-engine";

export const STRATEGY_LAB_FIELD_LABELS = {
  ticker: "Тикер",
  load: "Загрузить",
  timeframeShort: "ТФ",
  timeframe: "Таймфрейм",
  bufferAuto: "Буфер авто",
  levels: "Уровни",
  buffers: "Буферы",
  sessions: "Сессии",
  reactions: "Реакции",
  halfLevels: "Полууровни",
  majorLevels: "Важные уровни",
  extrema: "Экстремумы",
  chartFocus: "Фокус-график",
  showAnalytics: "Показать аналитику",
  swingAnalysis: "Экстремумы (ZigZag-lite)",
  lastExtremum: "Последний экстремум",
  currentMove: "Текущее движение",
  nearestRoundLevel: "До ближайшего круглого уровня",
  instrument: "Инструмент",
  board: "Режим торгов",
  status: "Статус",
  selectedLevel: "Выбранный уровень",
  level: "Уровень",
  type: "Тип",
  buffer: "Буфер",
  bufferMode: "Режим",
  approach: "Подход",
  reactionZone: "Зона реакции",
  breakZone: "Зона слома",
  upper: "Верхний",
  lower: "Нижний",
  reaction: "Реакция",
  levelReaction: "Реакция уровня",
  touches: "Касания",
  touchCount: "Касаний",
  bounceRate: "Отбой",
  breaks: "Пробои",
  falseBreaks: "Ложные пробои",
  avgDive: "Ср. нырок",
  avgBounce: "Ср. отскок",
  technicality: "Техничность",
  chop: "Пила",
  last: "Последнее",
  bars: "Свечей",
  period: "Период",
  levelList: "Список уровней",
  selected: "выбран",
  preliminaryStats: "Статистика предварительная: мало свечей для статистики",
  noTouchesInZones: "Нет касаний в зонах",
  reactionsUnavailable: "Реакции недоступны",
  noCandles: "Нет свечей",
  noData: "Нет данных",
  loadError: "Ошибка загрузки",
  loadingCandles: "Загрузка свечей…",
  candlesFetchFailed: "Не удалось получить свечи",
  moexNoHistory: "MOEX ISS не вернул историю для этого инструмента",
  updating: "обновление…",
  updatedAt: "обновлено",
} as const;

export function formatLevelImportance(importance: RoundLevelImportance): string {
  const labels: Record<RoundLevelImportance, string> = {
    psychological: "психологический",
    major: "важный",
    normal: "обычный",
    minor: "малый",
  };
  return labels[importance];
}

export function formatLevelImportanceShort(importance: RoundLevelImportance): string {
  const labels: Record<RoundLevelImportance, string> = {
    psychological: "псих.",
    major: "важн.",
    normal: "обычн.",
    minor: "малый",
  };
  return labels[importance];
}

export function formatReactionType(reaction: RoundLevelOutcome | null | undefined): string {
  if (!reaction) return "—";
  const labels: Record<RoundLevelOutcome, string> = {
    bounce: "отбой",
    breakout: "пробой",
    false_break: "ложный пробой",
    chop: "пила",
    pending: "ждём",
  };
  return labels[reaction];
}

export function formatTouchDirection(direction: RoundLevelApproach | null | undefined): string {
  if (!direction) return "—";
  const labels: Record<RoundLevelApproach, string> = {
    from_above: "сверху",
    from_below: "снизу",
    inside: "внутри",
  };
  return labels[direction];
}

export function formatTimeframeLabel(minutes: StrategyTimeframeMinutes): string {
  if (minutes === 60) return "1 час";
  return `${minutes} мин`;
}

export function formatTimeframeHeader(minutes: StrategyTimeframeMinutes): string {
  if (minutes === 60) return "1ч";
  return `${minutes}м`;
}

export function formatTimeframeToolbar(minutes: StrategyTimeframeMinutes): string {
  if (minutes === 60) return "1h";
  return `${minutes}m`;
}

export function formatBufferMode(options: {
  bufferAuto: boolean;
  customBuffer: string;
  autoSize?: number | null;
}): string {
  if (options.bufferAuto) {
    if (options.autoSize != null && Number.isFinite(options.autoSize)) {
      return `авто · ${options.autoSize.toFixed(2)}`;
    }
    return "авто";
  }
  const value = options.customBuffer.trim();
  return value ? `ручной ${value}` : "ручной";
}

export function formatTouchesShort(count: number): string {
  return `${count} к.`;
}

export function formatBarsToReaction(count: number | null | undefined): string {
  if (count == null) return "—";
  return String(count);
}

export function formatApproachDirection(direction: ApproachDirection | null | undefined): string {
  if (!direction || direction === "unknown") return "не определён";
  const labels: Record<Exclude<ApproachDirection, "unknown">, string> = {
    up_to_level: "снизу вверх",
    down_to_level: "сверху вниз",
  };
  return labels[direction];
}

export function formatZigZagPivotType(type: "high" | "low" | null | undefined): string {
  if (!type) return "—";
  return type === "high" ? "максимум" : "минимум";
}

export function formatZigZagMovementDirection(
  direction: "up" | "down" | "unknown" | null | undefined,
): string {
  if (!direction || direction === "unknown") return "не определено";
  return direction === "up" ? "вверх" : "вниз";
}
