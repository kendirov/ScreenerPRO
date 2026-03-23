export type InstrumentKind = "stocks" | "futures";
export type TradingStatus = "open" | "halted" | "auction" | "closed";

export interface ScreenerRow {
  ticker: string;
  name: string;
  market: InstrumentKind;
  lastPrice: number;
  dayChangePct: number;
  turnover: number;
  volumeRatio: number;
  volatility: number;
  status: TradingStatus;
  inPlay: boolean;
}

export interface InstrumentMetric {
  label: string;
  value: number;
  suffix?: string;
  delta?: number;
}

export interface InstrumentDetail {
  ticker: string;
  market: InstrumentKind;
  title: string;
  description: string;
  metrics: InstrumentMetric[];
}

export interface AcademyEntry {
  slug: string;
  title: string;
  excerpt: string;
  readTimeMin: number;
  level: "beginner" | "intermediate" | "advanced";
}

export interface PremiumFlags {
  advancedScreener: boolean;
  deepRiskMetrics: boolean;
  academyProTracks: boolean;
}
