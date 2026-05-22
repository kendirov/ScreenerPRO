export type SimSide = "bid" | "ask";



export type AggressorSide = "buy" | "sell";



export type SimOrderBookLevel = {

  price: number;

  bidSize: number;

  askSize: number;

  bidIsLarge?: boolean;

  askIsLarge?: boolean;

  bidIsIceberg?: boolean;

  askIsIceberg?: boolean;

  isRoundLevel?: boolean;

  isMarketMakerLevel?: boolean;

};



export type SimTradePrint = {

  id: string;

  timestamp: number;

  price: number;

  size: number;

  aggressorSide: AggressorSide;

};



export type SimCandle = {

  timestamp: number;

  open: number;

  high: number;

  low: number;

  close: number;

  volume: number;

  buyVolume: number;

  sellVolume: number;

};



export type SimClusterCell = {

  timestamp: number;

  price: number;

  buyVolume: number;

  sellVolume: number;

  totalVolume: number;

  delta: number;

};



export type SimScenarioName =

  | "calm"

  | "large-bid-bounce"

  | "large-ask-rejection"

  | "iceberg-buy"

  | "iceberg-sell"

  | "breakout"

  | "breakdown"

  | "absorption"

  | "market-maker-grid"

  | "density-pulled";



export type SimIcebergLevel = {

  price: number;

  side: SimSide;

  visibleSize: number;

  hiddenSize: number;

  refillSize: number;

  executedTotal: number;

};



export type OrderflowSimulatorState = {

  symbol: string;

  currentPrice: number;

  tickSize: number;

  lotSize: number;

  levels: SimOrderBookLevel[];

  trades: SimTradePrint[];

  candles: SimCandle[];

  clusters: SimClusterCell[];

  scenario: SimScenarioName;

  isPlaying: boolean;

  speed: number;

  icebergs: SimIcebergLevel[];

};



export const BASE_PRICE = 123.34;

export const TICK_SIZE = 0.01;

export const LOT_SIZE = 10;

/** Уровней в демо-стакане GAZP: ~40 выше и ~40 ниже центра */

export const GAZP_VISIBLE_LEVELS = 80;

export const GAZP_LEVEL_HALF_SPAN = 40;



/** Психологические / круглые уровни для крупных плотностей (учебная модель) */

export const GAZP_PSYCHO_LEVELS = [123.0, 123.2, 123.3, 123.35, 123.5, 123.6, 123.8] as const;



const LARGE_LOT_THRESHOLD = 10_000;

const CANDLE_COUNT = 36;

const CANDLE_INTERVAL_MS = 5 * 60 * 1000;

const TRADE_COUNT = 40;



/** Симметричные смещения от центра (в тиках) для маркетмейкерских котировок */

const MM_TICK_OFFSETS = [2, 4, 7, 11, 16, 22, 28] as const;



export function roundPrice(price: number, tickSize = TICK_SIZE): number {

  return Math.round(price / tickSize) * tickSize;

}






function seededNoise(seed: number, min: number, max: number): number {

  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;

  const normalized = x - Math.floor(x);

  return min + normalized * (max - min);

}



function seededInt(seed: number, min: number, max: number): number {

  return Math.round(seededNoise(seed, min, max));

}



export function pricesEqual(a: number, b: number, tickSize = TICK_SIZE): boolean {

  return Math.abs(a - b) < tickSize / 2;

}



export function isGazpPsychoLevel(price: number, tickSize = TICK_SIZE): boolean {

  return GAZP_PSYCHO_LEVELS.some((level) => pricesEqual(price, level, tickSize));

}



export function getBestBidAskFromPrice(

  currentPrice: number,

  tickSize = TICK_SIZE,

): { bestBid: number; bestAsk: number } {

  return {

    bestBid: roundPrice(currentPrice, tickSize),

    bestAsk: roundPrice(currentPrice + tickSize, tickSize),

  };

}



type VolumeTier = "small" | "normal" | "medium" | "large" | "extreme";



function pickVolumeTier(seed: number): VolumeTier {

  const roll = seededNoise(seed, 0, 1);

  if (roll > 0.97) return "extreme";

  if (roll > 0.88) return "large";

  if (roll > 0.72) return "medium";

  if (roll > 0.35) return "normal";

  return "small";

}



