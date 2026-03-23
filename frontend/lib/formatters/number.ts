const compactFmt = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 2,
});

const priceFmt = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

export function formatPrice(value: number) {
  return priceFmt.format(value);
}

export function formatCompact(value: number) {
  return compactFmt.format(value);
}

export function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
