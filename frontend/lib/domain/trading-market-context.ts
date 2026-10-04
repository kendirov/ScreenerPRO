export type TradingIndexPoint = {
  time: string;
  close: number;
  normalizedPct: number;
  turnover: number | null;
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

export type TradingSameTimeTurnoverComparison = {
  currentTurnover: number;
  baselineTurnover: number;
  ratio: number;
  sessions: number;
  timeMsk: string;
  source: "imoex2-candles";
};

function minutesMsk(timestamp: string): number | null {
  const match = timestamp.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function turnoverThrough(session: TradingIndexSession, targetMinutes: number): number | null {
  let total = 0;
  let observations = 0;
  for (const point of session.points) {
    const minute = minutesMsk(point.time);
    if (minute == null || minute > targetMinutes) continue;
    if (point.turnover == null || !Number.isFinite(point.turnover)) continue;
    total += point.turnover;
    observations += 1;
  }
  return observations > 0 && total > 0 ? total : null;
}

export function summarizeSameTimeIndexTurnover(
  sessions: TradingIndexSession[],
  currentDateKey: string,
): TradingSameTimeTurnoverComparison | null {
  const current = sessions.find((session) => session.dateKey === currentDateKey);
  const lastPoint = current?.points.at(-1);
  const targetMinutes = lastPoint ? minutesMsk(lastPoint.time) : null;
  if (!current || !lastPoint || targetMinutes == null) return null;

  const currentTurnover = turnoverThrough(current, targetMinutes);
  if (currentTurnover == null) return null;
  const baselines = sessions
    .filter((session) => session.dateKey < currentDateKey)
    .slice(-5)
    .map((session) => turnoverThrough(session, targetMinutes))
    .filter((value): value is number => value != null);
  if (baselines.length < 3) return null;
  const baselineTurnover = baselines.reduce((sum, value) => sum + value, 0) / baselines.length;
  if (baselineTurnover <= 0) return null;

  return {
    currentTurnover,
    baselineTurnover,
    ratio: currentTurnover / baselineTurnover,
    sessions: baselines.length,
    timeMsk: lastPoint.time.slice(11, 16),
    source: "imoex2-candles",
  };
}

export type TradingMarketContextResponse = {
  fetchedAt: string;
  requestedDateKey: string;
  resolvedDateKey: string | null;
  isLive: boolean;
  indexCode: string;
  indexSessions: TradingIndexSession[];
  turnoverSessions: TradingTurnoverSession[];
  sameTimeTurnoverComparison: TradingSameTimeTurnoverComparison | null;
};
