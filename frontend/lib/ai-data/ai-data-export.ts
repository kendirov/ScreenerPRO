import type { ScreenerApiResponse, ScreenerRow } from "@screenerpro/shared";
import { computeInstrumentSituation } from "@/lib/screener/situation-engine";
import { computeMarketPriority } from "@/lib/screener/market-priority-engine";
import type { AiDataExport, AiDataOptions, AiDataStock } from "@/lib/ai-data/contracts";

const finite = (v: number | null | undefined) => v != null && Number.isFinite(v) ? v : null;
const compact = (v: unknown) => v == null ? "null" : typeof v === "number" ? Number(v.toFixed(4)) : String(v);

function rangePosition(row: ScreenerRow): number | null {
  if (row.lastPrice == null || row.high == null || row.low == null || row.high <= row.low) return null;
  return (row.lastPrice - row.low) / (row.high - row.low);
}

function liquidity(row: ScreenerRow): AiDataStock["liquidityClass"] {
  if (row.turnover == null || row.tradesCount == null) return "unknown";
  if (row.turnover >= 150_000_000 && row.tradesCount >= 5_000) return "liquid";
  if (row.turnover >= 25_000_000 && row.tradesCount >= 800) return "standard";
  return "thin";
}

function selectRows(rows: ScreenerRow[], options: AiDataOptions, buckets: Map<string, AiDataStock["marketPriorityBucket"]>) {
  if (options.universe === "selected") return rows.filter((r) => options.tickers.includes(r.ticker));
  if (options.universe === "liquid") return rows.filter((r) => liquidity(r) === "liquid");
  if (options.universe === "in-play") return rows.filter((r) => buckets.get(r.ticker) === "in-play" || buckets.get(r.ticker) === "focus");
  if (options.universe === "money") return [...rows].sort((a,b) => (b.turnover ?? 0) - (a.turnover ?? 0)).slice(0, 30);
  if (options.universe === "shots") return [...rows].sort((a,b) => Math.abs(b.percentChange ?? 0) - Math.abs(a.percentChange ?? 0)).slice(0, 30);
  return rows;
}

