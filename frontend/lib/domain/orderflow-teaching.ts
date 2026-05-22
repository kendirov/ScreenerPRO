import type { ScenarioAnnotation } from "@/lib/domain/orderflow-simulator-engine";
import type { SimOrderBookLevel } from "@/lib/domain/orderflow-simulator";
import { roundPrice } from "@/lib/domain/orderflow-simulator";

export type SimulatorUiMode = "workspace" | "lesson" | "presentation";

/** Режим компоновки экрана: учебный / привод / стакан крупно / модель стакана / мультиокно */
export type SimulatorViewMode =
  | "educational"
  | "terminal"
  | "domfocus"
  | "book-model"
  | "multiwindow";

export const VIEW_MODE_LABELS: Record<SimulatorViewMode, string> = {
  educational: "Учебный",
  terminal: "Привод",
  domfocus: "Стакан крупно",
  "book-model": "Модель стакана",
  multiwindow: "Мультиокно",
};

/** Порядок вкладок вида в UI */
export const VIEW_MODE_ORDER: SimulatorViewMode[] = [
  "educational",
  "terminal",
  "domfocus",
  "book-model",
  "multiwindow",
];

export type TeachingAnnotationColor = "green" | "red" | "yellow" | "purple" | "cyan";

export type TeachingAnnotation =
  | {
      id: string;
      type: "price-level";
      price: number;
      title: string;
      description: string;
      color: TeachingAnnotationColor;
      pulse?: boolean;
    }
  | {
      id: string;
      type: "arrow";
      from: { x: number; y: number };
      to: { x: number; y: number };
      title: string;
      color?: TeachingAnnotationColor;
    }
  | {
      id: string;
      type: "zone";
      priceFrom: number;
      priceTo: number;
      title: string;
      description: string;
      color?: TeachingAnnotationColor;
    };

export const UI_MODE_LABELS: Record<SimulatorUiMode, string> = {
  workspace: "Рабочий",
  lesson: "Урок",
  presentation: "Презентация",
};

export const TEACHING_COLOR_STROKE: Record<TeachingAnnotationColor, string> = {
  green: "rgba(52,211,153,0.75)",
  red: "rgba(251,113,133,0.75)",
  yellow: "rgba(251,191,36,0.8)",
  purple: "rgba(167,139,250,0.8)",
  cyan: "rgba(34,211,238,0.75)",
};

export const TEACHING_COLOR_GLOW: Record<TeachingAnnotationColor, string> = {
  green: "rgba(52,211,153,0.35)",
  red: "rgba(251,113,133,0.35)",
  yellow: "rgba(251,191,36,0.3)",
  purple: "rgba(167,139,250,0.35)",
  cyan: "rgba(34,211,238,0.35)",
};

let teachingId = 0;

export function nextTeachingId(prefix: string): string {
  teachingId += 1;
  return `${prefix}-${teachingId}`;
}

export function priceToPercentY(price: number, minPrice: number, maxPrice: number): number {
  const range = maxPrice - minPrice || 1;
  return Math.min(96, Math.max(4, ((maxPrice - price) / range) * 100));
}

function bestBidLevel(levels: SimOrderBookLevel[]): SimOrderBookLevel | undefined {
  return levels.filter((l) => l.bidSize > 0).sort((a, b) => b.price - a.price)[0];
}

function bestAskLevel(levels: SimOrderBookLevel[]): SimOrderBookLevel | undefined {
  return levels.filter((l) => l.askSize > 0).sort((a, b) => a.price - b.price)[0];
}

function largestDensityLevel(levels: SimOrderBookLevel[]): { level: SimOrderBookLevel; side: "bid" | "ask" } | undefined {
  let best: { level: SimOrderBookLevel; side: "bid" | "ask"; size: number } | undefined;
  for (const level of levels) {
    if (level.bidIsLarge || level.bidSize >= 2000) {
      if (!best || level.bidSize > best.size) best = { level, side: "bid", size: level.bidSize };
    }
    if (level.askIsLarge || level.askSize >= 2000) {
      if (!best || level.askSize > best.size) best = { level, side: "ask", size: level.askSize };
    }
  }
  return best ? { level: best.level, side: best.side } : undefined;
}

