import { createEngineStateFromPreset, getPresetBySymbol } from "@/lib/domain/orderflow-instrument-presets";
import { findBestBidAsk } from "@/lib/domain/order-book-ladder-model";
import {
  buildRealisticOrderBook,
  createInitialGazpSimulation,
  GAZP_PSYCHO_LEVELS,
  GAZP_VISIBLE_LEVELS,
  LOT_SIZE,
  pricesEqual as simPricesEqual,
  roundPrice,
  TICK_SIZE,
  type AggressorSide,
  type OrderflowSimulatorState,
  type SimCandle,
  type SimClusterCell,
  type SimIcebergLevel,
  type SimOrderBookLevel,
  type SimScenarioName,
  type SimSide,
  type SimTradePrint,
} from "./orderflow-simulator";
import {
  ambientBurstCount,
  createAmbientTrade,
  seedDemoTapeTrades,
  shouldEmitAmbientTrade,
} from "./orderflow-ambient-trades";
import {
  getScenarioById,
  getScenarioMaxTick,
  getStepsAtTick,
  type OrderflowScenario,
  type ScenarioAnnotationKind,
  type ScenarioStep,
} from "./orderflow-simulator-scenarios";

export type CandleTimeframeMinutes = 1 | 5;

export type TickMergeMs = 0 | 50 | 100 | 250;

export type ScenarioAnnotation = {
  price?: number;
  label: string;
  kind: ScenarioAnnotationKind;
};

export type ScenarioJournalEntry = {
  tick: number;
  stepIndex: number;
  explanation: string;
  watchHint: string;
  whyImportant: string;
  appeared?: string;
  aggressor?: string;
  levelOutcome?: string;
  watchBook?: string;
};

/** Вспышка исполнения на уровне стакана (рыночный удар) */
export type ExecutedLevelFlash = {
  price: number;
  /** Сторона книги, с которой сняли ликвидность */
  side: SimSide;
  size: number;
  timestamp: number;
  aggressorSide: AggressorSide;
};

export type ScenarioPlaybackState = {
  activeScenarioId: SimScenarioName | null;
  scenarioTick: number;
  isScenarioPlaying: boolean;
  isScenarioComplete: boolean;
  journal: ScenarioJournalEntry[];
  annotations: ScenarioAnnotation[];
  learningGoal: string | null;
};

export type OrderflowEngineState = OrderflowSimulatorState & {
  candleTimeframe: CandleTimeframeMinutes;
  tickMergeMs: TickMergeMs;
  lastExplanation: string | null;
  simTime: number;
  nextTradeId: number;
  scenarioPlayback: ScenarioPlaybackState;
  recentExecutedLevels: ExecutedLevelFlash[];
};

export type OrderflowSimulatorAction =
  | { type: "SIM_TICK" }
  | { type: "MARKET_BUY"; size: number }
  | { type: "MARKET_SELL"; size: number }
  | { type: "ADD_LIMIT_BID"; price: number; size: number }
  | { type: "ADD_LIMIT_ASK"; price: number; size: number }
  | { type: "CANCEL_LIMIT"; price: number; side: "bid" | "ask" }
  | { type: "MOVE_PRICE_TO_LEVEL"; price: number }
  | { type: "RESET_SCENARIO" }
  | { type: "SELECT_SCENARIO"; scenarioId: SimScenarioName }
  | { type: "START_SCENARIO" }
  | { type: "SCENARIO_STEP" }
  | { type: "STOP_SCENARIO" }
  | { type: "SET_SPEED"; speed: number }
  | { type: "SET_SCENARIO"; scenario: SimScenarioName }
  | { type: "SET_CANDLE_TIMEFRAME"; timeframe: CandleTimeframeMinutes }
  | { type: "SET_TICK_MERGE"; mergeMs: TickMergeMs }
  | { type: "PAUSE" }
  | { type: "PLAY" }
  | { type: "STEP" }
  | { type: "LOAD_SYMBOL"; symbol: string }
  | { type: "LOAD_ENGINE_STATE"; state: OrderflowEngineState };

const MAX_TRADES = 250;
const MAX_CANDLES = 48;
const MAX_CLUSTERS = 240;
const MAX_EXECUTED_FLASHES = 48;
const LARGE_TRADE_THRESHOLD = 1000;
const LARGE_DENSITY_SIZE = 10_000;

