/** Контракты API /api/lab/correlation/* */

export type CorrelationApiFactorId = "index" | "ruble" | "oil" | "gold" | "us" | "sector";

export type CorrelationApiPeriod = 5 | 20 | 60;
export type CorrelationApiInterval = 10 | 60 | 24;

export type CorrelationDataStatus = "live" | "partial" | "no-history" | "no-proxy";

export type CorrelationFactor = {
  id: CorrelationApiFactorId;
  title: string;
  meaning: string;
  proxyTicker: string | null;
  proxyLabel: string | null;
};

export type CorrelationFactorSummary = {
  id: CorrelationApiFactorId;
  title: string;
  dataStatus: CorrelationDataStatus;
  proxyTicker: string | null;
  strongCount: number;
  inverseCount: number;
  breakCount: number;
  weakCount: number;
  strongSamples: string[];
  inverseSamples: string[];
  breakSamples: string[];
};

export type CorrelationOverviewResponse = {
  updatedAt: string;
  interval: CorrelationApiInterval;
  period: CorrelationApiPeriod;
  instrumentsAnalyzed: number;
  factors: CorrelationFactorSummary[];
  warnings: string[];
};

export type CorrelationSignal = {
  ticker: string;
  corr20: number | null;
  corr60: number | null;
  corr120: number | null;
  beta20: number | null;
  beta60: number | null;
  beta120: number | null;
  breakScore: number | null;
  candleCount: number;
  kind: "strong" | "inverse" | "break" | "weak" | "neutral";
};

export type CorrelationFactorDetailResponse = {
  factor: CorrelationFactor;
  signals: CorrelationSignal[];
  topPositive: CorrelationSignal[];
  topNegative: CorrelationSignal[];
  brokenLinks: CorrelationSignal[];
  weakLinks: CorrelationSignal[];
  meta: {
    interval: string;
    period: string;
    instrumentsAnalyzed: number;
    dataStatus: CorrelationDataStatus;
    proxyTicker: string | null;
    updatedAt: string;
  };
};

export type CorrelationPairPoint = { t: string; value: number };

export type CorrelationPairResponse = {
  stock: string;
  factor: string;
  normalizedStock: CorrelationPairPoint[];
  normalizedFactor: CorrelationPairPoint[];
  rollingCorr: CorrelationPairPoint[];
  stats: {
    corr20: number | null;
    corr60: number | null;
    beta20: number | null;
    beta60: number | null;
    breakScore: number | null;
  };
  meta: {
    interval: string;
    period: string;
    dataStatus: CorrelationDataStatus;
    proxyTicker: string | null;
  };
};

export const CORRELATION_API_FACTORS: CorrelationFactor[] = [
  { id: "index", title: "Индекс", meaning: "Кто сильнее или слабее широкого рынка", proxyTicker: null, proxyLabel: null },
  { id: "ruble", title: "Рубль", meaning: "Экспортёры, импортёры, банки", proxyTicker: null, proxyLabel: null },
  { id: "oil", title: "Нефть", meaning: "Нефтегаз, индекс, рубль", proxyTicker: null, proxyLabel: null },
  { id: "gold", title: "Золото", meaning: "Золотодобытчики", proxyTicker: null, proxyLabel: null },
  { id: "us", title: "Америка", meaning: "Risk-on / risk-off через MOEX", proxyTicker: null, proxyLabel: null },
  { id: "sector", title: "Сектор", meaning: "Лидер или аутсайдер внутри сектора", proxyTicker: null, proxyLabel: null },
];

export const CORRELATION_API_FACTOR_IDS = CORRELATION_API_FACTORS.map((f) => f.id);

export function parseCorrelationPeriod(raw: string | null): CorrelationApiPeriod {
  const n = Number(raw ?? 20);
  if (n === 5) return 5;
  if (n === 60) return 60;
  return 20;
}

export function parseCorrelationInterval(raw: string | null, period: CorrelationApiPeriod): CorrelationApiInterval {
  const n = Number(raw ?? (period <= 5 ? 60 : 24));
  if (period >= 20) return 24;
  if (n === 10) return 10;
  if (n === 60) return 60;
  return 60;
}

export function isCorrelationApiFactorId(value: string): value is CorrelationApiFactorId {
  return (CORRELATION_API_FACTOR_IDS as string[]).includes(value);
}