export function buildArrowToBid(
  levels: SimOrderBookLevel[],
  minPrice: number,
  maxPrice: number,
): TeachingAnnotation | null {
  const bid = bestBidLevel(levels);
  if (!bid) return null;
  const y = priceToPercentY(bid.price, minPrice, maxPrice);
  return {
    id: nextTeachingId("arrow-bid"),
    type: "arrow",
    from: { x: 88, y },
    to: { x: 38, y },
    title: "удар по bid",
    color: "red",
  };
}

export function buildArrowToAsk(
  levels: SimOrderBookLevel[],
  minPrice: number,
  maxPrice: number,
): TeachingAnnotation | null {
  const ask = bestAskLevel(levels);
  if (!ask) return null;
  const y = priceToPercentY(ask.price, minPrice, maxPrice);
  return {
    id: nextTeachingId("arrow-ask"),
    type: "arrow",
    from: { x: 88, y: y - 3 },
    to: { x: 38, y: y - 3 },
    title: "удар по ask",
    color: "green",
  };
}

export function buildCurrentPriceAnnotation(currentPrice: number): TeachingAnnotation {
  return {
    id: nextTeachingId("price-now"),
    type: "price-level",
    price: roundPrice(currentPrice),
    title: "текущая цена",
    description: "Последний симулированный принт — не котировка MOEX",
    color: "cyan",
    pulse: true,
  };
}

export function buildLargeOrderAnnotation(
  levels: SimOrderBookLevel[],
  minPrice: number,
  maxPrice: number,
): TeachingAnnotation | null {
  const density = largestDensityLevel(levels);
  if (!density) return null;
  const price = density.level.price;
  return {
    id: nextTeachingId("large"),
    type: "zone",
    priceFrom: price - 0.02,
    priceTo: price + 0.02,
    title: "крупная заявка",
    description: density.side === "bid" ? "Крупная bid-плотность" : "Крупная ask-плотность",
    color: "yellow",
  };
}

const SCENARIO_KIND_MAP: Record<
  string,
  { color: TeachingAnnotationColor; title: string; pulse?: boolean }
> = {
  "large-order": { color: "yellow", title: "крупная заявка", pulse: true },
  "large-bid-density": { color: "yellow", title: "крупная bid-плотность", pulse: true },
  "large-ask-density": { color: "yellow", title: "крупная ask-плотность", pulse: true },
  "hit-bid": { color: "red", title: "удар по bid" },
  "hit-ask": { color: "green", title: "удар по ask" },
  "level-held": { color: "cyan", title: "уровень удержали" },
  "level-broken": { color: "red", title: "уровень пробили" },
  "volume-replenished": { color: "purple", title: "восстановление объёма" },
  "possible-iceberg": { color: "purple", title: "айсберг", pulse: true },
  "iceberg-refill": { color: "purple", title: "объём восстановился", pulse: true },
  "density-pulled": { color: "red", title: "плотность сняли", pulse: true },
  "mm-grid": { color: "cyan", title: "сетка MM" },
};

export function scenarioAnnotationsToTeaching(annotations: ScenarioAnnotation[]): TeachingAnnotation[] {
  return annotations
    .filter((a) => typeof a.price === "number")
    .map((a) => {
      const meta = SCENARIO_KIND_MAP[a.kind] ?? { color: "cyan" as const, title: a.label };
      return {
        id: `scenario-${a.kind}-${a.price}`,
        type: "price-level" as const,
        price: a.price!,
        title: meta.title,
        description: a.label,
        color: meta.color,
        pulse: meta.pulse,
      };
    });
}

export function mergeTeachingAnnotations(
  manual: TeachingAnnotation[],
  scenario: ScenarioAnnotation[],
): TeachingAnnotation[] {
  const fromScenario = scenarioAnnotationsToTeaching(scenario);
  const ids = new Set(fromScenario.map((a) => a.id));
  const manualFiltered = manual.filter((a) => !ids.has(a.id));
  return [...fromScenario, ...manualFiltered].slice(-12);
}
