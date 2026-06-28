export type ExternalAssetGroupId =
  | "indices"
  | "fx"
  | "energy"
  | "metals"
  | "soft";

export type ExternalThresholdGroup = "indices" | "fx" | "energy" | "metals" | "soft";

export type ExternalAssetTag = "1D" | "5D" | "range" | "reversal";

export type ExternalSeriesPoint = {
  date: string;
  value: number;
  high?: number;
  low?: number;
};

export type ExternalAssetQuote = {
  id: string;
  name: string;
  group: ExternalAssetGroupId;
  symbol: string;
  last: number | null;
  change1dPct: number | null;
  change5dPct: number | null;
  range5dPct: number | null;
  volatility5d: number | null;
  series5d: ExternalSeriesPoint[];
  source: string;
  updatedAt: string;
  error?: string;
  critical: boolean;
  tags: ExternalAssetTag[];
  isMover: boolean;
};

export type ExternalAssetDiagnostic = {
  id: string;
  name: string;
  group: ExternalAssetGroupId;
  symbol: string;
  provider: string;
  status: "ok" | "error" | "disabled" | "insufficient";
  points: number;
  firstDate: string | null;
  lastDate: string | null;
  firstValue: number | null;
  lastValue: number | null;
  min: number | null;
  max: number | null;
  error?: string;
};

export type ExternalMarketStatus = "live" | "partial" | "degraded" | "error";

export type ExternalMarketGroup = {
  id: ExternalAssetGroupId;
  title: string;
  movers: ExternalAssetQuote[];
  critical: ExternalAssetQuote[];
};

export type ExternalRiskTone = "risk-on" | "risk-off" | "mixed" | "calm" | "commodity" | "dollar-pressure";

export type ExternalMarketSummary = {
  tone: ExternalRiskTone;
  line: string;
  moversCount: number;
};

export type ExternalMarketResponse = {
  status: ExternalMarketStatus;
  updatedAt: string;
  summary: ExternalMarketSummary;
  groups: ExternalMarketGroup[];
  allAssetsCount: number;
  activeAssetsCount: number;
  disabledAssetsCount: number;
  criticalAssetsCount: number;
  criticalSuccessRate: number;
  moversCount: number;
  errors: string[];
  diagnostics: string[];
  assetDiagnostics: ExternalAssetDiagnostic[];
};

export type PreparationEventImportance = "high" | "medium" | "low";

export type PreparationEventImpactTag =
  | "rates"
  | "FX"
  | "oil"
  | "gas"
  | "metals"
  | "equities"
  | "Russia"
  | "US"
  | "China"
  | "Eurozone";

export type PreparationCalendarEvent = {
  id: string;
  date: string;
  time?: string;
  timeMsk?: string;
  country?: string;
  region?: string;
  title: string;
  importance: PreparationEventImportance;
  category?: string;
  assetImpact: PreparationEventImpactTag[];
  previous?: string;
  forecast?: string;
  actual?: string;
  status: "upcoming" | "released" | "unknown";
  source: string;
  sourceUrl?: string;
};

export type EventsProviderStatus = "ok" | "empty" | "disabled" | "error";

export type EventsProviderDiagnostic = {
  id: string;
  enabled: boolean;
  status: EventsProviderStatus;
  count: number;
  error?: string;
};

export type PreparationEventsResponse = {
  status: "live" | "partial" | "degraded" | "error";
  loaded: boolean;
  updatedAt: string;
  providers: EventsProviderDiagnostic[];
  today: PreparationCalendarEvent[];
  tomorrow: PreparationCalendarEvent[];
  week: PreparationCalendarEvent[];
  counts: {
    total: number;
    high: number;
    mediumShown: number;
    lowHidden: number;
  };
  source: string;
  diagnostics: string[];
};

export type PreparationDataQualityStatus =
  | "live"
  | "partial"
  | "degraded"
  | "manual"
  | "error"
  | "loading";
