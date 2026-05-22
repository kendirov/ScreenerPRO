import type { OrderflowEngineState } from "@/lib/domain/orderflow-simulator-engine";
import type {
  AggressorSide,
  OrderflowSimulatorState,
  SimCandle,
  SimClusterCell,
  SimOrderBookLevel,
  SimTradePrint,
} from "@/lib/domain/orderflow-simulator";
import { roundPrice } from "@/lib/domain/orderflow-simulator";

export type VolatilityProfile = "calm" | "trend" | "volatile" | "thin";

export type SimInstrumentPreset = {
  symbol: string;
  title: string;
  basePrice: number;
  tickSize: number;
  lotSize: number;
  volatilityProfile: VolatilityProfile;
};

export const DEMO_INSTRUMENT_PRESETS: SimInstrumentPreset[] = [
  {
    symbol: "GAZP",
    title: "Газпром",
    basePrice: 123.34,
    tickSize: 0.01,
    lotSize: 10,
    volatilityProfile: "calm",
  },
  {
    symbol: "SI",
    title: "Si (USD/RUB)",
    basePrice: 98450,
    tickSize: 1,
    lotSize: 1,
    volatilityProfile: "volatile",
  },
  {
    symbol: "CNY",
    title: "CNY (юань)",
    basePrice: 12.84,
    tickSize: 0.001,
    lotSize: 1000,
    volatilityProfile: "trend",
  },
  {
    symbol: "EU",
    title: "Eu (евро)",
    basePrice: 101.2,
    tickSize: 0.01,
    lotSize: 100,
    volatilityProfile: "calm",
  },
  {
    symbol: "SBER",
    title: "Сбербанк",
    basePrice: 285.5,
    tickSize: 0.01,
    lotSize: 10,
    volatilityProfile: "calm",
  },
  {
    symbol: "VTBR",
    title: "ВТБ",
    basePrice: 0.0245,
    tickSize: 0.0001,
    lotSize: 10000,
    volatilityProfile: "thin",
  },
];

/** Порядок плиток на рабочем столе */
export const MULTI_WINDOW_SYMBOL_ORDER = DEMO_INSTRUMENT_PRESETS.map((p) => p.symbol);

const LEVEL_COUNT = 36;
const CANDLE_COUNT = 24;
const CANDLE_INTERVAL_MS = 5 * 60 * 1000;

function symbolSeed(symbol: string): number {
  return symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function seededNoise(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  const normalized = x - Math.floor(x);
  return min + normalized * (max - min);
}

function profileScale(profile: VolatilityProfile): { drift: number; depth: number; vol: number } {
  switch (profile) {
    case "calm":
      return { drift: 0.55, depth: 1, vol: 0.85 };
    case "trend":
      return { drift: 0.75, depth: 0.95, vol: 1 };
    case "volatile":
      return { drift: 1.45, depth: 1.1, vol: 1.35 };
    case "thin":
      return { drift: 0.65, depth: 0.45, vol: 0.55 };
    default:
      return { drift: 1, depth: 1, vol: 1 };
  }
}

function buildLevels(preset: SimInstrumentPreset): SimOrderBookLevel[] {
  const { basePrice, tickSize, volatilityProfile } = preset;
  const { depth } = profileScale(volatilityProfile);
  const halfSpan = Math.floor(LEVEL_COUNT / 2);
  const startPrice = roundPrice(basePrice - halfSpan * tickSize, tickSize);
  const seed = symbolSeed(preset.symbol);
  const levels: SimOrderBookLevel[] = [];

  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const price = roundPrice(startPrice + i * tickSize, tickSize);
    const distance = Math.abs(price - basePrice);
    let bidSize = 0;
    let askSize = 0;
    if (price <= basePrice) {
      bidSize = Math.round(seededNoise(seed + price * 10, 15, 120) * (1 + distance) * depth);
    }
    if (price >= basePrice) {
      askSize = Math.round(seededNoise(seed + price * 10 + 1, 15, 120) * (1 + distance) * depth);
    }
    levels.push({ price, bidSize, askSize });
  }

  return levels.sort((a, b) => b.price - a.price);
}

