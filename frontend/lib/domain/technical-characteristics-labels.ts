import type { TechnicalCharacteristicsRow, ValueWithStatus } from "@/lib/materials/contracts";

export type TechnicalCharacteristicsColumnKey =
  | "instrument"
  | "ticker"
  | "assetClass"
  | "lotSize"
  | "currentPrice"
  | "lotPrice"
  | "priceStep"
  | "stepValue"
  | "spreadPct"
  | "tradesCount"
  | "turnoverRubMln"
  | "turnoverPerTradeRubK"
  | "largeLotRubMln"
  | "intradayUsabilityScore"
  | "entryFriction"
  | "commissionToRangeScore"
  | "daysToExpiry"
  | "contractSize"
  | "marginFootprintRub"
  | "board"
  | "scalabilityHint";

/** Подсказка для ячеек и полей без данных в MOEX ISS */
export const TC_UNAVAILABLE_HINT = "Данные недоступны в MOEX ISS";

export const TC_COLUMN_LABELS: Record<TechnicalCharacteristicsColumnKey, string> = {
  instrument: "Инструмент",
  ticker: "Тикер",
  assetClass: "Тип",
  lotSize: "Лот",
  currentPrice: "Цена",
  lotPrice: "Цена лота",
  priceStep: "Шаг цены",
  stepValue: "Стоимость шага",
  spreadPct: "Спред, %",
  tradesCount: "Сделки",
  turnoverRubMln: "Оборот",
  turnoverPerTradeRubK: "Оборот на сделку",
  largeLotRubMln: "1% оборота",
  intradayUsabilityScore: "Готовность к торговле",
  entryFriction: "Трение входа",
  commissionToRangeScore: "Цена ошибки",
  daysToExpiry: "Дней до экспирации",
  contractSize: "Размер контракта",
  marginFootprintRub: "ГО",
  board: "Режим торгов",
  scalabilityHint: "Пригодность",
};

/** Краткие единицы в заголовке (где нужно уточнить масштаб) */
export const TC_COLUMN_LABEL_UNITS: Partial<Record<TechnicalCharacteristicsColumnKey, string>> = {
  lotSize: "шт/контр.",
  currentPrice: "₽",
  lotPrice: "₽",
  priceStep: "₽",
  stepValue: "₽",
  turnoverRubMln: "млн ₽",
  turnoverPerTradeRubK: "тыс ₽",
  largeLotRubMln: "млн ₽",
  intradayUsabilityScore: "0–100",
  commissionToRangeScore: "0–100",
  marginFootprintRub: "₽",
};

export function getColumnHeaderLabel(key: TechnicalCharacteristicsColumnKey, compact = false): string {
  if (compact && TC_COLUMN_SHORT_LABELS[key]) return TC_COLUMN_SHORT_LABELS[key]!;
  const base = TC_COLUMN_LABELS[key];
  const units = compact ? undefined : TC_COLUMN_LABEL_UNITS[key];
  return units ? `${base}, ${units}` : base;
}

export const TC_COLUMN_TOOLTIPS: Partial<Record<TechnicalCharacteristicsColumnKey, string>> = {
  lotSize: "Сколько бумаг или контрактов в одном лоте. От этого зависит минимальный размер сделки.",
  lotPrice: "Сколько рублей стоит купить или продать один лот по текущей цене.",
  priceStep: "На сколько рублей может измениться котировка за один минимальный шаг.",
  stepValue: "Сколько рублей вы получите или потеряете, если цена сдвинется на один шаг (шаг цены × размер лота).",
  spreadPct: "Разница между лучшей покупкой и продажей в процентах от цены. Узкий спред — дешевле входить.",
  tradesCount: "Сколько сделок прошло за сессию. Больше сделок — активнее рынок и проще войти/выйти.",
  turnoverRubMln: "Сколько денег прошло через инструмент за сессию. Высокий оборот — выше ликвидность.",
  turnoverPerTradeRubK: "Средний размер одной сделки в деньгах. Помогает понять, насколько крупные участники проходят через инструмент.",
  largeLotRubMln: "Оценка крупного объёма: сколько рублей примерно соответствует 1% текущего оборота инструмента.",
  intradayUsabilityScore:
    "Сводная оценка: ликвидность, спред, сделки, оборот и удобство входа. Чем выше — тем комфортнее инструмент для внутридневной торговли.",
  entryFriction:
    "Насколько дорого и неудобно входить в инструмент: спред, комиссия, шаг цены и стоимость ошибки. Чем ниже — тем легче вход.",
  commissionToRangeScore:
    "Сколько может стоить неточный вход: шаг цены, стоимость шага, спред и размер лота. Сравнительный индекс 0–100.",
  daysToExpiry: "Сколько календарных дней до экспирации фьючерса.",
  contractSize: "Номинал или множитель контракта — сколько базового актива в одном фьючерсе.",
  board: "Режим торгов на MOEX (например TQBR для акций, FORTS для фьючерсов).",
  scalabilityHint: "Краткая подсказка: насколько инструмент подходит для скальпа или интрадея при текущих условиях.",
};

export const TC_INSPECTOR_LABELS = {
  lotEconomics: "Лот-экономика",
  commissionCover: "Покрытие комиссии",
  spreadCost: "Стоимость спреда",
  costToBeWrong: "Цена ошибки",
  liquidity: "Ликвидность",
  intradayScore: "Интрадей-оценка",
  commissionVsRange: "Комиссия против диапазона",
  entryFriction: "Трение входа",
  fieldConfidence: "Достоверность полей",
  underlying: "Базовый актив",
  expiry: "Экспирация",
  margin: "ГО / маржинальность",
} as const;