let simSeed = 1;
let globalStepIndex = 0;

function nextSimSeed(): number {
  simSeed += 1;
  return simSeed;
}

function emptyPlayback(): ScenarioPlaybackState {
  return {
    activeScenarioId: null,
    scenarioTick: -1,
    isScenarioPlaying: false,
    isScenarioComplete: false,
    journal: [],
    annotations: [],
    learningGoal: null,
  };
}

function cloneLevels(levels: SimOrderBookLevel[]): SimOrderBookLevel[] {
  return levels.map((level) => ({ ...level }));
}

function getCandleBucketStart(timestamp: number, timeframeMin: CandleTimeframeMinutes): number {
  const ms = timeframeMin * 60 * 1000;
  return Math.floor(timestamp / ms) * ms;
}

function createTradeId(state: OrderflowEngineState, offset: number): string {
  return `sim-${state.nextTradeId + offset}`;
}

function tradesToExecutedFlashes(trades: SimTradePrint[]): ExecutedLevelFlash[] {
  return trades.map((trade) => ({
    price: trade.price,
    side: trade.aggressorSide === "buy" ? "ask" : "bid",
    size: trade.size,
    timestamp: trade.timestamp,
    aggressorSide: trade.aggressorSide,
  }));
}

function appendExecutedFlashes(
  state: OrderflowEngineState,
  trades: SimTradePrint[],
): ExecutedLevelFlash[] {
  if (trades.length === 0) return state.recentExecutedLevels;
  return [...tradesToExecutedFlashes(trades), ...state.recentExecutedLevels].slice(0, MAX_EXECUTED_FLASHES);
}

function upsertLevel(levels: SimOrderBookLevel[], price: number): SimOrderBookLevel[] {
  const rounded = roundPrice(price);
  const existing = levels.find((level) => Math.abs(level.price - rounded) < TICK_SIZE / 2);
  if (existing) return levels;

  return [...levels, { price: rounded, bidSize: 0, askSize: 0 }].sort((a, b) => b.price - a.price);
}

function setLevel(
  levels: SimOrderBookLevel[],
  price: number,
  mutate: (level: SimOrderBookLevel) => void,
): SimOrderBookLevel[] {
  const rounded = roundPrice(price);
  const next = upsertLevel(cloneLevels(levels), rounded);
  return next.map((level) => {
    if (Math.abs(level.price - rounded) < TICK_SIZE / 2) {
      const copy = { ...level };
      mutate(copy);
      if (copy.bidSize >= LARGE_DENSITY_SIZE * 0.8) copy.bidIsLarge = true;
      if (copy.askSize >= LARGE_DENSITY_SIZE * 0.8) copy.askIsLarge = true;
      return copy;
    }
    return level;
  });
}

function stripDefaultLargeLevels(levels: SimOrderBookLevel[]): SimOrderBookLevel[] {
  return levels.map((level) => {
    const copy = { ...level };
    const isPsycho = GAZP_PSYCHO_LEVELS.some((p) => simPricesEqual(level.price, p));
    if (isPsycho && copy.bidIsLarge) {
      copy.bidSize = Math.min(copy.bidSize, 2800);
      copy.bidIsLarge = false;
    }
    if (isPsycho && copy.askIsLarge) {
      copy.askSize = Math.min(copy.askSize, 2800);
      copy.askIsLarge = false;
    }
    return copy;
  });
}

export function updateCandleFromTrade(state: OrderflowEngineState, trade: SimTradePrint): OrderflowEngineState {
  const bucket = getCandleBucketStart(trade.timestamp, state.candleTimeframe);
  const candles = [...state.candles];
  const idx = candles.findIndex((candle) => candle.timestamp === bucket);

  const applyTrade = (candle: SimCandle): SimCandle => ({
    ...candle,
    high: Math.max(candle.high, trade.price),
    low: Math.min(candle.low, trade.price),
    close: trade.price,
    volume: candle.volume + trade.size,
    buyVolume: candle.buyVolume + (trade.aggressorSide === "buy" ? trade.size : 0),
    sellVolume: candle.sellVolume + (trade.aggressorSide === "sell" ? trade.size : 0),
  });

  if (idx >= 0) {
    candles[idx] = applyTrade(candles[idx]!);
  } else {
    const prevClose = candles[candles.length - 1]?.close ?? trade.price;
    candles.push({
      timestamp: bucket,
      open: prevClose,
      high: Math.max(prevClose, trade.price),
      low: Math.min(prevClose, trade.price),
      close: trade.price,
      volume: trade.size,
      buyVolume: trade.aggressorSide === "buy" ? trade.size : 0,
      sellVolume: trade.aggressorSide === "sell" ? trade.size : 0,
    });
  }

  return { ...state, candles: candles.slice(-MAX_CANDLES) };
}

