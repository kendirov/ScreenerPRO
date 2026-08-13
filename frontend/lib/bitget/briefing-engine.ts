import type { BitgetScreenerRow } from "@/lib/bitget/types";
import type { BitgetBriefingResponse, BriefingDisposition, BriefingRow, BriefingSituation } from "@/lib/bitget/briefing-types";

type BriefingSourceStatus = Pick<BitgetBriefingResponse["status"], "source" | "asOf" | "latencyMs" | "warnings"> & { categoriesLoaded?: unknown };

const MAX_IN_PLAY = 10;

function finite(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function percentile(values: number[], value: number | null): number {
  if (value == null || !values.length) return 0;
  if (values.length === 1) return 1;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = sorted.findIndex((item) => item >= value);
  return Math.max(0, (index < 0 ? sorted.length - 1 : index) / (sorted.length - 1));
}

function situation(row: BitgetScreenerRow): BriefingSituation {
  const move = Math.abs(row.change24hPct ?? 0);
  const range = row.range24hPct ?? 0;
  const turnover = row.turnover24h ?? 0;
  if (move >= 8 && (row.change24hPct ?? 0) > 0) return "PUMP";
  if (move >= 8 && (row.change24hPct ?? 0) < 0) return "DUMP";
  if (turnover > 0 && move >= 4) return "VOLUME_EXPLOSION";
  if (range >= 8) return "VOL_EXPANSION";
  if (move >= 2 || range >= 4) return "WAKE_UP";
  if (move <= 0.75 && range <= 2) return "QUIET";
  return "WATCH_ONLY";
}

function executionQuality(row: BitgetScreenerRow): number {
  if (row.status.toLowerCase() !== "online" || row.lastPrice == null) return 0;
  const spread = finite(row.spreadBps);
  if (spread == null) return 45;
  if (spread <= 5) return 100;
  if (spread <= 15) return 82;
  if (spread <= 40) return 58;
  if (spread <= 100) return 30;
  return 10;
}

function reasons(row: BitgetScreenerRow, attention: number, execution: number, state: BriefingSituation): string[] {
  const result: string[] = [];
  const move = row.change24hPct;
  const range = row.range24hPct;
  if (move != null && Math.abs(move) >= 2) result.push(`движение ${move > 0 ? "+" : ""}${move.toFixed(1)}%`);
  if (range != null && range >= 4) result.push(`ход ${range.toFixed(1)}%`);
  if (row.turnover24h != null) result.push("оборот доступен");
  if (row.fundingRatePct != null && Math.abs(row.fundingRatePct) >= 0.03) result.push(`фандинг ${row.fundingRatePct.toFixed(3)}%`);
  if (execution >= 82) result.push("исполнение приемлемое");
  if (execution < 45) result.push("исполнение слабое");
  if (state === "QUIET") result.push("нет подтверждённой активности");
  if (attention >= 70 && execution < 45) result.push("только наблюдение");
  return result.slice(0, 4);
}

export function buildBitgetBriefing(rows: BitgetScreenerRow[], source: BriefingSourceStatus, startedAt = Date.now()): BitgetBriefingResponse {
  const online = rows.filter((row) => row.status.toLowerCase() === "online");
  const turnoverValues = online.map((row) => row.turnover24h).filter((value): value is number => value != null && value > 0);
  const moveValues = online.map((row) => Math.abs(row.change24hPct ?? 0));
  const rangeValues = online.map((row) => row.range24hPct).filter((value): value is number => value != null && value >= 0);

  const result: BriefingRow[] = online.map((row) => {
    const turnoverRank = percentile(turnoverValues, row.turnover24h);
    const moveRank = percentile(moveValues, Math.abs(row.change24hPct ?? 0));
    const rangeRank = percentile(rangeValues, row.range24hPct);
    const attention = Math.round(100 * (moveRank * 0.4 + turnoverRank * 0.35 + rangeRank * 0.25));
    const execution = executionQuality(row);
    const state = situation(row);
    const disposition: BriefingDisposition = state === "QUIET" ? "QUIET" : attention >= 65 && execution >= 55 ? "IN_PLAY" : "WATCH_ONLY";
    const item: BriefingRow = { row, attention, executionQuality: execution, situationQuality: Math.round((attention + (state === "QUIET" ? 20 : 80)) / 2), situation: state, disposition, reasons: reasons(row, attention, execution, state), quality: "BASELINE_MISSING", baseline: "MISSING" };
    return item;
  }).sort((a, b) => b.attention - a.attention || b.executionQuality - a.executionQuality);

  const topInPlay = result.filter((item) => item.disposition === "IN_PLAY").slice(0, MAX_IN_PLAY);
  const inPlayIds = new Set(topInPlay.map((item) => item.row.id));
  const watchOnly = result.filter((item) => item.disposition === "WATCH_ONLY" && !inPlayIds.has(item.row.id)).slice(0, MAX_IN_PLAY);
  return {
    generatedAt: new Date().toISOString(),
    marketMode: "BITGET_EXECUTION",
    rows: result,
    topInPlay,
    watchOnly,
    status: { ...source, latencyMs: Date.now() - startedAt, quality: "BASELINE_MISSING", baseline: "MISSING", warnings: [...source.warnings, "Baseline 4–8 недель ещё не подключён: относительная активность временно является 24h proxy."] },
  };
}
