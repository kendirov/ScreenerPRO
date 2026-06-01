/**
 * Единый конфиг Market Radar — меняйте пороги только здесь.
 *
 * Временные значения до стабильного historical baseline.
 * UI и селекторы читают этот файл; в JSX порогов нет.
 */

/** Ключи причин / бейджей → подписи в интерфейсе. */
export const MARKET_RADAR_REASON_LABELS = {
  liquidity: "ликвидность",
  highTurnover: "высокий оборот",
  manyTrades: "много сделок",
  wideRange: "широкий диапазон",
  nearHigh: "цена у high",
  nearLow: "цена у low",
  breakoutHigh: "пробой high",
  breakoutLow: "пробой low",
  strongMove: "сильное движение",
  illiquidRisk: "риск неликвида",
} as const;

export type MarketRadarReasonKey = keyof typeof MARKET_RADAR_REASON_LABELS;

export function getMarketRadarReasonLabel(key: MarketRadarReasonKey): string {
  return MARKET_RADAR_REASON_LABELS[key];
}

/** Порядок сортировки ликвидности (по убыванию). */
export type MarketRadarLiquiditySortField = "turnover" | "trades";

export const MARKET_RADAR_CONFIG = {
  /** Блок «Где ликвидность» — фиксированный топ-N. */
  liquidity: {
    topN: 5,
    sortBy: ["turnover", "trades"] as const satisfies readonly MarketRadarLiquiditySortField[],
  },

  /**
   * Блок «Кто в игре» — все инструменты выше порога.
   * При отсутствии inPlayScore — fallback по перцентилям и high/low.
   */
  inPlay: {
    minInPlayScore: 65,
    /** Сколько fallback-сигналов нужно одновременно (если нет score). */
    fallbackMinSignals: 2,
    /** Мин. перцентиль оборота в fallback (0–100). */
    fallbackMinTurnoverPercentile: 62,
    /** Мин. перцентиль сделок в fallback (0–100). */
    fallbackMinTradesPercentile: 62,
    /** Мин. перцентиль диапазона или абс. ход дня, %. */
    fallbackMinRangePercentile: 58,
    fallbackMinDayRangePct: 1.0,
    /** Учитывать близость к high/low и пробои. */
    includeHighLowProximity: true,
    /** Позиция в диапазоне дня (0–1) для «у high» / «у low». */
    nearExtremePosition: 0.78,
    /** Мин. изменение % для пробоя high/low. */
    breakoutMinChangePct: 0.35,
  },

  /**
   * Блок «Где волатильность» — все инструменты выше порога хода дня.
   * Неликвид отсекается через isStockIlliquid (доля от лидера + пол).
   */
  volatility: {
    /** Мин. |dayRangePct| для попадания в список, %. */
    minRangePct: 1.5,
    /**
     * Доп. фильтр по |changePct| (null = не требовать для попадания в список).
     * Бейдж «сильное движение» использует это значение, если задано.
     */
    minAbsChangePct: null as number | null,
    /** Использовать общий фильтр неликвида из stock-screener-display. */
    useIlliquidFilter: true,
    /** Пороги бейджей внутри списка. */
    wideDayRangePct: 2.4,
    wideDayRangePercentile: 72,
    riskMinDayRangePct: 2.0,
    riskMaxTurnoverPercentile: 42,
    riskMaxTradesPercentile: 42,
    /** Подсветка «сильное движение», если minAbsChangePct не задан. */
    highlightMinAbsChangePct: 1.5,
  },

  /**
   * Высота радара (px) — фиксированный блок, таблица сразу ниже.
   * scrollAfterCount: при большем числе строк — compact scroll в колонке.
   */
  layout: {
    /** Компактный trading cockpit — таблица сразу под радаром. */
    minHeightPx: 168,
    maxHeightPx: 192,
    liquidityFixedRows: 5,
    scrollAfterCount: 5,
    visibleRowsInScroll: 5,
    rowHeightPx: 17,
  },
} as const;