export function updateClusterFromTrade(state: OrderflowEngineState, trade: SimTradePrint): OrderflowEngineState {
  const bucket = getCandleBucketStart(trade.timestamp, state.candleTimeframe);
  const price = roundPrice(trade.price);
  const clusters = [...state.clusters];
  const idx = clusters.findIndex((cell) => cell.timestamp === bucket && cell.price === price);

  const addBuy = trade.aggressorSide === "buy" ? trade.size : 0;
  const addSell = trade.aggressorSide === "sell" ? trade.size : 0;

  if (idx >= 0) {
    const cell = clusters[idx]!;
    const buyVolume = cell.buyVolume + addBuy;
    const sellVolume = cell.sellVolume + addSell;
    clusters[idx] = {
      ...cell,
      buyVolume,
      sellVolume,
      totalVolume: buyVolume + sellVolume,
      delta: buyVolume - sellVolume,
    };
  } else {
    clusters.push({
      timestamp: bucket,
      price,
      buyVolume: addBuy,
      sellVolume: addSell,
      totalVolume: addBuy + addSell,
      delta: addBuy - addSell,
    });
  }

  return { ...state, clusters: clusters.slice(-MAX_CLUSTERS) };
}

export function regenerateOrderBookAroundPrice(state: OrderflowEngineState): OrderflowEngineState {
  const center = state.currentPrice;
  const fresh = buildRealisticOrderBook({
    currentPrice: center,
    tickSize: state.tickSize,
    levelCount: GAZP_VISIBLE_LEVELS,
  });
  const existing = new Map(state.levels.map((level) => [roundPrice(level.price), level]));

  const levels = fresh.map((level) => {
    const prev = existing.get(level.price);
    if (!prev) return level;
    return {
      ...level,
      bidSize: prev.bidSize > 0 ? prev.bidSize : level.bidSize,
      askSize: prev.askSize > 0 ? prev.askSize : level.askSize,
      bidIsLarge: prev.bidIsLarge ?? level.bidIsLarge,
      askIsLarge: prev.askIsLarge ?? level.askIsLarge,
      bidIsIceberg: prev.bidIsIceberg ?? level.bidIsIceberg,
      askIsIceberg: prev.askIsIceberg ?? level.askIsIceberg,
      isRoundLevel: level.isRoundLevel ?? prev.isRoundLevel,
      isMarketMakerLevel: level.isMarketMakerLevel ?? prev.isMarketMakerLevel,
    };
  });

  return { ...state, levels };
}

function findIceberg(state: OrderflowEngineState, price: number, side: SimSide): SimIcebergLevel | undefined {
  const rounded = roundPrice(price);
  return state.icebergs.find(
    (ib) => ib.side === side && Math.abs(ib.price - rounded) < TICK_SIZE / 2 && ib.hiddenSize > 0,
  );
}

export function tryReplenishIceberg(
  state: OrderflowEngineState,
  price: number,
  side: SimSide,
): OrderflowEngineState {
  const iceberg = findIceberg(state, price, side);
  if (!iceberg || iceberg.hiddenSize <= 0) return state;

  const refill = Math.min(iceberg.refillSize, iceberg.hiddenSize);
  const executedTotal = iceberg.executedTotal + refill;
  const icebergs = state.icebergs.map((ib) =>
    ib === iceberg ? { ...ib, hiddenSize: ib.hiddenSize - refill, executedTotal } : ib,
  );

  const levels = setLevel(state.levels, price, (level) => {
    if (side === "bid") {
      level.bidSize += refill;
      level.bidIsIceberg = true;
    } else {
      level.askSize += refill;
      level.askIsIceberg = true;
    }
  });

  const annotation: ScenarioAnnotation = {
    price: roundPrice(price),
    label: "видимый объём восстановился",
    kind: "iceberg-refill",
  };

  return {
    ...state,
    icebergs,
    levels,
    lastExplanation: `Видимый объём восстановился (+${refill} лот). Исполнено из скрытого резерва: ${executedTotal} лот. Учебная модель айсберга.`,
    scenarioPlayback: {
      ...state.scenarioPlayback,
      annotations: [...state.scenarioPlayback.annotations.slice(-4), annotation],
    },
  };
}

