import { detectAbsorptionSignals } from "@/lib/domain/orderflow-absorption";
import type { DomLevelTooltipData } from "@/lib/domain/order-book-ladder-model";
import { findBestBidAsk, pricesEqual } from "@/lib/domain/order-book-ladder-model";
import type { SimCandle, SimClusterCell, SimOrderBookLevel } from "@/lib/domain/orderflow-simulator";

export type DomFocusDemoKind =
  | "large-order"
  | "spread"
  | "market-buy"
  | "market-sell"
  | "iceberg"
  | "absorption";

export type DomFocusTeachingHighlight = {
  price: number;
  side: "ask" | "bid";
  strong?: boolean;
};

export type DomFocusLevelSelection = {
  price: number;
  side: "ask" | "bid";
};

export type DomFocusDemoResult = {
  highlights: DomFocusTeachingHighlight[];
  caption: string;
  selection?: DomFocusLevelSelection;
  marketAction?: "buy" | "sell";
};

function largestWall(
  levels: SimOrderBookLevel[],
): { level: SimOrderBookLevel; side: "ask" | "bid" } | undefined {
  let best: { level: SimOrderBookLevel; side: "ask" | "bid"; size: number } | undefined;
  for (const level of levels) {
    if (level.askSize > 0 && (!best || level.askSize > best.size)) {
      best = { level, side: "ask", size: level.askSize };
    }
    if (level.bidSize > 0 && (!best || level.bidSize > best.size)) {
      best = { level, side: "bid", size: level.bidSize };
    }
  }
  return best ? { level: best.level, side: best.side } : undefined;
}

function firstIceberg(
  levels: SimOrderBookLevel[],
): { level: SimOrderBookLevel; side: "ask" | "bid" } | undefined {
  for (const level of levels) {
    if (level.askIsIceberg && level.askSize > 0) return { level, side: "ask" };
    if (level.bidIsIceberg && level.bidSize > 0) return { level, side: "bid" };
  }
  return undefined;
}

export function resolveDomFocusDemo(
  kind: DomFocusDemoKind,
  levels: SimOrderBookLevel[],
  currentPrice: number,
  clusters: SimClusterCell[],
  candles: SimCandle[],
): DomFocusDemoResult {
  const best = findBestBidAsk(levels);

  switch (kind) {
    case "large-order": {
      const wall = largestWall(levels);
      if (!wall) {
        return {
          highlights: [],
          caption: "В симуляции нет крупной плотности — запустите сценарий или добавьте лимитку.",
        };
      }
      return {
        highlights: [{ price: wall.level.price, side: wall.side, strong: true }],
        caption:
          wall.side === "ask"
            ? "Крупная ask-плотность — препятствие для роста, пока её не снимут рыночные покупки."
            : "Крупная bid-плотность — поддержка; продажи должны её съесть для снижения.",
        selection: { price: wall.level.price, side: wall.side },
      };
    }
    case "spread": {
      const highlights: DomFocusTeachingHighlight[] = [];
      if (best.bestBid != null) highlights.push({ price: best.bestBid, side: "bid" });
      if (best.bestAsk != null) highlights.push({ price: best.bestAsk, side: "ask", strong: true });
      const spread =
        best.bestBid != null && best.bestAsk != null
          ? (best.bestAsk - best.bestBid).toFixed(2)
          : "—";
      return {
        highlights,
        caption: `Спред между лучшим bid и ask: ${spread} ₽. Узкий спред — ликвиднее вход; широкий — осторожнее с рыночными.`,
        selection:
          best.bestAsk != null
            ? { price: best.bestAsk, side: "ask" }
            : best.bestBid != null
              ? { price: best.bestBid, side: "bid" }
              : undefined,
      };
    }
    case "market-buy":
      return {
        highlights: best.bestAsk != null ? [{ price: best.bestAsk, side: "ask", strong: true }] : [],
        caption: "Рыночная покупка бьёт по ask — в ленте зелёный пузырь, строка ask подсвечивается.",
        selection: best.bestAsk != null ? { price: best.bestAsk, side: "ask" } : undefined,
        marketAction: "buy",
      };
    case "market-sell":
      return {
        highlights: best.bestBid != null ? [{ price: best.bestBid, side: "bid", strong: true }] : [],
        caption: "Рыночная продажа бьёт по bid — красный пузырь в ленте, подсветка bid.",
        selection: best.bestBid != null ? { price: best.bestBid, side: "bid" } : undefined,
        marketAction: "sell",
      };
    case "iceberg": {
      const ice = firstIceberg(levels);
      if (!ice) {
        return {
          highlights: [],
          caption: "Айсберг не найден — в симуляции ищите метку «i» у уровня с восстановлением объёма.",
        };
      }
      return {
        highlights: [{ price: ice.level.price, side: ice.side, strong: true }],
        caption:
          "Айсберг: видимый объём исполняют, затем снова появляется — учебная модель скрытой ликвидности.",
        selection: { price: ice.level.price, side: ice.side },
      };
    }
    case "absorption": {
      const signals = detectAbsorptionSignals(clusters, levels, currentPrice, candles);
      const hit = signals[0];
      if (!hit) {
        return {
          highlights: [],
          caption:
            "Абсорбция не обнаружена в последних кластерах — накопите сделки или запустите сценарий с удержанием уровня.",
        };
      }
      const side: "ask" | "bid" = hit.type === "buyer" ? "bid" : "ask";
      return {
        highlights: [{ price: hit.price, side, strong: true }],
        caption: `${hit.label} — много агрессии, но цена не проходит уровень (симуляция).`,
        selection: { price: hit.price, side },
      };
    }
    default:
      return { highlights: [], caption: "" };
  }
}

export function isTeachingHighlight(
  highlights: DomFocusTeachingHighlight[],
  price: number,
  side: "ask" | "bid",
): { active: boolean; strong: boolean } {
  const hit = highlights.find((h) => h.side === side && pricesEqual(h.price, price));
  return { active: Boolean(hit), strong: Boolean(hit?.strong) };
}

export function selectionMatches(
  selection: DomFocusLevelSelection | null | undefined,
  price: number,
  side: "ask" | "bid",
): boolean {
  return Boolean(selection && selection.side === side && pricesEqual(selection.price, price));
}
