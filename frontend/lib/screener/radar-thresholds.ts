/** Пороги stocks radar — единый источник, без магических чисел в JSX. */

export const RADAR_THRESHOLDS = {
  sessionProgress: { min: 0.05, max: 1.0 },

  liquidity: {
    maxLeaders: 8,
    cardDisplayMax: 5,
  },

  inPlay: {
    cardDisplayMax: 12,
  },

  volatility: {
    weights: {
      rangePctRank: 0.45,
      absChangePctRank: 0.25,
      marketAdjustedMove: 0.15,
      activityConfirmation: 0.15,
    },
    minScore: 35,
    maxLeaders: 8,
    cardDisplayMax: 5,
  },

  illiquid: {
    quantile: 0.2,
    minTradesFloor: 20,
    minTurnoverFloor: 1_000_000,
    liquidPercentileMin: 25,
    volatilityKeepThreshold: 5,
    moveKeepThreshold: 3,
    blueChipWhitelist: new Set([
      "SBER",
      "SBERP",
      "GAZP",
      "LKOH",
      "ROSN",
      "NVTK",
      "GMKN",
      "YDEX",
      "T",
      "VTBR",
      "MGNT",
      "PLZL",
      "CHMF",
      "NLMK",
      "MAGN",
      "ALRS",
      "AFLT",
      "MOEX",
      "SNGS",
      "SNGSP",
      "TATN",
      "TATNP",
      "HEAD",
      "X5",
    ]),
  },

  /** Порог flat для breadth: |change| <= threshold → без хода. */
  breadthFlatPct: 0.05,
} as const;