export const TC_INSPECTOR_TOOLTIPS: Partial<Record<keyof typeof TC_INSPECTOR_LABELS, string>> = {
  lotEconomics: "Стоимость одного лота в рублях по текущей цене.",
  commissionCover: "Сколько пунктов цены нужно пройти, чтобы комиссия окупилась относительно стоимости шага.",
  spreadCost: "Сколько рублей «стоит» спред при входе и сколько это в шагах цены.",
  costToBeWrong: "Сколько рублей теряется при ошибке на 1, 5 или 10 шагов цены.",
  liquidity: "Оценка ликвидности по обороту и сделкам плюс краткая пригодность для стиля торговли.",
  intradayScore: "Та же сводная оценка, что «Готовность к торговле» в таблице: спред, поток и оборот.",
  commissionVsRange: "Насколько комиссия «съедает» типичный внутридневной диапазон — чем меньше, тем лучше.",
  entryFriction: "Насколько дорого и неудобно входить: спред, комиссия, шаг цены и цена ошибки.",
  fieldConfidence: "Доля полей, подтверждённых MOEX ISS без пропусков.",
};

export const TC_LIQUIDITY_LABELS: Record<string, string> = {
  high: "высокая",
  medium: "средняя",
  low: "низкая",
  unknown: "неизвестна",
};

export const TC_COLUMN_SHORT_LABELS: Partial<Record<TechnicalCharacteristicsColumnKey, string>> = {
  lotSize: "Лот",
  currentPrice: "Цена",
  lotPrice: "Цена лота",
  priceStep: "Шаг",
  stepValue: "Шаг, ₽",
  spreadPct: "Спред, %",
  tradesCount: "Сделки",
  turnoverRubMln: "Оборот",
  turnoverPerTradeRubK: "Оборот/сд.",
  intradayUsabilityScore: "Готовность",
  commissionToRangeScore: "Цена ошибки",
  entryFriction: "Трение",
};

export const TC_UI = {
  pageDescription:
    "Помощник по выбору инструмента: лот, шаг цены, спред, сделки, оборот и пригодность под стиль торговли.",
  compactDensity: "Компактно",
  comfortableDensity: "Удобно",
  heatMetric: "Подсветка",
  lessonMode: "Режим урока",
  allBoards: "Все режимы",
  instrumentsCount: "Инструментов",
  medianSpread: "Медианный спред, %",
  totalTurnover: "Суммарный оборот, млн ₽",
  avgTrades: "Среднее число сделок",
  sourceOnline: "MOEX ISS в сети",
  sourceFallback: "Резерв / временно недоступно",
  formulasTitle: "Формулы",
  sourceTitle: "Источник данных",
  presetMatchColumn: "Почему подходит",
  presetScoreColumn: "Оценка",
  tableFootnote: "Единицы указаны в заголовках. «—» — нет данных в MOEX ISS.",
  selectInstrument: "Выберите инструмент в таблице.",
  loading: "Загрузка технических характеристик…",
  loadError: "Ошибка загрузки. Показаны последние доступные данные, если есть.",
  noRows: "Нет данных по выбранным фильтрам.",
} as const;

export const TC_FORMULAS: Array<{ title: string; expression: string }> = [
  { title: "Цена лота", expression: "цена × размер лота" },
  { title: "Стоимость шага", expression: "шаг цены × размер лота" },
  { title: "Спред в рублях", expression: "лучшая продажа − лучшая покупка" },
  { title: "Спред, %", expression: "спред ÷ цена × 100" },
  { title: "Оборот на сделку", expression: "оборот ÷ количество сделок" },
  { title: "1% оборота", expression: "оборот × 0,01" },
  { title: "Денежная нагрузка входа", expression: "цена лота + спред + комиссия (если комиссия доступна)" },
  { title: "Цена ошибки", expression: "стоимость шага × число шагов ошибки (если доступно)" },
  { title: "Пункты до комиссии", expression: "комиссия ÷ стоимость шага" },
  { title: "Трение входа", expression: "производный индекс: спред, оборот и число сделок (чем ниже — тем легче вход)" },
  { title: "Готовность к торговле", expression: "сводный балл 0–100: спред, сделки, оборот и удобство входа" },
];

export const TC_PRESET_LABELS: Record<string, string> = {
  scalp: "Скальп",
  intraday: "Интрадей",
  liquidity: "Ликвидность",
  stocks: "Акции",
  futures: "Фьючерсы",
};

/** Поля строки, привязанные к колонкам с ValueWithStatus */
export const TC_COLUMN_VALUE_FIELDS: Partial<Record<TechnicalCharacteristicsColumnKey, keyof TechnicalCharacteristicsRow>> = {
  lotSize: "lotSize",
  currentPrice: "currentPrice",
  lotPrice: "lotPrice",
  priceStep: "priceStep",
  stepValue: "stepValue",
  spreadPct: "spreadPct",
  tradesCount: "tradesCount",
  turnoverRubMln: "turnoverRub",
  turnoverPerTradeRubK: "turnoverPerTradeRub",
  largeLotRubMln: "largeLotRub",
  intradayUsabilityScore: "intradayUsabilityScore",
  commissionToRangeScore: "commissionToRangeScore",
  daysToExpiry: "daysToExpiry",
  contractSize: "contractSize",
  marginFootprintRub: "marginFootprintRub",
};

export function formatMetricCell(
  field: ValueWithStatus | undefined,
  formatValue: (value: number) => string,
): { text: string; title?: string } {
  if (!field || field.value === null) {
    return { text: "—", title: TC_UNAVAILABLE_HINT };
  }
  return { text: formatValue(field.value) };
}

export function liquidityLabel(code: string): string {
  return TC_LIQUIDITY_LABELS[code] ?? code;
}
