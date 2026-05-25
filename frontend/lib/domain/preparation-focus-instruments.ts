import type { PreparationCandlesResponse, ResolvedPreparationInstrument } from "@/lib/domain/preparation-watchlist";
import { findCandleSeries } from "@/lib/domain/preparation-watchlist";

const FOCUS_PIPELINE_IDS = new Set([
  "cur-cnyrub",
  "cur-si-front",
  "com-br-front",
  "com-gold",
  "idx-imoex",
  "bc-sber",
  "bc-gazp",
  "bc-lkoh",
  "bc-vtbr",
]);

function focusScore(
  item: ResolvedPreparationInstrument,
  candlesResponse: PreparationCandlesResponse | undefined,
): number {
  let score = 0;

  if (FOCUS_PIPELINE_IDS.has(item.id)) score += 120;
  if (item.group === "inplay" || item.screenerRow?.metrics.isInPlay) score += 90;

  const series = candlesResponse
    ? findCandleSeries(candlesResponse.series, item)
    : null;
  if (series?.status === "ok" && series.candles.length >= 2) score += 50;

  const row = item.screenerRow;
  if (row?.turnover && row.turnover > 0) {
    score += Math.min(35, Math.log10(row.turnover + 1) * 4);
  }
  if (row?.tradesCount && row.tradesCount > 0) score += 15;
  if (item.priority === "core") score += 10;

  return score;
}

export function selectFocusInstruments(
  watchlist: ResolvedPreparationInstrument[],
  candlesResponse: PreparationCandlesResponse | undefined,
  limit = 6,
): ResolvedPreparationInstrument[] {
  const moexItems = watchlist.filter(
    (item) => item.market === "moex-stock" || item.market === "moex-future",
  );

  const ranked = moexItems
    .map((item) => ({ item, score: focusScore(item, candlesResponse) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const result: ResolvedPreparationInstrument[] = [];

  for (const { item } of ranked) {
    const key = item.resolvedSecid ?? item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}

export function selectInPlayInstruments(
  watchlist: ResolvedPreparationInstrument[],
  limit = 6,
): ResolvedPreparationInstrument[] {
  return watchlist
    .filter((item) => item.group === "inplay" || item.screenerRow?.metrics.isInPlay)
    .slice(0, limit);
}
