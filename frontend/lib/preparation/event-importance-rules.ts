import type {
  PreparationEventImportance,
  PreparationEventImpactTag,
} from "@/lib/preparation/preparation-types";

const HIGH_PATTERNS: RegExp[] = [
  /\b(ключев(ая|ой)\s+ставк|rate decision|fomc|fed funds|решение\s+цб|банк\s+россии)\b/i,
  /\b(инфляц|cpi|ppi|consumer price|producer price)\b/i,
  /\b(nfp|non.?farm|payroll|employment change|занятост)\b/i,
  /\b(gdp|ввп)\b/i,
  /\b(eia|crude inventories|запасы нефт|oil inventories)\b/i,
  /\b(opec|opec\+)\b/i,
  /\b(pmi|ism manufacturing|ism services)\b/i,
  /\b(ecb|european central|евроцентробанк|лагард)\b/i,
  /\b(фрс|federal reserve|fed chair|powell)\b/i,
  /\b(цб\s+рф|cbr|bank of russia)\b/i,
];

const MEDIUM_TOPIC_PATTERNS: RegExp[] = [
  /\b(ставк|rate|inflation|инфляц|jobs|employment|pmi|gdp|cpi|ppi|oil|нефт|central bank|цб|fed|ecb|opec|eia)\b/i,
  /\b(russia|росси|рф|moex|мосбирж|china|китай|eurozone|еврозон|usa|сша|us\b)\b/i,
];

const IMPACT_FROM_TITLE: Array<{ pattern: RegExp; tags: PreparationEventImpactTag[] }> = [
  { pattern: /\b(ставк|rate|fed|ecb|цб|cbr|fomc)\b/i, tags: ["rates"] },
  { pattern: /\b(rub|руб|fx|forex|dollar|доллар|eur\/usd|usd\/jpy)\b/i, tags: ["FX"] },
  { pattern: /\b(нефт|oil|brent|wti|eia|crude)\b/i, tags: ["oil"] },
  { pattern: /\b(газ|natural gas|gas)\b/i, tags: ["gas"] },
  { pattern: /\b(gold|золот|silver|copper|метал)\b/i, tags: ["metals"] },
  { pattern: /\b(акци|equit|s&p|nasdaq|index|индекс)\b/i, tags: ["equities"] },
  { pattern: /\b(росси|рф|russia|moex|мосбирж)\b/i, tags: ["Russia"] },
  { pattern: /\b(сша|usa|us\b|united states|american)\b/i, tags: ["US"] },
  { pattern: /\b(china|китай|pboc|shanghai)\b/i, tags: ["China"] },
  { pattern: /\b(eurozone|еврозон|euro area|germany|german)\b/i, tags: ["Eurozone"] },
];

export function classifyEventImportance(title: string, country?: string): PreparationEventImportance {
  const haystack = `${title} ${country ?? ""}`;
  if (HIGH_PATTERNS.some((p) => p.test(haystack))) return "high";
  if (MEDIUM_TOPIC_PATTERNS.some((p) => p.test(haystack))) return "medium";
  return "low";
}

export function inferImpactAssets(title: string, country?: string, category?: string): PreparationEventImpactTag[] {
  const tags = new Set<PreparationEventImpactTag>();
  const haystack = `${title} ${country ?? ""} ${category ?? ""}`;

  for (const rule of IMPACT_FROM_TITLE) {
    if (rule.pattern.test(haystack)) rule.tags.forEach((t) => tags.add(t));
  }

  if (!tags.size && category) {
    if (/macro|inflation|rate/i.test(category)) tags.add("rates");
    if (/oil|energy/i.test(category)) tags.add("oil");
  }

  return [...tags];
}

export function shouldShowEvent(event: {
  importance: PreparationEventImportance;
  title: string;
  country?: string;
  assetImpact: PreparationEventImpactTag[];
}): boolean {
  if (event.importance === "high") return true;
  if (event.importance === "low") return false;

  const haystack = `${event.title} ${event.country ?? ""}`;
  if (MEDIUM_TOPIC_PATTERNS.some((p) => p.test(haystack))) return true;

  return event.assetImpact.some((t) =>
    ["rates", "FX", "oil", "gas", "Russia", "US", "China", "Eurozone"].includes(t),
  );
}

export function filterVisibleEvents<T extends {
  importance: PreparationEventImportance;
  title: string;
  country?: string;
  assetImpact: PreparationEventImpactTag[];
}>(events: T[]): T[] {
  return events.filter(shouldShowEvent);
}

export function countEventBuckets<T extends { importance: PreparationEventImportance }>(
  all: T[],
  visible: T[],
): { total: number; high: number; mediumShown: number; lowHidden: number } {
  const high = visible.filter((e) => e.importance === "high").length;
  const mediumShown = visible.filter((e) => e.importance === "medium").length;
  const lowHidden = all.filter((e) => e.importance === "low").length;
  return { total: visible.length, high, mediumShown, lowHidden };
}
