import {
  createEngineStateFromPreset,
  DEMO_INSTRUMENT_PRESETS,
  getPresetBySymbol,
  MULTI_WINDOW_SYMBOL_ORDER,
  type SimInstrumentPreset,
} from "@/lib/domain/orderflow-instrument-presets";
import {
  addLimitBid,
  applyMarketBuy,
  applyMarketSell,
  orderflowSimulatorReducer,
  type OrderflowEngineState,
  type OrderflowSimulatorAction,
} from "@/lib/domain/orderflow-simulator-engine";
import { roundPrice } from "@/lib/domain/orderflow-simulator";

export type MarketPressureScene = {
  playing: boolean;
  tick: number;
  maxTick: number;
  title: string;
  lastNote: string | null;
};

export type MultiMarketState = {
  instruments: Record<string, OrderflowEngineState>;
  order: string[];
  pressure: MarketPressureScene;
};

export type MultiMarketAction =
  | { type: "TICK_ALL" }
  | { type: "RESET_ALL" }
  | { type: "START_PRESSURE_SCENE" }
  | { type: "PRESSURE_STEP" }
  | { type: "STOP_PRESSURE" }
  | { type: "INSTRUMENT_DISPATCH"; symbol: string; action: OrderflowSimulatorAction };

export const MARKET_PRESSURE_TITLE = "Рынок под давлением";

export function createInitialMultiMarket(): MultiMarketState {
  const instruments: Record<string, OrderflowEngineState> = {};
  for (const preset of DEMO_INSTRUMENT_PRESETS) {
    instruments[preset.symbol] = createEngineStateFromPreset(preset);
  }
  return {
    instruments,
    order: [...MULTI_WINDOW_SYMBOL_ORDER],
    pressure: {
      playing: false,
      tick: -1,
      maxTick: 7,
      title: MARKET_PRESSURE_TITLE,
      lastNote: null,
    },
  };
}

function mapInstruments(
  state: MultiMarketState,
  fn: (engine: OrderflowEngineState, symbol: string) => OrderflowEngineState,
): MultiMarketState {
  const instruments = { ...state.instruments };
  for (const symbol of state.order) {
    if (instruments[symbol]) {
      instruments[symbol] = fn(instruments[symbol]!, symbol);
    }
  }
  return { ...state, instruments };
}

function tickEngine(engine: OrderflowEngineState, bias?: "up" | "down" | "flat"): OrderflowEngineState {
  if (bias === "down") {
    return applyMarketSell(engine, engine.lotSize * (3 + Math.floor(Math.random() * 4)));
  }
  if (bias === "up") {
    return applyMarketBuy(engine, engine.lotSize * (3 + Math.floor(Math.random() * 4)));
  }
  return orderflowSimulatorReducer(engine, { type: "STEP" });
}

function applyPressureScript(
  instruments: Record<string, OrderflowEngineState>,
  tick: number,
): { instruments: Record<string, OrderflowEngineState>; note: string } {
  const next = { ...instruments };

  const set = (symbol: string, engine: OrderflowEngineState) => {
    if (next[symbol]) next[symbol] = engine;
  };

  switch (tick) {
    case 0:
      set("SI", applyMarketSell(next.SI!, 800));
      set("CNY", applyMarketSell(next.CNY!, next.CNY!.lotSize * 5));
      set("EU", tickEngine(next.EU!, "flat"));
      set("SBER", tickEngine(next.SBER!, "flat"));
      set("VTBR", tickEngine(next.VTBR!, "flat"));
      return { instruments: next, note: "SI и CNY под давлением продаж — учебная сцена, не корреляция MOEX." };
    case 1:
      set("SI", applyMarketSell(next.SI!, 1200));
      set("CNY", applyMarketSell(next.CNY!, next.CNY!.lotSize * 8));
      set("EU", applyMarketBuy(next.EU!, next.EU!.lotSize * 2));
      return { instruments: next, note: "Продолжение давления на валютные demo-инструменты." };
    case 2:
      set("GAZP", addLimitBid(next.GAZP!, roundPrice(next.GAZP!.currentPrice - next.GAZP!.tickSize), 5500, true));
      return { instruments: next, note: "GAZP: крупный bid — подготовка отскока в модели." };
    case 3:
      set("GAZP", applyMarketSell(next.GAZP!, 1800));
      set("GAZP", applyMarketBuy(next.GAZP!, 1200));
      return { instruments: next, note: "GAZP: отскок от bid — поглощение продаж на уровне." };
    case 4:
      set("SBER", tickEngine(next.SBER!, "flat"));
      set("VTBR", tickEngine(next.VTBR!, "flat"));
      return { instruments: next, note: "SBER и VTBR спокойны — фон для сцены." };
    case 5:
      set("EU", tickEngine(next.EU!, "flat"));
      set("SI", tickEngine(next.SI!, "flat"));
      return { instruments: next, note: "EU отдельно от пары SI/CNY — условная динамика." };
    case 6:
      set("CNY", tickEngine(next.CNY!, "up"));
      return { instruments: next, note: "CNY стабилизируется в модели." };
    case 7:
      return {
        instruments: next,
        note: "Сцена завершена. Кликните по плитке, чтобы открыть инструмент в режиме «Привод».",
      };
    default:
      return { instruments: next, note: "Сцена завершена." };
  }
}

export function multiMarketReducer(state: MultiMarketState, action: MultiMarketAction): MultiMarketState {
  switch (action.type) {
    case "TICK_ALL":
      return mapInstruments(state, (engine) => orderflowSimulatorReducer(engine, { type: "STEP" }));

    case "RESET_ALL":
      return createInitialMultiMarket();

    case "START_PRESSURE_SCENE":
      return {
        ...createInitialMultiMarket(),
        pressure: {
          playing: true,
          tick: -1,
          maxTick: 7,
          title: MARKET_PRESSURE_TITLE,
          lastNote: "Сцена «Рынок под давлением» — синхронная учебная модель.",
        },
      };

    case "PRESSURE_STEP": {
      const nextTick = state.pressure.tick + 1;
      if (nextTick > state.pressure.maxTick) {
        return {
          ...state,
          pressure: { ...state.pressure, playing: false, lastNote: "Сцена завершена." },
        };
      }
      const { instruments, note } = applyPressureScript(state.instruments, nextTick);
      return {
        ...state,
        instruments,
        pressure: { ...state.pressure, tick: nextTick, lastNote: note },
      };
    }

    case "STOP_PRESSURE":
      return {
        ...state,
        pressure: { ...state.pressure, playing: false },
      };

    case "INSTRUMENT_DISPATCH": {
      const engine = state.instruments[action.symbol];
      if (!engine) return state;
      return {
        ...state,
        instruments: {
          ...state.instruments,
          [action.symbol]: orderflowSimulatorReducer(engine, action.action),
        },
      };
    }

    default:
      return state;
  }
}

export type { SimInstrumentPreset };
