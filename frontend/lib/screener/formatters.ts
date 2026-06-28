/** Форматирование чисел для stocks cockpit — единый RU-стиль. */

export function formatRubTurnover(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} млрд ₽`;
  }
  if (abs >= 1_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value / 1_000_000)} млн ₽`;
  }
  if (abs >= 1_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value / 1_000)} тыс ₽`;
  }
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ₽`;
}

export function formatRubTurnoverShort(value: number | null | undefined): string {
  return formatRubTurnover(value);
}

export function formatTrades(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000)} млн`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

export function formatTradesLabel(value: number | null | undefined): string {
  const base = formatTrades(value);
  return base === "—" ? base : `${base} сделок`;
}

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(digits).replace(".", ",")}%`;
}

export function formatIndex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value);
}

export function formatRangePct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

export function formatRangeParen(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "(—)";
  return `(${value.toFixed(2).replace(".", ",")}%)`;
}

export function formatDayPositionLabel(positionPct: number | null | undefined): {
  edge: string;
  compact: string;
} {
  if (positionPct == null || !Number.isFinite(positionPct)) {
    return { edge: "—", compact: "—" };
  }
  const pct = Math.round(positionPct * 100);
  if (pct >= 85) {
    return { edge: "у верхней границы", compact: `У верхней границы · ${pct}%` };
  }
  if (pct <= 15) {
    return { edge: "у нижней границы", compact: `У нижней границы · ${pct}%` };
  }
  return { edge: "внутри диапазона", compact: `Внутри диапазона · ${pct}%` };
}

export function formatTurnoverCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    const n = value / 1_000_000_000;
    const label = n >= 10 ? String(Math.round(n)) : n.toFixed(1);
    return `${label}B`;
  }
  if (abs >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M`;
  }
  if (abs >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

export function formatPositionPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

