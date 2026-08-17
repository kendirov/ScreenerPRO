export type TradingIndexPoint = {
  time: string;
  close: number;
  normalizedPct: number;
};

export type TradingIndexSession = {
  dateKey: string;
  points: TradingIndexPoint[];
};

export type TradingTurnoverSession = {
  dateKey: string;
  turnover: number;
  trades: number;
};

export type TradingMarketContextResponse = {
  fetchedAt: string;
  requestedDateKey: string;
  resolvedDateKey: string | null;
  isLive: boolean;
  indexCode: string;
  indexSessions: TradingIndexSession[];
  turnoverSessions: TradingTurnoverSession[];
};
