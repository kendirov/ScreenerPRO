import type { ScreenerRow } from "@screenerpro/shared";
import { tradingFormat } from "@/lib/formatters/trading";
import { hasMetricValue } from "@/components/ui/metrics-minimalism";
import type {
  PriorityInstrument,
  PriorityReason,
  PriorityReasonSeverity,
} from "@/lib/screener/market-priority-engine";

export function asScreenerRow(row: unknown): ScreenerRow | null {
  if (row != null && typeof row === "object" && "ticker" in row) {
    return row as ScreenerRow;
  }
  return null;
}

export function stockDetailHref(secid: string): string {
  return `/stocks/${secid}`;
}

const SEVERITY_ORDER: Record<PriorityReasonSeverity, number> = {
  hot: 0,
  attention: 1,
  info: 2,
  risk: 3,
  neutral: 4,
};

const STRONG_SIGNAL_CODES = new Set([
  "activity_shock_confirmed",
  "range_expansion_confirmed",
  "directional_pressure_confirmed",
  "turnover_participation_confirmed",
]);

export function pickTopReasons(reasons: PriorityReason[], max = 2): PriorityReason[] {
  return [...reasons]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .slice(0, max);
}

/** In-play surface: только confirmed strong signals + risk */
export function pickInPlayBadges(reasons: PriorityReason[], riskReasons: PriorityReason[], max = 3): PriorityReason[] {
  const strong = reasons.filter(
    (r) => r.strength === "strong" && STRONG_SIGNAL_CODES.has(r.code),
  );
  const risks = riskReasons.filter((r) => r.severity === "risk" || r.family === "risk");
  return [...strong, ...risks]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    .slice(0, max);
}

export function pickVolatilityRiskReasons(
  riskReasons: PriorityReason[],
  reasons: PriorityReason[],
  max = 2,
): PriorityReason[] {
  const merged = [...riskReasons, ...reasons.filter((r) => r.severity === "risk" || r.family === "risk")];
  const seen = new Set<string>();
  const unique: PriorityReason[] = [];
  for (const r of merged) {
    if (seen.has(r.code)) continue;
    seen.add(r.code);
    unique.push(r);
  }
  return pickTopReasons(unique, max);
}

export function reasonSeverityTone(
  severity: PriorityReasonSeverity,
): "cyan" | "amber" | "rose" | "neutral" | "muted" {
  switch (severity) {
    case "hot":
      return "cyan";
    case "attention":
      return "amber";
    case "risk":
      return "rose";
    case "info":
      return "neutral";
    default:
      return "muted";
  }
}

export type RowSurfaceMetrics = {
  changePct: number | null;
  rangePct: number | null;
  turnover: number | null;
  trades: number | null;
  volX: number | null;
  spreadPct: number | null;
};

function pickSpreadPct(sr: ScreenerRow): number | null {
  const raw = (sr as ScreenerRow & { spreadPct?: number }).spreadPct;
  if (raw != null && Number.isFinite(raw)) return raw;
  const metricsSpread = (sr.metrics as { spreadPct?: number }).spreadPct;
  if (metricsSpread != null && Number.isFinite(metricsSpread)) return metricsSpread;
  return null;
}

export function extractRowSurfaceMetrics(row: unknown): RowSurfaceMetrics {
  const sr = asScreenerRow(row);
  if (!sr) {
    return {
      changePct: null,
      rangePct: null,
      turnover: null,
      trades: null,
      volX: null,
      spreadPct: null,
    };
  }
  const volX = sr.metrics.volumeRatioNow ?? sr.metrics.tradesRatioNow ?? null;
  return {
    changePct: sr.percentChange,
    rangePct: sr.metrics.dayRangePct,
    turnover: sr.turnover,
    trades: sr.tradesCount ?? null,
    volX: volX != null && Number.isFinite(volX) ? volX : null,
    spreadPct: pickSpreadPct(sr),
  };
}

export function formatChangePct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return tradingFormat.formatSignedPercent(value);
}

export function formatRangePct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return tradingFormat.formatDayRangeMagnitude(value);
}

export function formatTurnover(value: number | null): string {
  if (!hasMetricValue(value)) return "—";
  return tradingFormat.formatTurnoverRub(value);
}

export function formatTradesShort(value: number | null): string {
  if (!hasMetricValue(value)) return "—";
  if (value! >= 1000) return `${Math.round(value! / 1000)}k сд.`;
  return `${Math.round(value!)} сд.`;
}