export function buildAiDataExport(response: ScreenerApiResponse, options: AiDataOptions): AiDataExport {
  const rows = response.rows.filter((row) => row.assetClass === "stock");
  const priority = computeMarketPriority<ScreenerRow>(rows, { maxLiquidity: 10, maxVolatility: 8 });
  const bucket = new Map<string, AiDataStock["marketPriorityBucket"]>();
  priority.inPlayLeaders.forEach((x, i) => bucket.set(x.secid, i < 3 ? "focus" : "in-play"));
  priority.all.forEach((x) => {
    if (x.bucket === "volatility") bucket.set(x.secid, "active");
    if (x.bucket === "excluded") bucket.set(x.secid, "risk");
  });
  const selected = selectRows(rows, options, bucket).sort((a, b) => a.ticker.localeCompare(b.ticker, "en"));
  const stocks: AiDataStock[] = selected.map((row) => {
    const pos = rangePosition(row); const b = bucket.get(row.ticker) ?? "other";
    const situation = computeInstrumentSituation(row, { maxTurnover: Math.max(...rows.map((x) => x.turnover ?? 0)) });
    return {
      ticker: row.ticker, shortName: row.shortName, lastPrice: finite(row.lastPrice), percentChangeDay: finite(row.percentChange),
      dayRangePct: finite(row.metrics.dayRangePct), rangePosition: pos, distanceFromHighPct: row.lastPrice && row.high ? ((row.high-row.lastPrice)/row.lastPrice)*100 : null,
      distanceFromLowPct: row.lastPrice && row.low ? ((row.lastPrice-row.low)/row.lastPrice)*100 : null, currentTurnoverRub: finite(row.turnover),
      volumeRatioNow: finite(row.metrics.volumeRatioNow), tradesRatioNow: finite(row.metrics.tradesRatioNow), liquidityClass: liquidity(row), spreadPct: null,
      marketPriorityBucket: b, inPlay: b === "focus" || b === "in-play", focus: b === "focus", active: b === "active", risk: b === "risk",
      situation: situation.primaryTag, baselineKind: row.metrics.intradayBaselineKind ?? null, baselineReliable: row.metrics.baselineIsReliable ?? null,
      dataQuality: "live-only", stale: Boolean(response.status.staleCache), missingIntervals: null,
      return5m:null, return15m:null, return30m:null, return60m:null, turnover5mRub:null, turnover15mRub:null, turnover60mRub:null,
      trades5m:null, trades15m:null, trades60m:null, turnoverAcceleration:null, priceAcceleration:null, relativeStrengthVsIMOEX5m:null,
      relativeStrengthVsIMOEX30m:null, relativeStrengthVsIMOEX60m:null, trendEfficiency:null, chopScore:null, max5mMove:null,
      pullbackFromImpulse:null, openingRangeState:null, technicalityScore:null,
    };
  });
  const shortlist = [...stocks].sort((a,b) => {
    const sa = Math.abs(a.percentChangeDay ?? 0) * 12 + Math.min((a.volumeRatioNow ?? 0) * 9, 30) + Math.log10((a.currentTurnoverRub ?? 0) + 1);
    const sb = Math.abs(b.percentChangeDay ?? 0) * 12 + Math.min((b.volumeRatioNow ?? 0) * 9, 30) + Math.log10((b.currentTurnoverRub ?? 0) + 1); return sb-sa;
  }).slice(0, options.shortlist).map((s) => ({ ticker:s.ticker, score:Number((Math.abs(s.percentChangeDay ?? 0) * 12 + Math.min((s.volumeRatioNow ?? 0) * 9,30)).toFixed(2)), reason:`день ${compact(s.percentChangeDay)}% · Vol x ${compact(s.volumeRatioNow)} · оборот ${compact(s.currentTurnoverRub)}` }));
  const market = { imoex: response.benchmarks.find((x) => x.code === "IMOEX") ?? null, sourceTimestamp: response.status.sourceTimestamp, marketStatus: response.status.marketStatus };
  const json = JSON.stringify({ market, stocks, shortlist, quality: { source: response.status.source, stale: response.status.staleCache ?? false } }, null, 2);
  const jsonl = stocks.map((s) => JSON.stringify(s)).join("\n");
  const csvHeaders = Object.keys(stocks[0] ?? { ticker: "" });
  const csv = [csvHeaders.join(","), ...stocks.map((s) => csvHeaders.map((k) => JSON.stringify(s[k as keyof AiDataStock] ?? "")).join(","))].join("\n");
  const schema = "d=день%, rng=диапазон%, pos=позиция 0..1, vx=Vol x same-time, tx=Trades x same-time; null = источник не дал значения.";
  const lines = stocks.map((s) => `${s.ticker}|d=${compact(s.percentChangeDay)}|rng=${compact(s.dayRangePct)}|pos=${compact(s.rangePosition)}|vx=${compact(s.volumeRatioNow)}|tx=${compact(s.tradesRatioNow)}|turn=${compact(s.currentTurnoverRub)}|bucket=${s.marketPriorityBucket}|setup=${compact(s.situation)}|q=${s.dataQuality}`);
  const aiText = `TASK\nАнализируй только эти данные MOEX. Раздели факты, гипотезы и сценарии; не путай доходность с подтверждённым импульсом. Учитывай ликвидность, Vol x, сделки, диапазон и позицию. Выдели пампы, падения, активные без направления, техничные движения, тонкие прострелы и ложные сигналы. Для каждого: факты, риск, условие продолжения и отмены. Не давай инвестиционных рекомендаций.\n\nMARKET_CONTEXT\n${JSON.stringify(market)}\n\nSCHEMA\n${schema}\n\nSTOCKS\n${lines.join("\n")}\n\nDEEP_SHORTLIST\n${shortlist.map((x) => `${x.ticker}|${x.reason}`).join("\n")}\n\nDATA_QUALITY\nlive snapshot; 5m/исторические интервалы в v1 не сохранены, поэтому все такие поля null, а не нули. source=${response.status.source}; stale=${Boolean(response.status.staleCache)}; coverage=${stocks.length}/${rows.length}.`;
  return { generatedAt: new Date().toISOString(), source: response.status.source, stale: Boolean(response.status.staleCache), options, market, stocks, shortlist, quality:{ covered:stocks.length, partial:0, missingHistory:stocks.length, notes:["v1 — live snapshot. Durable 5m history не подключена; отсутствующие интервалы не имитируются."] }, formats:{ aiText, jsonl, json, csv } };
}
