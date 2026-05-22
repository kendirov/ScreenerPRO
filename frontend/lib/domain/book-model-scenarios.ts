import {
  BOOK_MODEL_PRICE_PRESETS,
  type BookModelLevel,
  type BookModelPricePreset,
  type BookModelSnapshot,
} from "@/components/lab/orderflow-simulator/simple-order-book-model";

export type BookModelScenarioId =
  | "normal"
  | "large-bid"
  | "large-ask"
  | "market-buy"
  | "market-sell"
  | "spread"
  | "iceberg";

export type BookModelStepExplain = {
  see: string;
  means: string;
  look: string;
};

export type BookModelScenarioDef = {
  id: BookModelScenarioId;
  label: string;
  caption: string;
  explain: BookModelStepExplain;
  /** Сцена с анимацией ленты / стакана */
  animated?: boolean;
};

export const BOOK_MODEL_SCENARIOS: BookModelScenarioDef[] = [
  {
    id: "normal",
    label: "Обычный стакан",
    caption: "Лимитные заявки ждут исполнения — между лучшим bid и ask виден спред.",
    explain: {
      see: "Обычные объёмы 300–2500 лотов на разных ценах, между лучшими bid и ask — зазор (спред).",
      means: "В стакане стоят лимитные заявки: покупатели и продавцы ждут контрагента по своей цене.",
      look: "На спред и на то, насколько плотно стоят заявки у лучших цен.",
    },
  },
  {
    id: "large-bid",
    label: "Крупная заявка на покупку",
    caption: "Крупная лимитная заявка на покупку.",
    explain: {
      see: "Заявка 20K стоит на bid ниже лучшей цены покупки — уровень подсвечен янтарным.",
      means: "Покупатель готов купить большой объём по этой цене и ждёт продавца.",
      look: "Будут ли продажи пробивать этот уровень или он удержит цену.",
    },
  },
  {
    id: "large-ask",
    label: "Крупная заявка на продажу",
    caption: "Крупная лимитная заявка на продажу.",
    explain: {
      see: "Заявка 20K стоит на ask выше лучшей цены продажи — уровень подсвечен янтарным.",
      means: "Продавец готов продать большой объём по этой цене и ждёт покупателя.",
      look: "Будут ли покупки съедать этот уровень или цена отскочит от него.",
    },
  },
  {
    id: "market-buy",
    label: "Рыночная покупка",
    caption: "Рыночная покупка забирает ликвидность у лучшего ask.",
    animated: true,
    explain: {
      see: "Зелёные круги летят в зону ask, объём на лучшем ask уменьшается, в кластере растёт зелёный след.",
      means: "Покупатель не ждал — ударил по лучшей продаже и исполнился сразу.",
      look: "Ленту (сделки), стакан (исчезающий ask) и кластер (накопленная покупка на цене).",
    },
  },
  {
    id: "market-sell",
    label: "Рыночная продажа",
    caption: "Рыночная продажа бьёт по лучшему bid.",
    animated: true,
    explain: {
      see: "Красные круги летят в зону bid, объём на лучшем bid уменьшается, в кластере растёт красный след.",
      means: "Продавец ударил по лучшей покупке — сделка прошла сразу.",
      look: "Ленту, стакан (исчезающий bid) и кластер на цене удара.",
    },
  },
  {
    id: "spread",
    label: "Спред",
    caption: "Спред — разница между лучшей покупкой и лучшей продажей.",
    explain: {
      see: "Между лучшим bid (снизу у спреда) и лучшим ask (сверху у спреда) — подсвеченный зазор.",
      means: "Это разрыв цен: сделка «по рынку» сразу платит этот зазор агрессору.",
      look: "На ширину спреда — узкий спред удобнее для частых сделок, широкий — дороже вход.",
    },
  },
  {
    id: "iceberg",
    label: "Айсберг простыми словами",
    caption:
      "Видимый объём маленький, но через уровень проходит больше — модель айсберга.",
    animated: true,
    explain: {
      see: "В стакане видно ~2K, по уровню проходят сделки на 10K суммарно, видимый объём снова ~2K.",
      means: "Часть объёма скрыта: в стакане показывается только «верхушка» айсберга.",
      look: "На ленту, кластер и на то, что заявка «не кончается» после крупных продаж.",
    },
  },
];

export const BOOK_MODEL_SCENARIO_MAP = Object.fromEntries(
  BOOK_MODEL_SCENARIOS.map((s) => [s.id, s]),
) as Record<BookModelScenarioId, BookModelScenarioDef>;

function roundToTick(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}

const NORMAL_ASK_PATTERN = [
  1200, 800, 2100, 600, 1800, 500, 2400, 900, 1500, 700, 1100, 400, 2000, 650, 1400, 550, 900, 350, 750, 300,
];

const NORMAL_BID_PATTERN = [
  900, 1500, 600, 2200, 1100, 500, 1800, 750, 1300, 450, 1000, 800, 1600, 550, 1200, 650, 950, 400, 700, 350,
];

