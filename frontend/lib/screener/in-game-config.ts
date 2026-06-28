/** Калибруемые параметры отбора «В игре» — единый источник для логики и аудита. */

export const IN_GAME_CONFIG = {
  target: {
    normalDayMin: 8,
    normalDayMax: 15,
    activeDayMin: 15,
    activeDayMax: 25,
    extremeDayMax: 35,
    extremeDayMin: 20,
    scoreRelaxForFill: 8,
  },

  marketRegime: {
    activeIndexRangePct: 3.0,
    extremeIndexRangePct: 5.0,
    broadBreadthRatio: 0.75,
  },

  hardFilters: {
    minTrades: 5000,
    minTurnoverRub: 100_000_000,
    minRangePct: 2.0,
    illiquidTradesPercentileFloor: 50,
  },

  candidateScenarios: {
    a: { minTradesPercentile: 85, minTurnoverPercentile: 60 },
    b: { minTradesPercentile: 75, indexRangeMultiplier: 0.75 },
    c: { indexRangeMultiplier: 1.25, minTradesPercentile: 60 },
    d: { minTurnoverPercentile: 85, minTradesPercentile: 70, minRangePct: 2.0 },
  },

  shortlistFilters: {
    minScoreNormal: 72,
    minScoreActive: 78,
    minScoreExtreme: 82,
  },

  relativeToIndex: {
    rangeFloorPct: 1.5,
    moveFloorPct: 0.7,
    relativeScoreDivisor: 1.5,
  },

  weights: {
    trades: 0.38,
    turnover: 0.24,
    range: 0.22,
    relativeRange: 0.1,
    relativeMove: 0.06,
  },

  blueChipBoost: {
    enabled: true,
    tickers: [
      "SBER",
      "SBERP",
      "GAZP",
      "LKOH",
      "ROSN",
      "NVTK",
      "T",
      "YDEX",
      "GMKN",
      "VTBR",
      "SMLT",
      "MAGN",
      "CHMF",
      "NLMK",
      "ALRS",
      "AFLT",
      "AFKS",
    ] as const,
    minTradesPercentile: 75,
    minRangePct: 2.0,
  },

  cardDisplayMax: 12,
} as const;

export type MarketRegime = "normal" | "active" | "extreme";
export type InGameScenario = "A" | "B" | "C" | "D" | "E";