export function setupIceberg(
  state: OrderflowEngineState,
  price: number,
  side: SimSide,
  visibleSize: number,
  hiddenSize: number,
  refillSize: number,
): OrderflowEngineState {
  const rounded = roundPrice(price);
  const iceberg: SimIcebergLevel = {
    price: rounded,
    side,
    visibleSize,
    hiddenSize,
    refillSize,
    executedTotal: 0,
  };

  const levels = setLevel(state.levels, rounded, (level) => {
    if (side === "bid") {
      level.bidSize = visibleSize;
      level.bidIsIceberg = true;
    } else {
      level.askSize = visibleSize;
      level.askIsIceberg = true;
    }
  });

  return {
    ...state,
    icebergs: [...state.icebergs.filter((ib) => !(ib.side === side && Math.abs(ib.price - rounded) < TICK_SIZE / 2)), iceberg],
    levels,
  };
}

function applyTrades(
  state: OrderflowEngineState,
  trades: SimTradePrint[],
  explanation: string,
  extraAnnotations?: ScenarioAnnotation[],
): OrderflowEngineState {
  if (trades.length === 0) {
    return { ...state, lastExplanation: "Недостаточно ликвидности в стакане для исполнения." };
  }

  let next: OrderflowEngineState = {
    ...state,
    simTime: trades[trades.length - 1]!.timestamp,
    nextTradeId: state.nextTradeId + trades.length,
    trades: [...trades.slice().reverse(), ...state.trades].slice(0, MAX_TRADES),
    currentPrice: trades[trades.length - 1]!.price,
    lastExplanation: explanation,
    recentExecutedLevels: appendExecutedFlashes(state, trades),
  };

  if (extraAnnotations?.length) {
    next = {
      ...next,
      scenarioPlayback: {
        ...next.scenarioPlayback,
        annotations: [...next.scenarioPlayback.annotations.slice(-4), ...extraAnnotations],
      },
    };
  }

  for (const trade of trades) {
    next = updateClusterFromTrade(updateCandleFromTrade(next, trade), trade);
  }

  return regenerateOrderBookAroundPrice(next);
}

function walkBook(
  state: OrderflowEngineState,
  size: number,
  side: "buy" | "sell",
): { state: OrderflowEngineState; trades: SimTradePrint[] } {
  let remaining = size;
  let current = { ...state };
  const trades: SimTradePrint[] = [];
  let ts = state.simTime + 1;

  while (remaining > 0) {
    const levels = current.levels;
    const sorted =
      side === "buy"
        ? levels.filter((l) => l.askSize > 0).sort((a, b) => a.price - b.price)
        : levels.filter((l) => l.bidSize > 0).sort((a, b) => b.price - a.price);

    const level = sorted[0];
    if (!level) break;

    const available = side === "buy" ? level.askSize : level.bidSize;
    const fill = Math.min(remaining, available);
    remaining -= fill;

    const newLevels = current.levels.map((row) => {
      if (Math.abs(row.price - level.price) >= TICK_SIZE / 2) return row;
      const copy = { ...row };
      if (side === "buy") {
        copy.askSize -= fill;
        if (copy.askSize <= 0) {
          copy.askSize = 0;
          copy.askIsLarge = false;
          copy.askIsIceberg = false;
        }
      } else {
        copy.bidSize -= fill;
        if (copy.bidSize <= 0) {
          copy.bidSize = 0;
          copy.bidIsLarge = false;
          copy.bidIsIceberg = false;
        }
      }
      return copy;
    });

    current = { ...current, levels: newLevels };

    trades.push({
      id: createTradeId(state, trades.length),
      timestamp: ts,
      price: level.price,
      size: fill,
      aggressorSide: side,
    });
    ts += 1;

    const bookSide: SimSide = side === "buy" ? "ask" : "bid";
    const consumedSide: SimSide = side === "buy" ? "ask" : "bid";
    const levelAfter = current.levels.find((r) => Math.abs(r.price - level.price) < TICK_SIZE / 2);
    const visibleEmpty =
      consumedSide === "bid" ? (levelAfter?.bidSize ?? 0) <= 0 : (levelAfter?.askSize ?? 0) <= 0;

    if (visibleEmpty) {
      current = tryReplenishIceberg(current, level.price, consumedSide);
    }

    if (findIceberg(current, level.price, bookSide)) {
      // iceberg on passive side — no refill needed on aggressor walk
    }
  }

  return { state: current, trades };
}