function buildBaseSnapshot(preset: BookModelPricePreset): BookModelSnapshot {
  const { basePrice, tickSize } = BOOK_MODEL_PRICE_PRESETS[preset];
  const bestBid = roundToTick(basePrice, tickSize);
  const bestAsk = roundToTick(basePrice + tickSize, tickSize);
  const LEVELS = 20;

  const asks: BookModelLevel[] = [];
  for (let i = 0; i < LEVELS; i += 1) {
    asks.push({
      price: roundToTick(bestAsk + i * tickSize, tickSize),
      volume: NORMAL_ASK_PATTERN[i] ?? 500,
      side: "ask",
      isBest: i === 0,
    });
  }

  const bids: BookModelLevel[] = [];
  for (let i = 0; i < LEVELS; i += 1) {
    bids.push({
      price: roundToTick(bestBid - i * tickSize, tickSize),
      volume: NORMAL_BID_PATTERN[i] ?? 500,
      side: "bid",
      isBest: i === 0,
    });
  }

  return {
    asks: asks.reverse(),
    bids,
    bestAsk,
    bestBid,
    spread: roundToTick(bestAsk - bestBid, tickSize),
    tickSize,
  };
}

function cloneSnapshot(snapshot: BookModelSnapshot): BookModelSnapshot {
  return {
    ...snapshot,
    asks: snapshot.asks.map((l) => ({ ...l })),
    bids: snapshot.bids.map((l) => ({ ...l })),
  };
}

function setBidVolume(snapshot: BookModelSnapshot, price: number, volume: number): BookModelSnapshot {
  const next = cloneSnapshot(snapshot);
  const level = next.bids.find((l) => Math.abs(l.price - price) < next.tickSize / 2);
  if (level) level.volume = volume;
  return next;
}

function setAskVolume(snapshot: BookModelSnapshot, price: number, volume: number): BookModelSnapshot {
  const next = cloneSnapshot(snapshot);
  const level = next.asks.find((l) => Math.abs(l.price - price) < next.tickSize / 2);
  if (level) level.volume = volume;
  return next;
}

export function buildBookSnapshotForScenario(
  preset: BookModelPricePreset,
  scenarioId: BookModelScenarioId,
): BookModelSnapshot {
  const base = buildBaseSnapshot(preset);
  const { tickSize, bestBid, bestAsk } = base;

  switch (scenarioId) {
    case "normal":
    case "spread":
    case "market-buy":
    case "market-sell":
      return base;

    case "large-bid": {
      const wallPrice = roundToTick(bestBid - tickSize, tickSize);
      return setBidVolume(base, wallPrice, 20_000);
    }

    case "large-ask": {
      const wallPrice = roundToTick(bestAsk + tickSize, tickSize);
      return setAskVolume(base, wallPrice, 20_000);
    }

    case "iceberg": {
      const icePrice = roundToTick(bestBid - tickSize * 2, tickSize);
      return setBidVolume(base, icePrice, 2_000);
    }

    default:
      return base;
  }
}

export type BookModelClusterCell = {
  price: number;
  buyVol: number;
  sellVol: number;
};

export function emptyClusters(): BookModelClusterCell[] {
  return [];
}

/** Цены для отображения кластеров в учебной модели */
export function clusterPricesForSnapshot(snapshot: BookModelSnapshot): number[] {
  const { bestAsk, bestBid, tickSize } = snapshot;
  return [
    bestAsk,
    roundToTick(bestAsk + tickSize, tickSize),
    bestBid,
    roundToTick(bestBid - tickSize, tickSize),
    roundToTick(bestBid - tickSize * 2, tickSize),
  ];
}

export function initClustersForSnapshot(snapshot: BookModelSnapshot): BookModelClusterCell[] {
  return clusterPricesForSnapshot(snapshot).map((price) => ({
    price,
    buyVol: 0,
    sellVol: 0,
  }));
}

export function addClusterVolume(
  cells: BookModelClusterCell[],
  price: number,
  side: "buy" | "sell",
  amount: number,
  tickSize: number,
): BookModelClusterCell[] {
  const idx = cells.findIndex((c) => Math.abs(c.price - price) < tickSize / 2);
  if (idx < 0) return cells;
  return cells.map((c, i) => {
    if (i !== idx) return c;
    return side === "buy"
      ? { ...c, buyVol: c.buyVol + amount }
      : { ...c, sellVol: c.sellVol + amount };
  });
}

export function reduceBestAsk(snapshot: BookModelSnapshot, amount: number): BookModelSnapshot {
  const next = cloneSnapshot(snapshot);
  const best = next.asks.find((l) => l.isBest);
  if (best) best.volume = Math.max(0, best.volume - amount);
  return next;
}

export function reduceBestBid(snapshot: BookModelSnapshot, amount: number): BookModelSnapshot {
  const next = cloneSnapshot(snapshot);
  const best = next.bids.find((l) => l.isBest);
  if (best) best.volume = Math.max(0, best.volume - amount);
  return next;
}

export function icebergBidPrice(snapshot: BookModelSnapshot): number {
  return roundToTick(snapshot.bestBid - snapshot.tickSize * 2, snapshot.tickSize);
}

export function restoreIcebergVisible(snapshot: BookModelSnapshot): BookModelSnapshot {
  return setBidVolume(snapshot, icebergBidPrice(snapshot), 2_000);
}

export function hitIcebergLevel(snapshot: BookModelSnapshot, amount: number): BookModelSnapshot {
  const icePrice = icebergBidPrice(snapshot);
  const next = cloneSnapshot(snapshot);
  const level = next.bids.find((l) => Math.abs(l.price - icePrice) < next.tickSize / 2);
  if (level) level.volume = Math.max(400, level.volume - amount);
  return next;
}