function lotsForTier(tier: VolumeTier, seed: number): number {

  switch (tier) {

    case "small":

      return seededInt(seed, 300, 900);

    case "normal":

      return seededInt(seed + 1, 900, 2500);

    case "medium":

      return seededInt(seed + 2, 3000, 7000);

    case "large":

      return seededInt(seed + 3, 10_000, 25_000);

    case "extreme":

      return seededInt(seed + 4, 30_000, 42_000);

    default:

      return seededInt(seed, 900, 2500);

  }

}



function isMarketMakerTickOffset(price: number, center: number, tickSize: number): boolean {

  const ticks = Math.round(Math.abs(price - center) / tickSize);

  return (MM_TICK_OFFSETS as readonly number[]).includes(ticks);

}



function psychoLevelBoost(price: number, side: SimSide, base: number, seed: number): number {

  if (!isGazpPsychoLevel(price)) return base;



  const psychoSeed = price * 1000 + (side === "bid" ? 1 : 2);

  const roll = seededNoise(psychoSeed, 0, 1);



  if (price === 123.0 && side === "bid") {

    return Math.max(base, seededInt(psychoSeed, 18_000, 22_500));

  }

  if (price === 123.8 && side === "ask") {

    return Math.max(base, seededInt(psychoSeed, 16_000, 21_000));

  }

  if (price === 123.5 && side === "ask") {

    return Math.max(base, seededInt(psychoSeed, 12_000, 17_500));

  }

  if (price === 123.35) {

    return Math.max(base, seededInt(psychoSeed, 4500, 9000));

  }

  if (price === 123.3) {

    return Math.max(base, seededInt(psychoSeed, 3500, 7500));

  }

  if (price === 123.2 && side === "bid") {

    return Math.max(base, seededInt(psychoSeed, 8000, 14_000));

  }

  if (price === 123.6 && side === "ask") {

    return Math.max(base, seededInt(psychoSeed, 7000, 12_000));

  }



  if (roll > 0.7) return Math.max(base, lotsForTier("large", psychoSeed));

  if (roll > 0.45) return Math.max(base, lotsForTier("medium", psychoSeed));

  return Math.max(base, lotsForTier("normal", psychoSeed));

}



function generateSideVolume(

  price: number,

  side: SimSide,

  center: number,

  tickSize: number,

): number {

  const seed = price * 100 + (side === "bid" ? 17 : 31) + center * 10;

  const distanceTicks = Math.abs(price - center) / tickSize;

  const distanceDamp = 1 + Math.min(distanceTicks * 0.04, 0.35);



  let size = lotsForTier(pickVolumeTier(seed), seed);

  size = Math.round(size / distanceDamp);

  size = psychoLevelBoost(price, side, size, seed);



  if (isMarketMakerTickOffset(price, center, tickSize) && seededNoise(seed + 99, 0, 1) > 0.25) {

    size = Math.max(size, seededInt(seed + 50, 1200, 3200));

  }



  const touchBoost =

    side === "bid"

      ? pricesEqual(price, roundPrice(center, tickSize), tickSize)

      : pricesEqual(price, roundPrice(center + tickSize, tickSize), tickSize);



  if (touchBoost) {

    size = Math.max(size, seededInt(seed + 7, 900, 2200));

  }



  return Math.max(size, seededInt(seed + 3, 180, 520));

}



export type BuildOrderBookOptions = {

  currentPrice: number;

  tickSize?: number;

  levelCount?: number;

};



export function buildRealisticOrderBook({

  currentPrice,

  tickSize = TICK_SIZE,

  levelCount = GAZP_VISIBLE_LEVELS,

}: BuildOrderBookOptions): SimOrderBookLevel[] {

  const { bestBid, bestAsk } = getBestBidAskFromPrice(currentPrice, tickSize);

  const halfSpan = Math.floor(levelCount / 2);

  const startPrice = roundPrice(currentPrice - halfSpan * tickSize, tickSize);

  const levels: SimOrderBookLevel[] = [];



  for (let i = 0; i < levelCount; i += 1) {

    const price = roundPrice(startPrice + i * tickSize, tickSize);

    const level: SimOrderBookLevel = { price, bidSize: 0, askSize: 0 };



    if (isGazpPsychoLevel(price, tickSize)) {

      level.isRoundLevel = true;

    }



    if (price >= bestAsk) {

      let askSize = generateSideVolume(price, "ask", currentPrice, tickSize);

      if (isMarketMakerTickOffset(price, currentPrice, tickSize)) {

        level.isMarketMakerLevel = true;

        askSize = Math.max(askSize, seededInt(price * 50 + 2, 1400, 3800));

      }

      level.askSize = askSize;

      if (askSize >= LARGE_LOT_THRESHOLD) level.askIsLarge = true;

    }



    if (price <= bestBid) {

      let bidSize = generateSideVolume(price, "bid", currentPrice, tickSize);

      if (isMarketMakerTickOffset(price, currentPrice, tickSize)) {

        level.isMarketMakerLevel = true;

        bidSize = Math.max(bidSize, seededInt(price * 50 + 1, 1400, 3800));

      }

      level.bidSize = bidSize;

      if (bidSize >= LARGE_LOT_THRESHOLD) level.bidIsLarge = true;

    }



    levels.push(level);

  }



  return levels.sort((a, b) => b.price - a.price);

}



