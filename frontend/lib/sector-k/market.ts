import type { ScreenerRow } from "@screenerpro/shared";

export type SectorKDisposition = "in-play" | "focus" | "watch";

function compactPercentile(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `топ ${Math.max(1, Math.round(100 - value))}% рынка`;
}

export function getSectorKDisposition(row: ScreenerRow): SectorKDisposition {
  if (row.metrics.isInPlay) return "in-play";
  const score = row.metrics.inPlayScore ?? 0;
  const activity = Math.max(row.metrics.turnoverPercentile ?? 0, row.metrics.tradesPercentile ?? 0);
  if (score >= 70 || activity >= 82 || Math.abs(row.percentChange ?? 0) >= 2) return "focus";
  return "watch";
}

export function getSectorKReasons(row: ScreenerRow, limit = 4): string[] {
  const reasons: string[] = [];
  const turnover = compactPercentile(row.metrics.turnoverPercentile);
  const trades = compactPercentile(row.metrics.tradesPercentile);
  const change = row.percentChange;
  const range = row.metrics.dayRangePct;

  if (row.metrics.isInPlay) reasons.push("isInPlay = true");
  if (!row.metrics.baselineIsReliable) reasons.push("same-time baseline не подтверждён");
  if (turnover && (row.metrics.turnoverPercentile ?? 0) >= 75) reasons.push(`оборот — ${turnover}`);
  if (trades && (row.metrics.tradesPercentile ?? 0) >= 75) reasons.push(`сделки — ${trades}`);
  if (change != null && Math.abs(change) >= 1.2) {
    reasons.push(`движение ${change > 0 ? "+" : ""}${change.toFixed(1)}%`);
  }
  if (range != null && range >= 2.2) reasons.push(`диапазон ${range.toFixed(1)}%`);
  if (!reasons.length) reasons.push("isInPlay = false");
  return reasons.slice(0, limit);
}

export function selectSectorKFocusRows(rows: ScreenerRow[], limit = 8): ScreenerRow[] {
  return [...rows]
    .filter((row) => row.assetClass === "stock" && (row.turnover ?? 0) > 0)
    .sort((a, b) => {
      const dispositionDiff = dispositionWeight(getSectorKDisposition(b)) - dispositionWeight(getSectorKDisposition(a));
      if (dispositionDiff !== 0) return dispositionDiff;
      const scoreDiff = (b.metrics.inPlayScore ?? 0) - (a.metrics.inPlayScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.turnover ?? 0) - (a.turnover ?? 0);
    })
    .slice(0, limit);
}

function dispositionWeight(value: SectorKDisposition): number {
  if (value === "in-play") return 3;
  if (value === "focus") return 2;
  return 1;
}

export function getSectorKMarketBreadth(rows: ScreenerRow[]): {
  advancing: number;
  declining: number;
  unchanged: number;
  breadthPct: number | null;
} {
  const observed = rows.filter((row) => row.assetClass === "stock" && row.percentChange != null);
  const advancing = observed.filter((row) => (row.percentChange ?? 0) > 0.05).length;
  const declining = observed.filter((row) => (row.percentChange ?? 0) < -0.05).length;
  const unchanged = Math.max(0, observed.length - advancing - declining);
  const breadthPct = observed.length ? ((advancing - declining) / observed.length) * 100 : null;
  return { advancing, declining, unchanged, breadthPct };
}

export function formatSectorKTurnover(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} млрд`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} млн`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)} тыс`;
  return Math.round(value).toLocaleString("ru-RU");
}

export function formatSectorKPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const digits = Math.abs(value) < 10 ? 3 : Math.abs(value) < 100 ? 2 : 1;
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

export function formatSectorKPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatSectorKFutureSignal(value: string): string {
  if (value.includes("Перекат")) return "Перекат";
  if (value.includes("ОИ растет")) return "ОИ ↑";
  if (value.includes("ОИ падает")) return "ОИ ↓";
  if (value.includes("Кривая")) return "Кривая";
  if (value.includes("Базис")) return "Carry";
  if (value.includes("фронте")) return "Фронт";
  return value;
}
