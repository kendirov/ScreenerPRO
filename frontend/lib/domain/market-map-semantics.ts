import type { MarketLabNode } from "@/lib/domain/market-lab";
import { formatMoneyShortTurnover, formatSignedPct } from "@/lib/domain/market-lab";

export type SemanticZoneId = "money-growth" | "money-pressure" | "thin-rally" | "weak-no-money";

export const SEMANTIC_ZONE_META: Record<
  SemanticZoneId,
  { title: string; subtitle: string; leaderReason: string }
> = {
  "money-growth": {
    title: "Деньги + рост",
    subtitle: "объём подтверждает движение вверх",
    leaderReason: "объём подтверждает рост",
  },
  "money-pressure": {
    title: "Деньги + давление",
    subtitle: "много оборота на снижении",
    leaderReason: "оборот на падении",
  },
  "thin-rally": {
    title: "Тонкий разгон",
    subtitle: "рост есть, денег мало",
    leaderReason: "рост без крупного оборота",
  },
  "weak-no-money": {
    title: "Слабость без денег",
    subtitle: "слабое движение без подтверждения",
    leaderReason: "слабое движение без объёма",
  },
};

export const MAP_READING_PILLS = [
  { id: "x", text: "Правее = больше денег / активности" },
  { id: "y-up", text: "Выше = сильнее рост" },
  { id: "y-down", text: "Ниже = давление" },
  { id: "size", text: "Размер = сделки / оборот" },
  { id: "color", text: "Цвет = изменение" },
] as const;

export const BUBBLE_MAP_LEGEND =
  "размер = оборот, цвет = Δ%, ближе к центру = ликвидность";

export type NodePlacement = {
  xPercentile: number;
  yPercentile: number | null;
  yValue: number;
};

export function classifySemanticZone(placement: NodePlacement): SemanticZoneId {
  const { xPercentile, yValue } = placement;
  const highX = xPercentile >= 50;
  const up = yValue > 0.08;
  const down = yValue < -0.08;

  if (highX && up) return "money-growth";
  if (highX && down) return "money-pressure";
  if (!highX && up) return "thin-rally";
  return "weak-no-money";
}

export function getZoneLabel(zoneId: SemanticZoneId): string {
  return SEMANTIC_ZONE_META[zoneId].title;
}

function zoneScore(node: MarketLabNode, zoneId: SemanticZoneId, placement: NodePlacement): number {
  const { xPercentile, yValue } = placement;
  const turnover = node.turnoverRub;
  const change = node.changePct;

  switch (zoneId) {
    case "money-growth":
      if (xPercentile < 45 || change <= 0) return -1;
      return turnover * Math.max(change, 0.1);
    case "money-pressure":
      if (xPercentile < 45 || change >= 0) return -1;
      return turnover * Math.abs(Math.min(change, -0.1));
    case "thin-rally":
      if (xPercentile >= 55 || change <= 0) return -1;
      return change * (100 - xPercentile);
    case "weak-no-money":
      if (xPercentile >= 55 || Math.abs(change) > 1.2) return -1;
      return (100 - xPercentile) * (2 - Math.abs(change));
    default:
      return -1;
  }
}

export type ZoneLeader = {
  zoneId: SemanticZoneId;
  node: MarketLabNode | null;
  reason: string;
};

export function pickZoneLeaders(
  nodes: MarketLabNode[],
  placements: Map<string, NodePlacement>,
): ZoneLeader[] {
  const zoneIds: SemanticZoneId[] = ["money-growth", "money-pressure", "thin-rally", "weak-no-money"];

  return zoneIds.map((zoneId) => {
    let best: MarketLabNode | null = null;
    let bestScore = -1;

    for (const node of nodes) {
      const placement = placements.get(node.ticker);
      if (!placement) continue;
      if (classifySemanticZone(placement) !== zoneId) continue;
      const score = zoneScore(node, zoneId, placement);
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }

    return {
      zoneId,
      node: best,
      reason: best ? SEMANTIC_ZONE_META[zoneId].leaderReason : "",
    };
  });
}

export function formatZoneLeaderLine(leader: ZoneLeader): string {
  if (!leader.node) return "нет явного лидера";
  const n = leader.node;
  return `${n.ticker} · ${formatSignedPct(n.changePct)} · ${formatMoneyShortTurnover(n.turnoverRub)} · ${leader.reason}`;
}

/** Правила «почему здесь» — только по метрикам, без ИИ. */
export function explainWhyHere(node: MarketLabNode, placement: NodePlacement): string {
  const { xPercentile, yValue } = placement;
  const change = node.changePct;
  const turnover = node.turnoverRub;
  const trades = node.tradesCount;
  const range = node.rangePct ?? 0;
  const impulse = node.moveWeightRub;

  if (xPercentile >= 65 && change > 0.15 && change < 2.2) {
    return "Высокий оборот, умеренный рост";
  }
  if (xPercentile >= 60 && change <= -1) {
    return "Сильное падение на заметном объёме";
  }
  if (xPercentile < 42 && change > 0.45) {
    return "Рост без крупного оборота";
  }
  if (Math.abs(change) < 0.35 && xPercentile >= 62) {
    return "Около нуля, но активность высокая";
  }
  if (xPercentile >= 70 && change >= 2.2) {
    return "Крупный оборот на сильном росте";
  }
  if (xPercentile >= 70 && change <= -2) {
    return "Крупный оборот усиливает падение";
  }
  if (xPercentile < 38 && change < -0.5) {
    return "Слабое давление без подтверждения объёмом";
  }
  if (xPercentile < 40 && Math.abs(change) < 0.4) {
    return "Тихо: мало денег и слабое движение";
  }
  if (impulse > 0 && turnover > 0 && xPercentile >= 55 && yValue > 0) {
    return "Денежный импульс в плюс на фоне оборота";
  }
  if (impulse < 0 && xPercentile >= 55) {
    return "Отрицательный импульс при заметном обороте";
  }
  if (range >= 3 && trades > 0 && xPercentile >= 50) {
    return "Широкий ход при активной торговле";
  }
  if (range >= 2.5 && xPercentile < 45) {
    return "Ход есть, но оборот ниже медианы";
  }

  const zoneId = classifySemanticZone(placement);
  return SEMANTIC_ZONE_META[zoneId].subtitle;
}

/** Объяснение для режима «Пузырьки» (центр = ликвидность). */
export function explainBubbleWhyHere(
  node: MarketLabNode,
  ctx: { liquidityNorm: number; maxTurnover: number },
): string {
  const change = node.changePct;
  const nearCenter = ctx.liquidityNorm >= 0.62;
  const farFromCenter = ctx.liquidityNorm <= 0.32;

  if (nearCenter && change > 0.5) {
    return "Ликвидный якорь с ростом у центра";
  }
  if (nearCenter && change < -0.5) {
    return "Ликвидный якорь под давлением";
  }
  if (farFromCenter && change > 0.6) {
    return "Рост на периферии — оборот ниже ядра";
  }
  if (farFromCenter && change < -0.6) {
    return "Падение без опоры крупного оборота";
  }
  if (node.turnoverRub >= ctx.maxTurnover * 0.35) {
    return "Крупный оборот задаёт размер пузыря";
  }
  return explainWhyHere(node, {
    xPercentile: (1 - ctx.liquidityNorm) * 100,
    yPercentile: null,
    yValue: change,
  });
}
