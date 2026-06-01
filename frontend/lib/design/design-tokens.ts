import type { ScreenerRow } from "@screenerpro/shared";
import { getStockTableStatus, isStockInPlay } from "@/lib/domain/stock-screener-display";

/** Семантические режимы сигнала для поверхности скринера. */
export type SignalMode = "impulse" | "pressure" | "in-play" | "neutral";

export const SIGNAL_MODE_LABEL: Record<SignalMode, string> = {
  impulse: "импульс",
  pressure: "давление",
  "in-play": "в игре",
  neutral: "нейтрально",
};

export const SIGNAL_MODE_SURFACE: Record<
  SignalMode,
  { ring: string; glow: string; badge: string; accent: string }
> = {
  impulse: {
    ring: "ring-emerald-500/25",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_28px_rgba(16,185,129,0.08)]",
    badge: "border-emerald-500/30 bg-emerald-950/35 text-emerald-200/95",
    accent: "from-emerald-500/14 via-transparent to-transparent",
  },
  pressure: {
    ring: "ring-rose-500/25",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_28px_rgba(244,63,94,0.08)]",
    badge: "border-rose-500/30 bg-rose-950/35 text-rose-200/95",
    accent: "from-rose-500/14 via-transparent to-transparent",
  },
  "in-play": {
    ring: "ring-cyan-500/28",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_28px_rgba(34,211,238,0.08)]",
    badge: "border-cyan-500/30 bg-cyan-950/35 text-cyan-200/95",
    accent: "from-cyan-500/12 via-transparent to-transparent",
  },
  neutral: {
    ring: "ring-white/8",
    glow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_28px_rgba(2,6,23,0.35)]",
    badge: "border-white/10 bg-slate-900/50 text-slate-300/90",
    accent: "from-slate-500/8 via-transparent to-transparent",
  },
};

export function resolveSignalMode(row: ScreenerRow, maxTurnover: number): SignalMode {
  if (isStockInPlay(row)) return "in-play";
  const status = getStockTableStatus(row, maxTurnover);
  if (status === "Импульс" || status === "Тонкий разгон") return "impulse";
  if (status === "Давление") return "pressure";
  return "neutral";
}

/** Нормализованный score 0–100 для карточек и радара. */
export function resolveActivityScore(row: ScreenerRow): number {
  const raw = row.metrics.inPlayScore;
  if (raw != null && Number.isFinite(raw)) {
    return Math.round(Math.min(100, Math.max(0, raw)));
  }

  const blend =
    ((row.metrics.turnoverPercentile ?? 0) +
      (row.metrics.tradesPercentile ?? 0) +
      (row.metrics.rangePercentile ?? 0)) /
      3 +
    Math.min(24, Math.abs(row.percentChange ?? 0) * 6);

  return Math.round(Math.min(100, Math.max(0, blend)));
}

export type UiViewMode = "normal" | "focus" | "presentation";

export const UI_VIEW_MODE_LABEL: Record<UiViewMode, string> = {
  normal: "Обычный",
  focus: "Фокус",
  presentation: "Презентация",
};