export function applyMarketBuy(state: OrderflowEngineState, size: number): OrderflowEngineState {
  if (size <= 0) return state;
  const { state: walked, trades } = walkBook(state, size, "buy");
  const hitAsk = trades.length > 0 ? [{ price: trades[0]!.price, label: "удар по ask", kind: "hit-ask" as const }] : [];
  return applyTrades(walked, trades, "Рыночная покупка забирает ликвидность из ask.", hitAsk);
}

export function applyMarketSell(state: OrderflowEngineState, size: number): OrderflowEngineState {
  if (size <= 0) return state;
  const { state: walked, trades } = walkBook(state, size, "sell");
  const hitBid = trades.length > 0 ? [{ price: trades[0]!.price, label: "удар по bid", kind: "hit-bid" as const }] : [];
  return applyTrades(walked, trades, "Рыночная продажа ударяет по bid.", hitBid);
}

export function addLimitBid(state: OrderflowEngineState, price: number, size: number, large = false): OrderflowEngineState {
  if (size <= 0) return state;
  const levels = setLevel(state.levels, price, (level) => {
    level.bidSize += size;
    if (large) level.bidIsLarge = true;
  });
  const annotation: ScenarioAnnotation | undefined = large
    ? { price: roundPrice(price), label: "крупная заявка", kind: "large-order" }
    : undefined;
  return {
    ...state,
    levels,
    simTime: state.simTime + 1,
    lastExplanation: "Лимитная заявка на покупку добавляет ликвидность в bid.",
    scenarioPlayback: annotation
      ? { ...state.scenarioPlayback, annotations: [...state.scenarioPlayback.annotations.slice(-4), annotation] }
      : state.scenarioPlayback,
  };
}

export function addLimitAsk(state: OrderflowEngineState, price: number, size: number, large = false): OrderflowEngineState {
  if (size <= 0) return state;
  const levels = setLevel(state.levels, price, (level) => {
    level.askSize += size;
    if (large) level.askIsLarge = true;
  });
  const annotation: ScenarioAnnotation | undefined = large
    ? { price: roundPrice(price), label: "крупная заявка", kind: "large-order" }
    : undefined;
  return {
    ...state,
    levels,
    simTime: state.simTime + 1,
    lastExplanation: "Лимитная заявка на продажу добавляет ликвидность в ask.",
    scenarioPlayback: annotation
      ? { ...state.scenarioPlayback, annotations: [...state.scenarioPlayback.annotations.slice(-4), annotation] }
      : state.scenarioPlayback,
  };
}

function appendTapeOnlyTrade(state: OrderflowEngineState, trade: SimTradePrint): OrderflowEngineState {
  return {
    ...state,
    simTime: Math.max(state.simTime, trade.timestamp),
    nextTradeId: state.nextTradeId + 1,
    trades: [trade, ...state.trades].slice(0, MAX_TRADES),
    recentExecutedLevels: appendExecutedFlashes(state, [trade]),
  };
}

function simTick(state: OrderflowEngineState): OrderflowEngineState {
  const burst = ambientBurstCount(state);
  if (burst > 0) {
    let next = state;
    for (let i = 0; i < burst; i += 1) {
      next = appendTapeOnlyTrade(next, createAmbientTrade(next, { burst: true }));
    }
    return next;
  }

  if (shouldEmitAmbientTrade(state)) {
    const seed = nextSimSeed();
    if (seed % 4 === 0) {
      const isBuy = seed % 2 === 0;
      const size = LOT_SIZE * (1 + (seed % 5));
      return isBuy ? applyMarketBuy(state, size) : applyMarketSell(state, size);
    }
    return appendTapeOnlyTrade(state, createAmbientTrade(state));
  }

  const seed = nextSimSeed();
  const isBuy = seed % 2 === 0;
  const size = LOT_SIZE * (1 + (seed % 5));
  return isBuy ? applyMarketBuy(state, size) : applyMarketSell(state, size);
}

const MM_GRID_TICK_OFFSETS = [2, 4, 7, 11] as const;