function buildCandles(endTimestamp: number): SimCandle[] {

  const candles: SimCandle[] = [];

  let price = BASE_PRICE - 0.12;



  for (let i = 0; i < CANDLE_COUNT; i += 1) {

    const timestamp = endTimestamp - (CANDLE_COUNT - 1 - i) * CANDLE_INTERVAL_MS;

    const drift = seededNoise(i * 17 + 3, -0.08, 0.1);

    const open = roundPrice(price);

    const close = roundPrice(open + drift);

    const high = roundPrice(Math.max(open, close) + seededNoise(i * 5 + 1, 0.02, 0.12));

    const low = roundPrice(Math.min(open, close) - seededNoise(i * 5 + 2, 0.02, 0.1));

    const volume = Math.round(seededNoise(i * 11 + 4, 800, 4200));

    const buyShare = seededNoise(i * 13 + 5, 0.35, 0.65);

    const buyVolume = Math.round(volume * buyShare);

    const sellVolume = volume - buyVolume;



    candles.push({ timestamp, open, high, low, close, volume, buyVolume, sellVolume });

    price = close;

  }



  return candles;

}



function buildTrades(endTimestamp: number, currentPrice: number): SimTradePrint[] {

  const trades: SimTradePrint[] = [];



  for (let i = 0; i < TRADE_COUNT; i += 1) {

    const timestamp = endTimestamp - i * 4500 - Math.round(seededNoise(i * 7 + 9, 0, 1200));

    const priceOffset = seededNoise(i * 3 + 10, -3, 3);

    const price = roundPrice(currentPrice + priceOffset * TICK_SIZE);

    const size = Math.round(seededNoise(i * 19 + 11, 1, 45)) * LOT_SIZE;

    const aggressorSide: AggressorSide = seededNoise(i * 23 + 12, 0, 1) > 0.48 ? "buy" : "sell";



    trades.push({

      id: `sim-trade-${i}`,

      timestamp,

      price,

      size,

      aggressorSide,

    });

  }



  return trades.sort((a, b) => b.timestamp - a.timestamp);

}



function buildClusters(candles: SimCandle[]): SimClusterCell[] {

  const clusters: SimClusterCell[] = [];

  const priceStep = TICK_SIZE * 2;



  for (const candle of candles.slice(-12)) {

    const bucketCount = 6;

    for (let bucket = 0; bucket < bucketCount; bucket += 1) {

      const price = roundPrice(candle.low + ((candle.high - candle.low) * bucket) / (bucketCount - 1 || 1));

      const alignedPrice = roundPrice(Math.round(price / priceStep) * priceStep);

      const share = seededNoise(candle.timestamp + bucket * 31, 0.15, 0.85);

      const totalVolume = Math.round(candle.volume / bucketCount);

      const buyVolume = Math.round(totalVolume * share);

      const sellVolume = totalVolume - buyVolume;



      clusters.push({

        timestamp: candle.timestamp,

        price: alignedPrice,

        buyVolume,

        sellVolume,

        totalVolume,

        delta: buyVolume - sellVolume,

      });

    }

  }



  return clusters;

}



export function createInitialGazpSimulation(): OrderflowSimulatorState {

  const endTimestamp = Date.now();

  const currentPrice = BASE_PRICE;

  const candles = buildCandles(endTimestamp);

  const levels = buildRealisticOrderBook({ currentPrice });

  const trades = buildTrades(endTimestamp, currentPrice);

  const clusters = buildClusters(candles);



  return {

    symbol: "GAZP",

    currentPrice,

    tickSize: TICK_SIZE,

    lotSize: LOT_SIZE,

    levels,

    trades,

    candles,

    clusters,

    scenario: "calm",

    isPlaying: false,

    speed: 1,

    icebergs: [],

  };

}


