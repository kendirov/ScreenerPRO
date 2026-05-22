import type { ScreenerRow } from "@screenerpro/shared";

export type FutureActivityLabel = "Активный" | "Ликвидный" | "Движение" | "Тихо";

export const futureActivityBadgeClass: Record<FutureActivityLabel, string> = {
  Активный: "border-cyan-800/35 bg-cyan-950/25 text-cyan-200/85",
  Ликвидный: "border-emerald-800/35 bg-emerald-950/25 text-emerald-200/85",
  Движение: "border-amber-800/35 bg-amber-950/25 text-amber-200/85",
  Тихо: "border-slate-800/60 bg-slate-950/45 text-slate-500/85",
};

export function getFutureActivityLabel(
  row: ScreenerRow,
  ctx: { maxTurnover: number; maxTrades: number },
): FutureActivityLabel {
  const turnover = row.turnover ?? 0;
  const trades = row.tradesCount ?? 0;
  const range = Math.abs(row.metrics.dayRangePct ?? 0);
  const change = Math.abs(row.percentChange ?? 0);
  const turnoverShare = ctx.maxTurnover > 0 ? turnover / ctx.maxTurnover : 0;
  const tradesShare = ctx.maxTrades > 0 ? trades / ctx.maxTrades : 0;

  if (range >= 1.8 || change >= 1.2) return "Движение";
  if (turnoverShare >= 0.12 || tradesShare >= 0.12) return "Ликвидный";
  if (turnoverShare >= 0.04 || trades >= 500) return "Активный";
  return "Тихо";
}
