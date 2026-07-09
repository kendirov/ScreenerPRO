/**
 * Режимы строгости отбора «В игре» — единый источник порогов.
 * Спецификация: docs/MARKET_PRIORITY_PAGE_MODEL.md
 *
 * Score не участвует в gate — только сортировка после confirmed selection.
 */

export type MarketPriorityMode = "strict" | "balanced" | "wide";

export type MarketPriorityInPlayPreset = {
  label: string;
  tooltip: string;
  maxInPlay: number;
  /** Минимум confirmed boolean-сигналов (activity | range | direction | participation) */
  minConfirmedSignals: number;
  /** Strict/Balanced: обязателен activity или range */
  requireActivityOrRange: boolean;
  /** Balanced: допускается пара direction + participation без activity/range */
  allowDirectionParticipationPair: boolean;
  allowSoftRisk: boolean;
};

export const MARKET_PRIORITY_MODE_STORAGE_KEY = "screenerpro.marketPriority.mode";

/** Режим In Play на `/screener/stocks` — независим от главной «Рынок». */
export const STOCK_SCREENER_PRIORITY_MODE_STORAGE_KEY = "screenerpro.stockScreener.priorityMode";

export const STOCK_SCREENER_FOCUS_PRESETS: Record<
  MarketPriorityMode,
  { maxFocus: number; allowSoftRisk: boolean }
> = {
  strict: {
    maxFocus: 8,
    allowSoftRisk: false,
  },
  balanced: {
    maxFocus: 12,
    allowSoftRisk: true,
  },
  wide: {
    maxFocus: 20,
    allowSoftRisk: true,
  },
};

export const MARKET_PRIORITY_PRESETS: Record<MarketPriorityMode, MarketPriorityInPlayPreset> = {
  strict: {
    label: "Strict",
    tooltip: "Только подтверждённые сигналы — activity или range обязателен",
    maxInPlay: 5,
    minConfirmedSignals: 2,
    requireActivityOrRange: true,
    allowDirectionParticipationPair: false,
    allowSoftRisk: false,
  },
  balanced: {
    label: "Balanced",
    tooltip: "Два confirmed сигнала; activity/range или direction+participation",
    maxInPlay: 8,
    minConfirmedSignals: 2,
    requireActivityOrRange: false,
    allowDirectionParticipationPair: true,
    allowSoftRisk: false,
  },
  wide: {
    label: "Wide",
    tooltip: "Один confirmed сигнал; softRisk с risk badge",
    maxInPlay: 12,
    minConfirmedSignals: 1,
    requireActivityOrRange: false,
    allowDirectionParticipationPair: true,
    allowSoftRisk: true,
  },
};

export const DEFAULT_MARKET_PRIORITY_MODE: MarketPriorityMode = "strict";

export function isMarketPriorityMode(value: string | null | undefined): value is MarketPriorityMode {
  return value === "strict" || value === "balanced" || value === "wide";
}

export function resolveMarketPriorityPreset(mode?: MarketPriorityMode): MarketPriorityInPlayPreset {
  return MARKET_PRIORITY_PRESETS[mode ?? DEFAULT_MARKET_PRIORITY_MODE];
}

export function readMarketPriorityModeFromStorage(): MarketPriorityMode {
  if (typeof window === "undefined") return DEFAULT_MARKET_PRIORITY_MODE;
  try {
    const raw = window.localStorage.getItem(MARKET_PRIORITY_MODE_STORAGE_KEY);
    if (isMarketPriorityMode(raw)) return raw;
  } catch {
    // private mode / quota — fallback
  }
  return DEFAULT_MARKET_PRIORITY_MODE;
}

export function writeMarketPriorityModeToStorage(mode: MarketPriorityMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MARKET_PRIORITY_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export function readStockScreenerPriorityModeFromStorage(): MarketPriorityMode {
  if (typeof window === "undefined") return DEFAULT_MARKET_PRIORITY_MODE;
  try {
    const raw = window.localStorage.getItem(STOCK_SCREENER_PRIORITY_MODE_STORAGE_KEY);
    if (isMarketPriorityMode(raw)) return raw;
  } catch {
    // private mode / quota — fallback
  }
  return DEFAULT_MARKET_PRIORITY_MODE;
}

export function writeStockScreenerPriorityModeToStorage(mode: MarketPriorityMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STOCK_SCREENER_PRIORITY_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}
