/**
 * Единый словарь коротких трейдерских флагов — Market Radar, таблица, карточки.
 * В строках и бейджах — только SHORT. Подробности — DETAIL и title/tooltip.
 */

/** Короткие подписи (читаются за ~1 с). */
export const TRADER_SIGNAL_SHORT = {
  volume: "объём",
  trades: "сделки",
  activity: "активность",
  liquidity: "ликвидность",
  wideDay: "широкий день",
  strongMove: "сильный ход",
  nearHigh: "у high",
  nearLow: "у low",
  breakoutHigh: "пробой high",
  breakoutLow: "пробой low",
  selloff: "пролив",
  bounce: "выкуп",
  baselineOk: "20d ok",
  rough: "rough",
  noBaseline: "нет базы",
  partial: "частично",
  inPlay: "в игре",
  active: "активно",
  shot: "прострел",
  impulse: "импульс",
  impulseUp: "импульс вверх",
  impulseDown: "импульс вниз",
  hard: "HARD",
  range: "диапазон",
  turnover: "оборот",
  thinRun: "тонкий разгон",
  pressure: "давление",
  illiquidRisk: "неликвид",
  leaderLiquidity: "ликвидность",
} as const;

/** Ключи причин Market Radar → короткая подпись в строке. */
export const MARKET_RADAR_REASON_LABELS = {
  liquidity: "деньги",
  volumeRatio: "оборот",
  tradesRatio: "сделки",
  wideRange: "диапазон",
  nearHigh: TRADER_SIGNAL_SHORT.nearHigh,
  nearLow: TRADER_SIGNAL_SHORT.nearLow,
  breakoutHigh: TRADER_SIGNAL_SHORT.breakoutHigh,
  breakoutLow: TRADER_SIGNAL_SHORT.breakoutLow,
  strongMove: TRADER_SIGNAL_SHORT.strongMove,
  selloff: TRADER_SIGNAL_SHORT.selloff,
  bounce: TRADER_SIGNAL_SHORT.bounce,
  highTurnover: TRADER_SIGNAL_SHORT.liquidity,
  manyTrades: TRADER_SIGNAL_SHORT.trades,
  illiquidRisk: TRADER_SIGNAL_SHORT.illiquidRisk,
  activity: "актив",
  noBaseline: TRADER_SIGNAL_SHORT.noBaseline,
  roughBaseline: TRADER_SIGNAL_SHORT.rough,
  partialBaseline: TRADER_SIGNAL_SHORT.partial,
  hard: "в игре",
  impulse: "диапазон",
  impulseUp: "high",
  impulseDown: "low",
} as const;

export type MarketRadarReasonKey = keyof typeof MARKET_RADAR_REASON_LABELS;

/** Развёрнутые подписи для hover / title (логика сигналов не меняется). */
export const MARKET_RADAR_REASON_DETAIL: Partial<Record<MarketRadarReasonKey, string>> = {
  liquidity: "В топе по обороту или сделкам в universe",
  volumeRatio: "Оборот выше обычного к этому же времени сессии",
  tradesRatio: "Сделки выше обычного к этому же времени сессии",
  wideRange: "Широкий дневной диапазон (high–low)",
  nearHigh: "Цена у верхней границы дневного диапазона",
  nearLow: "Цена у нижней границы дневного диапазона",
  breakoutHigh: "Пробой верхней границы дня с подтверждением хода",
  breakoutLow: "Пробой нижней границы дня с подтверждением хода",
  strongMove: "Сильное изменение цены относительно открытия",
  selloff: "Резкое снижение, пролив от верхней зоны",
  bounce: "Выкуп от низа дня",
  highTurnover: "Лидер по обороту в блоке",
  manyTrades: "Высокая активность сделок",
  activity: "Комбинированная активность (score / ранги)",
  noBaseline: "Нет надёжной базы сравнения к этому времени",
  roughBaseline: "Rough baseline: дневной avg × ход сессии",
  partialBaseline: "Частичный intraday baseline (< полной истории)",
  illiquidRisk: "Риск неликвида: низкий оборот и сделки",
  hard: "Сводный HARD-score аномалии ≥ порога",
  impulse: "Ускорение / пробой / расширение хода (детектор импульса дня)",
  impulseUp: "Положительный импульс относительно открытия",
  impulseDown: "Отрицательный импульс относительно открытия",
};