export function setupMarketMakerGrid(state: OrderflowEngineState): OrderflowEngineState {
  const best = findBestBidAsk(state.levels);
  if (best.bestBid == null || best.bestAsk == null) return state;

  let levels = stripDefaultLargeLevels(state.levels);
  for (const off of MM_GRID_TICK_OFFSETS) {
    const bidPrice = roundPrice(best.bestBid - off * TICK_SIZE);
    const askPrice = roundPrice(best.bestAsk + off * TICK_SIZE);
    const size = 1600 + off * 180;
    levels = setLevel(levels, bidPrice, (level) => {
      level.bidSize = size;
      level.bidIsLarge = false;
      level.isMarketMakerLevel = true;
    });
    levels = setLevel(levels, askPrice, (level) => {
      level.askSize = size;
      level.askIsLarge = false;
      level.isMarketMakerLevel = true;
    });
  }

  const annotation: ScenarioAnnotation = {
    label: "маркетмейкерская сетка",
    kind: "mm-grid",
  };

  return {
    ...state,
    levels,
    simTime: state.simTime + 1,
    lastExplanation:
      "Маркетмейкер поддерживает ликвидность, выставляя заявки по обе стороны цены. Учебная модель.",
    scenarioPlayback: {
      ...state.scenarioPlayback,
      annotations: [...state.scenarioPlayback.annotations.slice(-4), annotation],
    },
  };
}

function appendJournal(state: OrderflowEngineState, tick: number, step: ScenarioStep): OrderflowEngineState {
  globalStepIndex += 1;
  const j = step.journal;
  const entry: ScenarioJournalEntry = {
    tick,
    stepIndex: globalStepIndex,
    explanation: step.explanation,
    watchHint: step.watchHint ?? j?.watchBook ?? "Стакан, ленту и кластера на текущем шаге.",
    whyImportant: step.whyImportant ?? "Учебная модель — не торговая рекомендация и не гарантия движения.",
    appeared: j?.appeared,
    aggressor: j?.aggressor,
    levelOutcome: j?.levelOutcome,
    watchBook: j?.watchBook,
  };
  return {
    ...state,
    lastExplanation: step.explanation,
    scenarioPlayback: {
      ...state.scenarioPlayback,
      journal: [...state.scenarioPlayback.journal, entry],
    },
  };
}

function applyAnnotationStep(state: OrderflowEngineState, step: ScenarioStep): OrderflowEngineState {
  const price = typeof step.payload.price === "number" ? roundPrice(step.payload.price) : undefined;
  const label = String(step.payload.label ?? "уровень");
  const kind = (step.payload.kind as ScenarioAnnotationKind) ?? "large-order";
  const annotation: ScenarioAnnotation = { price, label, kind };
  return {
    ...state,
    scenarioPlayback: {
      ...state.scenarioPlayback,
      annotations: [...state.scenarioPlayback.annotations.slice(-4), annotation],
    },
  };
}

function executeScenarioStep(state: OrderflowEngineState, step: ScenarioStep): OrderflowEngineState {
  let next = state;
  const p = step.payload;

  switch (step.action) {
    case "addLimitBid":
      next = addLimitBid(next, Number(p.price), Number(p.size), Boolean(p.large));
      break;
    case "addLimitAsk":
      next = addLimitAsk(next, Number(p.price), Number(p.size), Boolean(p.large));
      break;
    case "marketBuy":
      next = applyMarketBuy(next, Number(p.size));
      break;
    case "marketSell":
      next = applyMarketSell(next, Number(p.size));
      break;
    case "cancelLimit":
      next = orderflowSimulatorReducer(next, {
        type: "CANCEL_LIMIT",
        price: Number(p.price),
        side: p.side === "ask" ? "ask" : "bid",
      });
      break;
    case "setupIceberg":
      next = setupIceberg(
        next,
        Number(p.price),
        p.side === "ask" ? "ask" : "bid",
        Number(p.visibleSize),
        Number(p.hiddenSize),
        Number(p.refillSize),
      );
      break;
    case "replenishIceberg":
      next = tryReplenishIceberg(next, Number(p.price), p.side === "ask" ? "ask" : "bid");
      break;
    case "setupMarketMakerGrid":
      next = setupMarketMakerGrid(next);
      break;
    case "annotation":
      next = applyAnnotationStep(next, step);
      break;
    default:
      break;
  }

  if (step.action === "annotation") {
    return appendJournal(next, step.atTick, step);
  }

  return appendJournal(next, step.atTick, step);
}

