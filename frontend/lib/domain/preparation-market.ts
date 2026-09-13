export type MarketQuality = "LIVE" | "DELAYED" | "CLOSED" | "STALE" | "FALLBACK" | "PROXY" | "ERROR" | "UNKNOWN";

export type AnomalyInput = {
  change1dPct: number | null;
  change5dPct?: number | null;
  volatility?: number | null;
  rangePct?: number | null;
  relativeTurnover?: number | null;
  relativeTrades?: number | null;
  rollRatio?: number | null;
  dte?: number | null;
};

export type AnomalyResult = { priority: number; severity: "normal" | "notable" | "major" | "extreme"; reasons: string[] };

const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;

export function explainAnomaly(input: AnomalyInput): AnomalyResult {
  const reasons: string[] = [];
  const move = Math.abs(input.change1dPct ?? 0);
  const sigma = input.volatility && input.volatility > 0 ? move / input.volatility : 0;
  if (move >= 1.5) reasons.push(`${signed(input.change1dPct ?? 0)} за сессию`);
  if (sigma >= 2) reasons.push(`${sigma.toFixed(1)}σ к собственной волатильности`);
  if ((input.change5dPct != null) && Math.abs(input.change5dPct) >= 3) reasons.push(`${signed(input.change5dPct)} за 5 дней`);
  if ((input.relativeTurnover ?? 0) >= 1.5) reasons.push(`оборот ${(input.relativeTurnover ?? 0).toFixed(1)}× нормы`);
  if ((input.relativeTrades ?? 0) >= 1.5) reasons.push(`сделки ${(input.relativeTrades ?? 0).toFixed(1)}× нормы`);
  if ((input.rangePct ?? 0) >= 2) reasons.push(`диапазон ${(input.rangePct ?? 0).toFixed(1)}%`);
  if ((input.rollRatio ?? 0) >= 0.35) reasons.push(`roll в next ${Math.round((input.rollRatio ?? 0) * 100)}%`);
  if (input.dte != null && input.dte <= 10) reasons.push(`экспирация через ${input.dte} дн.`);
  const priority = move + sigma * 1.4 + Math.max(0, (input.relativeTurnover ?? 1) - 1) * 2 + Math.max(0, (input.rollRatio ?? 0) - .2) * 4;
  const severity = priority >= 8 ? "extreme" : priority >= 5 ? "major" : priority >= 2.5 ? "notable" : "normal";
  return { priority, severity, reasons: reasons.slice(0, 4) };
}

export function qualityFromTimestamp(updatedAt: string, marketOpen: boolean, now = Date.now()): MarketQuality {
  const age = now - new Date(updatedAt).getTime();
  if (!Number.isFinite(age)) return "UNKNOWN";
  if (!marketOpen) return "CLOSED";
  if (age > 30 * 60_000) return "STALE";
  if (age > 2 * 60_000) return "DELAYED";
  return "LIVE";
}
