/** Цветовой язык метрик для stocks cockpit — карточки, данные рынка, таблица. */

export const metricColors = {
  changePositive: "text-emerald-400",
  changeNegative: "text-rose-400",
  changeMuted: "text-slate-400/70",
  range: "text-cyan-400/55",
  trades: "text-indigo-300/60",
  turnover: "text-amber-300/65",
  muted: "text-slate-400/60",
  shown: "text-cyan-300/70",
  ticker: "text-slate-100",
  breadthUp: "text-emerald-400/90",
  breadthDown: "text-rose-400/90",
  breadthFlat: "text-slate-400/70",
} as const;

export function metricChangeClass(changePct: number | null | undefined): string {
  if (changePct == null || !Number.isFinite(changePct)) return metricColors.changeMuted;
  if (changePct > 0) return metricColors.changePositive;
  if (changePct < 0) return metricColors.changeNegative;
  return metricColors.changeMuted;
}
