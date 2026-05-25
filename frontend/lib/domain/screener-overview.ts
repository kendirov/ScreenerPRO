import type { ScreenerDataSource, ScreenerRow } from "@screenerpro/shared";
import { buildFuturesFamilies } from "@/lib/domain/futures-family";
import { isStockInPlay, parseInPlayReasonTags } from "@/lib/domain/stock-screener-display";
import { tradingFormat } from "@/lib/formatters/trading";

const REASON_TAG_LABEL: Record<string, string> = {
  оборот: "объём",
  сделки: "сделки",
  диапазон: "диапазон",
  импульс: "импульс",
};

export function formatReasonTagsForCard(row: ScreenerRow): string[] {
  return parseInPlayReasonTags(row).map((tag) => REASON_TAG_LABEL[tag] ?? tag);
}

const FOCUS_REASON_LABEL: Record<string, string> = {
  оборот: "оборот",
  сделки: "сделки",
  диапазон: "диапазон",
  импульс: "движение",
};

/** Теги для блока «Почему в фокусе» — только из существующих полей. */
export function formatFocusReasonTags(row: ScreenerRow): string[] {
  return parseInPlayReasonTags(row).map((tag) => FOCUS_REASON_LABEL[tag] ?? tag).slice(0, 4);
}

export function selectInPlayStocks(rows: ScreenerRow[], limit = 4): ScreenerRow[] {
  return [...rows]
    .filter((row) => row.assetClass === "stock" && isStockInPlay(row))
    .sort((a, b) => (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0))
    .slice(0, limit);
}

/** Самый сильный акционный сигнал «в игре» для hero-блока. */
export function selectPrimaryInPlayStock(rows: ScreenerRow[]): ScreenerRow | null {
  return selectInPlayStocks(rows, 1)[0] ?? null;
}

export function selectTopFutures(rows: ScreenerRow[], limit = 4): ScreenerRow[] {
  return [...rows]
    .filter((row) => row.assetClass === "future")
    .sort((a, b) => {
      const turnoverDiff = (b.turnover ?? 0) - (a.turnover ?? 0);
      if (turnoverDiff !== 0) return turnoverDiff;
      return (b.tradesCount ?? 0) - (a.tradesCount ?? 0);
    })
    .slice(0, limit);
}

export function selectStrongMovement(rows: ScreenerRow[], limit = 8): ScreenerRow[] {
  return [...rows]
    .sort((a, b) => {
      const rangeDiff = Math.abs(b.metrics.dayRangePct ?? 0) - Math.abs(a.metrics.dayRangePct ?? 0);
      if (rangeDiff !== 0) return rangeDiff;
      return Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0);
    })
    .slice(0, limit);
}

function anomalyScore(row: ScreenerRow): number {
  let score = Math.abs(row.metrics.dayRangePct ?? 0) * 2.5 + Math.abs(row.percentChange ?? 0) * 1.5;
  if ((row.metrics.inPlayTags ?? []).includes("IN_PLAY")) score += 18;
  if (Math.abs(row.percentChange ?? 0) >= 2.5) score += 12;
  if ((row.metrics.turnoverPercentile ?? 0) >= 85) score += 6;
  if ((row.metrics.tradesPercentile ?? 0) >= 85) score += 6;
  return score;
}

/** Лента аномалий — топ по комбинированному скору движения и активности. */
export function selectAnomalyRail(
  rows: ScreenerRow[],
  options?: { limit?: number; excludeTickers?: string[] },
): ScreenerRow[] {
  const limit = options?.limit ?? 7;
  const exclude = new Set((options?.excludeTickers ?? []).map((t) => t.toUpperCase()));
  return [...rows]
    .filter((row) => !exclude.has(row.ticker.toUpperCase()))
    .sort((a, b) => anomalyScore(b) - anomalyScore(a))
    .slice(0, limit);
}

const ANOMALY_REASON_LABEL: Record<string, string> = {
  оборот: "оборот",
  сделки: "сделки",
  диапазон: "движение",
  импульс: "движение",
};

/** Причина для ленты аномалий. */
export function formatAnomalyReason(row: ScreenerRow): string {
  if (Math.abs(row.percentChange ?? 0) >= 2.5 || Math.abs(row.metrics.dayRangePct ?? 0) >= 4) {
    return "аномалия";
  }
  const tags = parseInPlayReasonTags(row);
  if (tags.length) return ANOMALY_REASON_LABEL[tags[0]!] ?? tags[0]!;
  return row.metrics.reasonLabel?.split("+")[0]?.trim().toLowerCase() ?? "активность";
}

export function isRowAnomaly(row: ScreenerRow): boolean {
  return Math.abs(row.percentChange ?? 0) >= 2.5 || Math.abs(row.metrics.dayRangePct ?? 0) >= 4;
}

