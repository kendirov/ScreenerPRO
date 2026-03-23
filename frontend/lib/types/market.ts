export type {
  AssetClass as InstrumentKind,
  InstrumentDetail as ApiInstrumentDetail,
  InstrumentHistoryBar,
  MarketSnapshot,
  ScreenerApiResponse,
  ScreenerDiagnosticsResponse,
  ScreenerFilterState,
  ScreenerFallbackReason,
  ScreenerDataStatus,
  ScreenerMetricSet,
  ScreenerRow,
  TradingStatus,
} from "@screenerpro/shared";

export interface InstrumentMetric {
  label: string;
  value: number;
  suffix?: string;
  delta?: number;
}

export interface InstrumentDetail {
  ticker: string;
  market: "stock" | "future";
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
