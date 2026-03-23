import type {
  AcademyEntry,
  InstrumentDetail,
  PremiumFlags,
  ScreenerRow,
} from "@/lib/types/market";

export const screenerRows: ScreenerRow[] = [
  {
    ticker: "SBER",
    name: "Sberbank",
    market: "stocks",
    lastPrice: 312.8,
    dayChangePct: 1.42,
    turnover: 12_400_000_000,
    volumeRatio: 1.31,
    volatility: 2.1,
    status: "open",
    inPlay: true,
  },
  {
    ticker: "GAZP",
    name: "Gazprom",
    market: "stocks",
    lastPrice: 178.14,
    dayChangePct: -0.64,
    turnover: 8_300_000_000,
    volumeRatio: 0.92,
    volatility: 1.7,
    status: "open",
    inPlay: false,
  },
  {
    ticker: "SiM6",
    name: "USD/RUB Futures",
    market: "futures",
    lastPrice: 93_120,
    dayChangePct: 0.88,
    turnover: 15_900_000_000,
    volumeRatio: 1.72,
    volatility: 2.8,
    status: "open",
    inPlay: true,
  },
  {
    ticker: "RIM6",
    name: "RTS Index Futures",
    market: "futures",
    lastPrice: 117_840,
    dayChangePct: -1.15,
    turnover: 11_200_000_000,
    volumeRatio: 1.49,
    volatility: 3.6,
    status: "auction",
    inPlay: true,
  },
  {
    ticker: "LKOH",
    name: "Lukoil",
    market: "stocks",
    lastPrice: 6920,
    dayChangePct: 0.22,
    turnover: 7_800_000_000,
    volumeRatio: 0.76,
    volatility: 1.2,
    status: "open",
    inPlay: false,
  },
];

export const instrumentDetails: Record<string, InstrumentDetail> = {
  SBER: {
    ticker: "SBER",
    market: "stocks",
    title: "Sberbank Common",
    description: "Core liquidity proxy for local risk-on sentiment.",
    metrics: [
      { label: "Last", value: 312.8, suffix: " RUB", delta: 1.42 },
      { label: "Avg Volume 20D", value: 58_400_000 },
      { label: "Beta", value: 1.17 },
      { label: "Realized Vol 30D", value: 24.1, suffix: "%" },
    ],
  },
  SiM6: {
    ticker: "SiM6",
    market: "futures",
    title: "USD/RUB Futures",
    description: "Primary FX hedge and macro volatility expression.",
    metrics: [
      { label: "Last", value: 93_120, delta: 0.88 },
      { label: "Open Interest", value: 1_240_000 },
      { label: "Contango", value: 0.32, suffix: "%" },
      { label: "Realized Vol 30D", value: 19.8, suffix: "%" },
    ],
  },
};

export const academyEntries: AcademyEntry[] = [
  {
    slug: "market-microstructure-moex",
    title: "MOEX Microstructure: What Moves Tape Quality",
    excerpt: "A practical walkthrough for reading flow, auctions, and intraday regime shifts.",
    readTimeMin: 12,
    level: "intermediate",
  },
  {
    slug: "futures-basis-and-carry",
    title: "Futures Basis and Carry in Practice",
    excerpt: "Understand basis dynamics and convert them into tradable context.",
    readTimeMin: 10,
    level: "advanced",
  },
];

export const premiumFlagsMock: PremiumFlags = {
  advancedScreener: false,
  deepRiskMetrics: false,
  academyProTracks: false,
};
