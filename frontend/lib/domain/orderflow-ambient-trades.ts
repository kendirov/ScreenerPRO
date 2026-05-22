import { LOT_SIZE, roundPrice, TICK_SIZE, type AggressorSide, type SimTradePrint } from "@/lib/domain/orderflow-simulator";
import type { OrderflowEngineState } from "@/lib/domain/orderflow-simulator-engine";

let ambientSeed = 1;

function nextAmbientSeed(): number {
  ambientSeed += 1;
  return ambientSeed;
}

function seeded01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pickAmbientSize(seed: number, burst: boolean): number {
  if (burst) {
    const roll = seeded01(seed + 3);
    if (roll > 0.75) return LOT_SIZE * Math.round(40 + seeded01(seed + 4) * 80);
    if (roll > 0.4) return LOT_SIZE * Math.round(15 + seeded01(seed + 5) * 25);
    return LOT_SIZE * Math.round(8 + seeded01(seed + 6) * 12);
  }
  const roll = seeded01(seed + 7);
  if (roll > 0.92) return LOT_SIZE * Math.round(6 + seeded01(seed + 8) * 10);
  if (roll > 0.7) return LOT_SIZE * Math.round(2 + seeded01(seed + 9) * 5);
  return LOT_SIZE * Math.round(1 + seeded01(seed + 10) * 3);
}

function ambientTradePrice(state: OrderflowEngineState, seed: number, side: AggressorSide): number {
  const { bestBid, bestAsk } = findTouchPrices(state);
  if (side === "buy" && bestAsk !== null) {
    const offset = seeded01(seed + 11) > 0.7 ? 0 : -TICK_SIZE;
    return roundPrice(bestAsk + offset);
  }
  if (side === "sell" && bestBid !== null) {
    const offset = seeded01(seed + 12) > 0.7 ? 0 : TICK_SIZE;
    return roundPrice(bestBid - offset);
  }
  const wobble = (seeded01(seed + 13) - 0.5) * 6 * TICK_SIZE;
  return roundPrice(state.currentPrice + wobble);
}

function findTouchPrices(state: OrderflowEngineState): { bestBid: number | null; bestAsk: number | null } {
  let bestBid: number | null = null;
  let bestAsk: number | null = null;
  for (const level of state.levels) {
    if (level.bidSize > 0 && (bestBid === null || level.price > bestBid)) bestBid = level.price;
    if (level.askSize > 0 && (bestAsk === null || level.price < bestAsk)) bestAsk = level.price;
  }
  if (bestBid === null) bestBid = roundPrice(state.currentPrice);
  if (bestAsk === null) bestAsk = roundPrice(state.currentPrice + TICK_SIZE);
  return { bestBid, bestAsk };
}

export function createAmbientTrade(
  state: OrderflowEngineState,
  options?: { burst?: boolean; side?: AggressorSide },
): SimTradePrint {
  const seed = nextAmbientSeed();
  const burst = options?.burst ?? false;
  const side: AggressorSide =
    options?.side ?? (seeded01(seed + 1) > 0.48 ? "buy" : "sell");
  const timestamp = state.simTime + Math.round(seeded01(seed + 2) * 40);
  const price = ambientTradePrice(state, seed, side);
  const size = pickAmbientSize(seed, burst);

  return {
    id: `ambient-${state.nextTradeId + seed}`,
    timestamp,
    price,
    size,
    aggressorSide: side,
  };
}

/** Стартовые принты для демо-ленты (не биржевой поток) */
export function seedDemoTapeTrades(state: OrderflowEngineState, count = 24): SimTradePrint[] {
  const trades: SimTradePrint[] = [];
  let ts = state.simTime - 12_000;

  for (let i = 0; i < count; i += 1) {
    const seed = i * 17 + 3;
    const side: AggressorSide = seeded01(seed) > 0.5 ? "buy" : "sell";
    ts += 350 + Math.round(seeded01(seed + 1) * 500);
    const trade = createAmbientTrade(
      { ...state, simTime: ts },
      { burst: i > count - 4, side },
    );
    trades.push({ ...trade, id: `demo-seed-${i}`, timestamp: ts });
  }

  return trades.sort((a, b) => b.timestamp - a.timestamp);
}

export function shouldEmitAmbientTrade(state: OrderflowEngineState): boolean {
  if (state.scenarioPlayback.isScenarioPlaying) return false;
  const seed = nextAmbientSeed();
  if (state.isPlaying) {
    return seeded01(seed) > 0.42;
  }
  return seeded01(seed) > 0.88;
}

export function ambientBurstCount(state: OrderflowEngineState): number {
  if (state.scenario === "calm") return 0;
  const active = state.scenarioPlayback.activeScenarioId;
  if (!active) return 0;
  if (
    active.includes("break") ||
    active.includes("iceberg") ||
    active === "absorption" ||
    active.includes("large") ||
    active === "density-pulled" ||
    active === "market-maker-grid"
  ) {
    return 2 + (nextAmbientSeed() % 3);
  }
  return 0;
}