function runScenarioTickAt(state: OrderflowEngineState, tick: number): OrderflowEngineState {
  const scenario = getScenarioById(state.scenarioPlayback.activeScenarioId ?? state.scenario);
  if (!scenario) return state;

  const steps = getStepsAtTick(scenario, tick);
  let next = { ...state, scenarioPlayback: { ...state.scenarioPlayback, scenarioTick: tick } };
  for (const step of steps) {
    next = executeScenarioStep(next, step);
  }
  return next;
}

function advanceScenario(state: OrderflowEngineState): OrderflowEngineState {
  const scenario = getScenarioById(state.scenarioPlayback.activeScenarioId ?? state.scenario);
  if (!scenario) return state;

  const nextTick = state.scenarioPlayback.scenarioTick + 1;
  const maxTick = getScenarioMaxTick(scenario);

  if (nextTick > maxTick) {
    return {
      ...state,
      isPlaying: false,
      scenarioPlayback: {
        ...state.scenarioPlayback,
        isScenarioPlaying: false,
        isScenarioComplete: true,
      },
      lastExplanation: "Сценарий завершён. Можно повторить или выбрать другой урок — это модель, не прогноз.",
    };
  }

  return runScenarioTickAt(state, nextTick);
}

export function createInitialEngineState(): OrderflowEngineState {
  const simTime = Date.now();
  const base = createInitialGazpSimulation();
  const shell: OrderflowEngineState = {
    ...base,
    trades: [],
    clusters: [],
    icebergs: [],
    candleTimeframe: 5,
    tickMergeMs: 100,
    lastExplanation: null,
    simTime,
    nextTradeId: 1000,
    scenarioPlayback: emptyPlayback(),
    recentExecutedLevels: [],
  };
  return {
    ...shell,
    trades: seedDemoTapeTrades(shell, 28),
  };
}

export function createScenarioEngineState(scenarioId: SimScenarioName): OrderflowEngineState {
  const scenario = getScenarioById(scenarioId);
  if (!scenario) return createInitialEngineState();

  globalStepIndex = 0;
  let state = createInitialEngineState();
  state = {
    ...state,
    scenario: scenarioId,
    currentPrice: scenario.initialPrice ?? state.currentPrice,
    trades: [],
    clusters: [],
    icebergs: [],
    levels: stripDefaultLargeLevels(state.levels),
    isPlaying: false,
    scenarioPlayback: {
      activeScenarioId: scenarioId,
      scenarioTick: -1,
      isScenarioPlaying: false,
      isScenarioComplete: false,
      journal: [],
      annotations: [],
      learningGoal: scenario.learningGoal,
    },
    lastExplanation: `Урок: ${scenario.title}. ${scenario.description} Сценарий не гарантирует движение на реальном рынке.`,
  };

  state = regenerateOrderBookAroundPrice(state);
  return state;
}