export function formatSpreadPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

function whyPartFromReason(r: PriorityReason): string | null {
  if (r.code === "activity_shock_confirmed") {
    if (r.value != null) return `Vol ${r.value}`;
    return "Vol x↑";
  }
  if (r.code === "range_expansion_confirmed") {
    if (r.value != null) return `Range ${r.value}`;
    return "Range ↑";
  }
  if (r.code === "directional_pressure_confirmed") {
    if (r.label.includes("high")) return "у high";
    if (r.label.includes("low")) return "у low";
    return r.label;
  }
  if (r.code === "turnover_participation_confirmed") {
    return "участие";
  }
  return null;
}

/** Одна строка «почему в игре» из confirmed strong reasons */
export function buildInPlayWhyLine(reasons: PriorityReason[]): string {
  const parts = reasons
    .filter((r) => r.strength === "strong")
    .map(whyPartFromReason)
    .filter((p): p is string => p != null);
  return parts.slice(0, 3).join(" · ");
}

/** Вторая метрическая строка: change · turnover · spread */
export function buildInPlayMetricsLine(metrics: RowSurfaceMetrics): string {
  const parts: string[] = [];
  const ch = formatChangePct(metrics.changePct);
  if (ch !== "—") parts.push(ch);
  const val = formatTurnover(metrics.turnover);
  if (val !== "—") parts.push(val);
  if (metrics.spreadPct != null && Number.isFinite(metrics.spreadPct)) {
    parts.push(`spread ${formatSpreadPct(metrics.spreadPct)}`);
  }
  return parts.join(" · ");
}

/** Поверхность in-play: ровно 3 числа — change, range, value */
export function buildInPlaySurfaceLine(metrics: RowSurfaceMetrics): string {
  const parts: string[] = [];
  const ch = formatChangePct(metrics.changePct);
  const rng = formatRangePct(metrics.rangePct);
  const val = formatTurnover(metrics.turnover);
  if (ch !== "—") parts.push(ch);
  if (rng !== "—") parts.push(rng);
  if (val !== "—") parts.push(val);
  return parts.slice(0, 3).join(" · ");
}

/** Tooltip: score, why, все причины */
export function buildInPlayTooltipLines(
  instrument: PriorityInstrument,
  metrics: RowSurfaceMetrics,
): string[] {
  const lines: string[] = [];
  if (instrument.shortName) lines.push(instrument.shortName);
  lines.push(`score ${formatScore(instrument.inPlayScore)}`);
  const why = buildInPlayWhyLine(instrument.reasons);
  if (why) lines.push(why);
  if (metrics.volX != null) lines.push(`Vol x ${metrics.volX.toFixed(1)}`);
  if (metrics.spreadPct != null) lines.push(`spread ${formatSpreadPct(metrics.spreadPct)}`);
  const extra = [...instrument.reasons, ...instrument.riskReasons]
    .filter((r) => r.strength === "strong" || r.severity === "risk")
    .map((r) => formatReasonChipLabel(r));
  if (extra.length > 0) lines.push(extra.join(" · "));
  return lines;
}

export function formatReasonChipShort(r: PriorityReason): string {
  if (r.code === "activity_shock_confirmed" && r.value != null) return String(r.value);
  if (r.code === "range_expansion_confirmed" && r.value != null) return String(r.value);
  if (r.code === "directional_pressure_confirmed") {
    if (r.label.includes("high")) return "high";
    if (r.label.includes("low")) return "low";
  }
  if (r.code === "low_trades") return "мало сд.";
  if (r.code === "low_value") return "тонко";
  if (r.code === "wide_spread") return "спред";
  if (r.code === "thin_move") return "прострел";
  return formatReasonChipLabel(r).split(" ")[0] ?? r.label;
}

export function formatReasonChipLabel(r: PriorityReason): string {
  if (r.value != null && r.value !== "") {
    if (r.code === "activity_shock_confirmed") return `Vol ${r.value}`;
    if (r.code === "range_expansion_confirmed") return `Range ${r.value}`;
    return `${r.label} ${r.value}`;
  }
  return r.label;
}

export function firstInPlayLeaderHref(leaders: PriorityInstrument[]): string | null {
  const top = leaders[0];
  if (!top) return null;
  return stockDetailHref(top.secid);
}