export function getMarketRadarReasonLabel(key: MarketRadarReasonKey): string {
  return MARKET_RADAR_REASON_LABELS[key];
}

export function getMarketRadarReasonDetail(key: MarketRadarReasonKey): string | null {
  return MARKET_RADAR_REASON_DETAIL[key] ?? null;
}

/** Теги из parseInPlayReasonTags → короткая подпись. */
export const TRADER_TAG_SHORT: Record<string, string> = {
  оборот: TRADER_SIGNAL_SHORT.volume,
  сделки: TRADER_SIGNAL_SHORT.trades,
  диапазон: TRADER_SIGNAL_SHORT.wideDay,
  импульс: TRADER_SIGNAL_SHORT.impulse,
};

/** Статус строки таблицы → короткая причина (колонка «Причина»). */
export const TABLE_STATUS_REASON_SHORT: Record<string, string> = {
  "В игре": TRADER_SIGNAL_SHORT.inPlay,
  Импульс: TRADER_SIGNAL_SHORT.impulse,
  Давление: TRADER_SIGNAL_SHORT.pressure,
  "Тонкий разгон": TRADER_SIGNAL_SHORT.thinRun,
  Ликвид: TRADER_SIGNAL_SHORT.leaderLiquidity,
};

/** Части server reasonLabel (in-play score) → короткие теги. */
const SERVER_REASON_PART_SHORT: Record<string, string> = {
  turnover: TRADER_SIGNAL_SHORT.volume,
  trades: TRADER_SIGNAL_SHORT.trades,
  range: TRADER_SIGNAL_SHORT.wideDay,
  Объем: TRADER_SIGNAL_SHORT.volume,
  Объём: TRADER_SIGNAL_SHORT.volume,
  Сделки: TRADER_SIGNAL_SHORT.trades,
  Диапазон: TRADER_SIGNAL_SHORT.wideDay,
  объём: TRADER_SIGNAL_SHORT.volume,
  оборот: TRADER_SIGNAL_SHORT.volume,
  сделки: TRADER_SIGNAL_SHORT.trades,
  "широкий день": TRADER_SIGNAL_SHORT.wideDay,
  диапазон: TRADER_SIGNAL_SHORT.wideDay,
};

const LONG_PHRASE_TO_SHORT: Record<string, string> = {
  "высокий оборот": TRADER_SIGNAL_SHORT.volume,
  "активная лента": TRADER_SIGNAL_SHORT.trades,
  "широкий диапазон": TRADER_SIGNAL_SHORT.wideDay,
  "широкий ход": TRADER_SIGNAL_SHORT.wideDay,
  "сильное движение": TRADER_SIGNAL_SHORT.strongMove,
  "импульс дня": TRADER_SIGNAL_SHORT.impulse,
  "лидер ликвидности": TRADER_SIGNAL_SHORT.leaderLiquidity,
  "тонкий разгон": TRADER_SIGNAL_SHORT.thinRun,
};

function normalizeReasonPart(part: string): string | null {
  const trimmed = part.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (LONG_PHRASE_TO_SHORT[lower]) return LONG_PHRASE_TO_SHORT[lower];
  if (SERVER_REASON_PART_SHORT[trimmed]) return SERVER_REASON_PART_SHORT[trimmed];
  if (SERVER_REASON_PART_SHORT[lower]) return SERVER_REASON_PART_SHORT[lower];
  if (trimmed.length <= 24) return trimmed;
  return null;
}

/** «Объем + Сделки» / «высокий оборот · активная лента» → «объём · сделки». */
export function normalizeReasonLabelShort(raw: string): string {
  const parts = raw
    .split(/[+·]/)
    .map((part) => normalizeReasonPart(part))
    .filter((part): part is string => Boolean(part));
  if (parts.length) return [...new Set(parts)].slice(0, 3).join(" · ");
  return raw.length <= 28 ? raw : TRADER_SIGNAL_SHORT.activity;
}

/** Две главные компоненты in-play score для server reasonLabel. */
export function formatServerInPlayReason(
  primary: "turnover" | "trades" | "range",
  secondary: "turnover" | "trades" | "range",
): string {
  const a = SERVER_REASON_PART_SHORT[primary] ?? primary;
  const b = SERVER_REASON_PART_SHORT[secondary] ?? secondary;
  return `${a} · ${b}`;
}

export function formatTraderTagShort(tag: string): string {
  return TRADER_TAG_SHORT[tag] ?? tag;
}