export function orderflowSimulatorReducer(
  state: OrderflowEngineState,
  action: OrderflowSimulatorAction,
): OrderflowEngineState {
  switch (action.type) {
    case "SIM_TICK":
      if (state.scenarioPlayback.isScenarioPlaying && state.scenarioPlayback.activeScenarioId) {
        return advanceScenario(state);
      }
      return simTick(state);
    case "STEP":
    case "SCENARIO_STEP":
      if (state.scenarioPlayback.activeScenarioId && !state.scenarioPlayback.isScenarioComplete) {
        return advanceScenario(state);
      }
      return simTick(state);
    case "MARKET_BUY":
      return applyMarketBuy(state, action.size);
    case "MARKET_SELL":
      return applyMarketSell(state, action.size);
    case "ADD_LIMIT_BID":
      return addLimitBid(state, action.price, action.size);
    case "ADD_LIMIT_ASK":
      return addLimitAsk(state, action.price, action.size);
    case "CANCEL_LIMIT": {
      const rounded = roundPrice(action.price);
      const levels = state.levels.map((level) => {
        if (Math.abs(level.price - rounded) >= TICK_SIZE / 2) return level;
        const copy = { ...level };
        if (action.side === "bid") {
          copy.bidSize = 0;
          copy.bidIsLarge = false;
          copy.bidIsIceberg = false;
        } else {
          copy.askSize = 0;
          copy.askIsLarge = false;
          copy.askIsIceberg = false;
        }
        return copy;
      });
      const icebergs = state.icebergs.filter(
        (ib) => !(Math.abs(ib.price - rounded) < TICK_SIZE / 2 && ib.side === action.side),
      );
      return {
        ...state,
        levels,
        icebergs,
        lastExplanation: `Лимитная заявка ${action.side === "bid" ? "bid" : "ask"} на ${rounded} снята.`,
      };
    }
    case "MOVE_PRICE_TO_LEVEL":
      return regenerateOrderBookAroundPrice({
        ...state,
        currentPrice: roundPrice(action.price),
        lastExplanation: `Цена перемещена на уровень ${roundPrice(action.price)}.`,
      });
    case "SELECT_SCENARIO":
      return createScenarioEngineState(action.scenarioId);
    case "START_SCENARIO": {
      if (!state.scenarioPlayback.activeScenarioId) return state;
      return {
        ...state,
        isPlaying: true,
        scenarioPlayback: {
          ...state.scenarioPlayback,
          isScenarioPlaying: true,
          isScenarioComplete: false,
          journal: [],
          annotations: [],
          scenarioTick: -1,
        },
        lastExplanation: "Сценарий запущен — следите за стаканом, лентой и графиком.",
      };
    }
    case "STOP_SCENARIO":
      return {
        ...state,
        isPlaying: false,
        scenarioPlayback: { ...state.scenarioPlayback, isScenarioPlaying: false },
      };
    case "RESET_SCENARIO":
      if (state.scenarioPlayback.activeScenarioId) {
        return createScenarioEngineState(state.scenarioPlayback.activeScenarioId);
      }
      return createInitialEngineState();
    case "SET_SPEED":
      return { ...state, speed: action.speed };
    case "SET_SCENARIO":
      return createScenarioEngineState(action.scenario);
    case "SET_CANDLE_TIMEFRAME":
      return { ...state, candleTimeframe: action.timeframe };
    case "SET_TICK_MERGE":
      return { ...state, tickMergeMs: action.mergeMs };
    case "PAUSE":
      return {
        ...state,
        isPlaying: false,
        scenarioPlayback: { ...state.scenarioPlayback, isScenarioPlaying: false },
      };
    case "PLAY":
      if (state.scenarioPlayback.activeScenarioId && !state.scenarioPlayback.isScenarioComplete) {
        return {
          ...state,
          isPlaying: true,
          scenarioPlayback: { ...state.scenarioPlayback, isScenarioPlaying: true },
        };
      }
      return { ...state, isPlaying: true };
    case "LOAD_SYMBOL": {
      const preset = getPresetBySymbol(action.symbol);
      return preset ? createEngineStateFromPreset(preset) : createInitialEngineState();
    }
    case "LOAD_ENGINE_STATE":
      return {
        ...action.state,
        isPlaying: false,
        scenarioPlayback: {
          ...action.state.scenarioPlayback,
          isScenarioPlaying: false,
        },
      };
    default:
      return state;
  }
}

export function isLargeTrade(size: number): boolean {
  return size >= LARGE_TRADE_THRESHOLD;
}

export type GroupedTapeRow = {
  id: string;
  timestamp: number;
  price: number;
  size: number;
  aggressorSide: AggressorSide;
  printCount: number;
};

export function groupTapePrints(trades: SimTradePrint[], mergeMs: TickMergeMs): GroupedTapeRow[] {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => b.timestamp - a.timestamp);
  const grouped: GroupedTapeRow[] = [];

  for (const trade of sorted) {
    const last = grouped[grouped.length - 1];
    if (
      last &&
      last.aggressorSide === trade.aggressorSide &&
      last.price === trade.price &&
      Math.abs(last.timestamp - trade.timestamp) <= mergeMs
    ) {
      last.size += trade.size;
      last.printCount += 1;
      last.timestamp = Math.max(last.timestamp, trade.timestamp);
      continue;
    }

    grouped.push({
      id: trade.id,
      timestamp: trade.timestamp,
      price: trade.price,
      size: trade.size,
      aggressorSide: trade.aggressorSide,
      printCount: 1,
    });
  }

  return grouped;
}

export const DEMO_MARKET_SELL_SIZE = 5000;

export type { OrderflowScenario, ScenarioStep };
