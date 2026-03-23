function formatDynamicPrice(value: number | null): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  const digits = abs < 1 ? 5 : abs < 10 ? 4 : abs < 1000 ? 2 : abs < 100_000 ? 1 : 0;
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value);
}

function formatSignedPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

function formatInteger(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

function formatTurnoverRub(value: number | null): string {
  if (value === null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} млрд ₽`;
  }
  if (abs >= 1_000_000) {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value / 1_000_000)} млн ₽`;
  }
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ₽`;
}

export const tradingFormat = {
  formatDynamicPrice,
  formatSignedPercent,
  formatInteger,
  formatTurnoverRub,
};