function buildCandles(preset: SimInstrumentPreset): SimCandle[] {
  const { basePrice, tickSize, volatilityProfile } = preset;
  const { drift: driftScale, vol: volScale } = profileScale(volatilityProfile);
  const seed = symbolSeed(preset.symbol);
  const endTimestamp = Date.now();
  const candles: SimCandle[] = [];
  const trendBias = volatilityProfile === "trend" ? -0.02 : 0;
  let price = basePrice - tickSize * 8;

  for (let i = 0; i < CANDLE_COUNT; i += 1) {
    const timestamp = endTimestamp - (CANDLE_COUNT - 1 - i) * CANDLE_INTERVAL_MS;
    const drift = (seededNoise(seed + i * 17, -0.08, 0.1) + trendBias) * driftScale;
    const open = roundPrice(price, tickSize);
    const close = roundPrice(open + drift * Math.max(tickSize, basePrice * 0.0001), tickSize);
    const high = roundPrice(Math.max(open, close) + seededNoise(seed + i, 0.02, 0.1) * driftScale, tickSize);
    const low = roundPrice(Math.min(open, close) - seededNoise(seed + i + 1, 0.02, 0.08) * driftScale, tickSize);
    const volume = Math.round(seededNoise(seed + i * 11, 400, 3200) * volScale);
    const buyShare = seededNoise(seed + i * 13, 0.35, 0.65);
    const buyVolume = Math.round(volume * buyShare);
    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      buyVolume,
      sellVolume: volume - buyVolume,
    });
    price = close;
  }

  return candles;
}

function buildTrades(preset: SimInstrumentPreset, currentPrice: number): SimTradePrint[] {
  const seed = symbolSeed(preset.symbol);
  const endTimestamp = Date.now();
  const trades: SimTradePrint[] = [];

  for (let i = 0; i < 20; i += 1) {
    const timestamp = endTimestamp - i * 4000;
    const price = roundPrice(currentPrice + seededNoise(seed + i, -2, 2) * preset.tickSize, preset.tickSize);
    const size = Math.round(seededNoise(seed + i * 3, 1, 20)) * preset.lotSize;
    const aggressorSide: AggressorSide = seededNoise(seed + i * 5, 0, 1) > 0.5 ? "buy" : "sell";
    trades.push({ id: `${preset.symbol}-t-${i}`, timestamp, price, size, aggressorSide });
  }

  return trades.sort((a, b) => b.timestamp - a.timestamp);
}

function buildClusters(candles: SimCandle[], tickSize: number): SimClusterCell[] {
  const clusters: SimClusterCell[] = [];
  for (const candle of candles.slice(-8)) {
    for (let bucket = 0; bucket < 4; bucket += 1) {
      const price = roundPrice(
        candle.low + ((candle.high - candle.low) * bucket) / 3,
        tickSize,
      );
      const totalVolume = Math.round(candle.volume / 4);
      const buyVolume = Math.round(totalVolume * 0.5);
      clusters.push({
        timestamp: candle.timestamp,
        price,
        buyVolume,
        sellVolume: totalVolume - buyVolume,
        totalVolume,
        delta: buyVolume - (totalVolume - buyVolume),
      });
    }
  }
  return clusters;
}

export function getPresetBySymbol(symbol: string): SimInstrumentPreset | undefined {
  return DEMO_INSTRUMENT_PRESETS.find((p) => p.symbol === symbol);
}

export function createSimulationForPreset(preset: SimInstrumentPreset): OrderflowSimulatorState {
  const candles = buildCandles(preset);
  const currentPrice = candles[candles.length - 1]?.close ?? preset.basePrice;
  return {
    symbol: preset.symbol,
    currentPrice,
    tickSize: preset.tickSize,
    lotSize: preset.lotSize,
    levels: buildLevels(preset),
    trades: buildTrades(preset, currentPrice),
    candles,
    clusters: buildClusters(candles, preset.tickSize),
    scenario: "calm",
    isPlaying: false,
    speed: 1,
    icebergs: [],
  };
}

export function createEngineStateFromPreset(preset: SimInstrumentPreset): OrderflowEngineState {
  const base = createSimulationForPreset(preset);
  return {
    ...base,
    trades: [],
    clusters: [],
    icebergs: [],
    candleTimeframe: 5,
    tickMergeMs: 100,
    lastExplanation: null,
    simTime: Date.now(),
    nextTradeId: 1000 + symbolSeed(preset.symbol),
    scenarioPlayback: {
      activeScenarioId: null,
      scenarioTick: -1,
      isScenarioPlaying: false,
      isScenarioComplete: false,
      journal: [],
      annotations: [],
      learningGoal: null,
    },
    recentExecutedLevels: [],
  };
}