export function buildFuturesBaseMap(rows: ScreenerRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const family of buildFuturesFamilies(rows)) {
    for (const contract of family.contracts) {
      map.set(contract.ticker, family.familyLabel);
    }
  }
  return map;
}

/** Сегмент рынка для фьючерса по базовому активу / тикеру. */
export function inferFutureMarketSegment(baseLabel: string, ticker?: string): string | null {
  const hay = `${baseLabel} ${ticker ?? ""}`.toLowerCase();
  if (/brent|нефть|oil|br/i.test(hay)) return "Нефть";
  if (/доллар|юань|валют|si|eu|cn|usd|rub/i.test(hay)) return "Валюта";
  if (/индекс|imoex|rts|mix|mx/i.test(hay)) return "Индекс";
  if (/золот|серебр|металл|gold|silver|gd|sv/i.test(hay)) return "Металл";
  return null;
}

function dominantFutureThemes(topFutures: ScreenerRow[], baseByTicker: Map<string, string>): string[] {
  const labels = topFutures.map((row) => baseByTicker.get(row.ticker) ?? "").filter(Boolean);
  const themes: string[] = [];
  if (labels.some((l) => /brent|нефть|oil/i.test(l))) themes.push("нефти");
  if (labels.some((l) => /доллар|юань|валют|si|eu|cn/i.test(l))) themes.push("валюте");
  if (labels.some((l) => /индекс|imoex|rts|mix/i.test(l))) themes.push("индексах");
  if (labels.some((l) => /золот|серебр|металл/i.test(l))) themes.push("металлах");
  return themes;
}

export interface MarketBriefingCard {
  focusLine: string;
  contextLine: string;
}

export function buildBriefingCard(input: {
  inPlayStocks: ScreenerRow[];
  topFutures: ScreenerRow[];
  baseByTicker: Map<string, string>;
}): MarketBriefingCard {
  const { inPlayStocks, topFutures, baseByTicker } = input;
  const focusTickers = [...new Set([...inPlayStocks.slice(0, 2), ...topFutures.slice(0, 2)].map((r) => r.ticker))];
  const focusLine =
    focusTickers.length > 0 ? `Фокус: ${focusTickers.join(", ")}.` : "Фокус: явных лидеров пока нет.";

  const stockContext =
    inPlayStocks.length >= 3
      ? "несколько лидеров по обороту"
      : inPlayStocks.length > 0
        ? "точечная активность"
        : "спокойный фон";

  const themes = dominantFutureThemes(topFutures, baseByTicker);
  const futuresContext =
    topFutures.length === 0
      ? "без выраженного лидера"
      : themes.length > 0
        ? `оборот в ${themes.join(" и ")}`
        : "распределённый оборот";

  return {
    focusLine,
    contextLine: `Акции: ${stockContext}. Фьючерсы: ${futuresContext}.`,
  };
}

export function buildMarketBrief(input: {
  inPlayStocks: ScreenerRow[];
  topFutures: ScreenerRow[];
  baseByTicker: Map<string, string>;
}): string {
  const { inPlayStocks, topFutures, baseByTicker } = input;
  if (inPlayStocks.length === 0 && topFutures.length === 0) {
    return "Ждём появления явных лидеров по обороту и движению.";
  }

  const focus = [...inPlayStocks.slice(0, 2), ...topFutures.slice(0, 2)].map((r) => r.ticker);
  const uniqueFocus = [...new Set(focus)];
  const focusPart = uniqueFocus.length ? `Фокус: ${uniqueFocus.join(", ")}.` : "";

  const stockPart =
    inPlayStocks.length >= 3
      ? "В акциях несколько лидеров по обороту."
      : inPlayStocks.length > 0
        ? "В акциях активность точечная."
        : "В акциях явных лидеров пока нет.";

  const themes = dominantFutureThemes(topFutures, baseByTicker);
  const futuresPart =
    topFutures.length === 0
      ? "Фьючерсы без выраженного лидера."
      : themes.length > 0
        ? `Во фьючерсах основной оборот в ${themes.join(" и ")}.`
        : "Во фьючерсах оборот распределён по контрактам.";

  const card = buildBriefingCard({ inPlayStocks, topFutures, baseByTicker });
  return [card.focusLine, card.contextLine].filter(Boolean).join(" ");
}

export function formatDataSourceLabel(source: ScreenerDataSource | undefined): string {
  if (source === "moex") return "MOEX ISS";
  return "Резервные данные";
}

export function formatTurnoverCompact(value: number | null): string {
  return tradingFormat.formatTurnoverRub(value).replace(/\s?₽/g, "");
}
