/**
 * Единый конфиг Market Radar — меняйте пороги только здесь.
 */

export {
  MARKET_RADAR_REASON_LABELS,
  getMarketRadarReasonLabel,
  getMarketRadarReasonDetail,
  type MarketRadarReasonKey,
} from "@/lib/domain/trader-signal-labels";

export const MARKET_RADAR_CONFIG = {
  /** Ликвидность — где деньги и нормальное исполнение. */
  liquidity: {
    topN: 5,
    scoreWeights: {
      turnover: 0.65,
      trades: 0.25,
      spread: 0.1,
    },
  },

  /** Активность — лимиты списка и legacy-пороги. */
  activity: {
    maxVisible: 8,
    scoreWeights: {
      volumeRatio: 0.3,
      tradesRatio: 0.25,
      range: 0.2,
      momentum: 0.15,
      execution: 0.1,
    },
    gate: {
      minTurnoverRub: 20_000_000,
      minTradesCount: 800,
      maxSpreadPct: 0.5,
    },
    inGameMinScore: 75,
    activeMinScore: 58,
    scoreCapWithoutBaseline: 72,
    rankFallback: {
      turnoverRank: 15,
      tradesRank: 15,
      minDayRangePct: 0.4,
    },
    inGame: {
      minConfluence: 2,
      minVolumeRatio: 1.8,
      minTradesRatio: 1.8,
      minDayRangePct: 1.5,
      minAbsChangePct: 1.0,
    },
  },

  /** Волатильность — движение / диапазон, в т.ч. тонкие бумаги. */
  volatility: {
    maxVisible: 6,
    gate: {
      minDayRangePct: 1.5,
      minAbsChangePct: 1.2,
    },
    thin: {
      maxTurnoverRub: 10_000_000,
      maxTradesCount: 300,
    },
  },

  /** Скоринг v4 — movement / baseline / in-game / activity / volatility. */
  scoring: {
    movement: {
      weights: { range: 0.45, absChange: 0.3, edge: 0.15, breakout: 0.1 },
      rangeScale: { min: 0.8, max: 3.0 },
      absChangeScale: { min: 0.5, max: 2.5 },
    },
    baseline: {
      weights: { volumeRatio: 0.55, tradesRatio: 0.45 },
      ratioScale: { min: 1.0, max: 3.0 },
      missingScore: 0.5,
    },
    inGame: {
      weights: { leaderPresence: 0.45, movement: 0.35, baseline: 0.2 },
      minScore: 0.75,
      minLeaderPresence: 0.6,
      minMovement: 0.55,
    },
    activity: {
      weights: { leaderPresence: 0.35, baseline: 0.25, movement: 0.25, execution: 0.15 },
      minScore: 0.58,
      minMovement: 0.3,
      minLeaderPresence: 0.25,
      gateTurnoverRatio: 0.5,
      gateTradesRatio: 0.5,
    },
    volatility: {
      weights: { range: 0.55, absChange: 0.2, edge: 0.15, breakout: 0.1 },
    },
    execution: {
      spreadExcellent: 0.15,
      spreadGood: 0.35,
      spreadFair: 0.7,
      scoreExcellent: 1.0,
      scoreGood: 0.7,
      scoreFair: 0.4,
      scorePoor: 0.2,
      scoreNoSpreadNormal: 0.6,
    },
  },

  structure: {
    nearExtremePosition: 0.78,
    breakoutMinChangePct: 0.35,
    inPlayNearHighMinChangePct: 1.0,
    inPlayNearLowMaxChangePct: -1.0,
    shotsNearHighMinChangePct: 1.5,
    shotsNearLowMaxChangePct: -1.5,
  },

  /** @deprecated Алиасы v1 — для обратной совместимости импортов. */
  tradable: {
    minTurnoverRatioOfLeader: 0.02,
    minTurnoverRubFloor: 35_000_000,
    minTradesCount: 1_200,
  },

  /** @deprecated → activity.inGame */
  inPlay: {
    defaultVisible: 3,
    maxVisible: 3,
    thirdMinScore: 75,
    minScore: 75,
    minConfluence: 2,
    minTurnoverRub: 20_000_000,
    minTradesCount: 800,
    confluence: {
      turnoverRank: 15,
      tradesRank: 15,
      rangeRank: 15,
      absChangeRank: 15,
      volumeRatioRank: 15,
      minDayRangePct: 1.5,
      minAbsChangePct: 1.0,
      minVolumeRatio: 1.8,
    },
    scoreWeights: {
      turnover: 0.2,
      trades: 0.2,
      range: 0.2,
      absChange: 0.15,
      volumeRatio: 0.15,
      structure: 0.1,
    },
  },

  /** @deprecated → activity */
  active: {
    maxVisible: 8,
    peekWhenEmpty: 5,
    peekWhenHardPresent: 4,
    minScore: 58,
    minConfluence: 2,
    minTurnoverRub: 20_000_000,
    minTradesCount: 800,
    confluence: {
      turnoverRank: 15,
      tradesRank: 15,
      rangeRank: 15,
      absChangeRank: 15,
      volumeRatioRank: 15,
      minDayRangePct: 0.4,
      minAbsChangePct: 0.5,
      minVolumeRatio: 1.2,
    },
    scoreWeights: {
      turnover: 0.25,
      trades: 0.25,
      range: 0.2,
      absChange: 0.15,
      volumeRatio: 0.15,
    },
  },

  /** @deprecated → volatility */
  shots: {
    maxVisible: 6,
    minScore: 0,
    minTurnoverRub: 0,
    minTradesCount: 0,
    signal: {
      rangeRank: 10,
      absChangeRank: 10,
      minDayRangePct: 1.5,
      minAbsChangePct: 1.2,
    },
    scoreWeights: {
      range: 0.45,
      absChange: 0.2,
      structure: 0.15,
      turnover: 0.1,
    },
  },

  layout: {
    minHeightPx: 168,
    maxHeightPx: 192,
    liquidityFixedRows: 5,
    scrollAfterCount: 5,
    visibleRowsInScroll: 5,
    rowHeightPx: 17,
    activeVisibleMax: 8,
  },

  /** Контекст сессии — относительные пороги vs лидеры рынка. */
  session: {
    turnoverRefTopN: 3,
    tradesRefTopN: 5,
    relativeClampMax: 1.2,
    intensityWeights: {
      turnover: 0.6,
      trades: 0.4,
    },
    defaultMode: "soft" as const,
    modeThresholds: {
      quietMax: 0.35,
      softMax: 0.75,
      normalMax: 1.25,
    },
    leaderPresenceWeights: {
      turnover: 0.55,
      trades: 0.45,
    },
    gates: {
      quiet: { minTurnoverRub: 15_000_000, minTradesCount: 500 },
      soft: { minTurnoverRub: 30_000_000, minTradesCount: 800 },
      normal: { minTurnoverRub: 50_000_000, minTradesCount: 1200 },
      hot: { minTurnoverRub: 80_000_000, minTradesCount: 2000 },
    },
  },
} as const;

export type RadarSessionMode = keyof typeof MARKET_RADAR_CONFIG.session.gates;
