import { cn } from "@/lib/utils/cn";

/** True glass — no solid borders; ring-only edge definition */
export const auraGlass =
  "relative isolate overflow-hidden rounded-3xl bg-white/[0.02] backdrop-blur-2xl ring-1 ring-white/[0.05] shadow-[0_0_40px_rgba(0,0,0,0.5)]";

/** @deprecated alias — use auraGlass */
export const glassCard = auraGlass;

export const auraGlassHover =
  "transition-transform duration-300 ease-out hover:scale-[1.02] hover:bg-white/[0.04] hover:ring-white/[0.08]";

/** @deprecated alias */
export const glassCardHover = auraGlassHover;

/** Section chrome — lighter than interactive cells */
export const sectionShell = "relative rounded-3xl bg-white/[0.01] px-1 py-3 sm:px-2";

export const commandHeaderShell = cn(
  auraGlass,
  "rounded-2xl bg-white/[0.015] shadow-[0_8px_32px_rgba(2,6,23,0.35)]",
);

/** Radial glow intensity scales with |%| — stronger crimson/emerald on large moves */
export function performanceAura(percentChange: number | null): string {
  const p = percentChange ?? 0;
  const abs = Math.abs(p);

  if (p > 0) {
    if (abs >= 6) {
      return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/[0.18] via-emerald-950/12 to-transparent";
    }
    if (abs >= 3) {
      return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/[0.12] via-emerald-950/10 to-transparent";
    }
    return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/[0.08] via-transparent to-transparent";
  }
  if (p < 0) {
    if (abs >= 6) {
      return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-rose-600/[0.2] via-rose-950/20 to-transparent";
    }
    if (abs >= 3) {
      return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-rose-600/[0.14] via-rose-950/15 to-transparent";
    }
    return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-rose-500/[0.09] via-transparent to-transparent";
  }
  return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-slate-500/[0.05] via-transparent to-transparent";
}

export const heroTickerClass =
  "bg-gradient-to-br from-white via-white/92 to-white/55 bg-clip-text text-6xl font-semibold tracking-[0.14em] text-transparent sm:text-7xl";

export function percentClass(value: number | null): string {
  if ((value ?? 0) > 0) return "text-emerald-300";
  if ((value ?? 0) < 0) return "text-rose-300";
  return "text-slate-400";
}

/** Asymmetric bento — #1 spans 2×2 on md+ when ≥3 tiles */
export function mosaicCellClass(rank: number, total: number): string {
  if (total <= 1) return "col-span-12 min-h-[8.5rem]";
  if (total === 2) return "col-span-12 sm:col-span-6 min-h-[7rem]";
  if (total === 3) {
    if (rank === 0) return "col-span-12 md:col-span-7 md:row-span-2 min-h-[9rem]";
    return "col-span-6 md:col-span-5 min-h-[5.25rem]";
  }
  if (rank === 0) return "col-span-12 md:col-span-6 md:row-span-2 min-h-[9.5rem]";
  if (rank === 1) return "col-span-6 md:col-span-3 min-h-[5.25rem]";
  if (rank === 2) return "col-span-6 md:col-span-3 min-h-[5.25rem]";
  return "col-span-12 md:col-span-6 min-h-[5rem]";
}

export function futureMosaicCellClass(rank: number, total: number): string {
  if (total <= 1) return "col-span-12 min-h-[5.75rem]";
  if (rank === 0) return "col-span-12 sm:col-span-7 md:col-span-7 min-h-[6rem]";
  return "col-span-6 sm:col-span-5 min-h-[5rem]";
}

export function activeGlow(assetClass: "stock" | "future"): string {
  return assetClass === "stock"
    ? cn(auraGlassHover, "hover:shadow-[0_0_40px_rgba(16,185,129,0.06)]")
    : cn(auraGlassHover, "hover:shadow-[0_0_40px_rgba(99,102,241,0.06)]");
}

export const auraTag =
  "rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-white/50";

export const auraPill =
  "inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[11px] ring-1 ring-white/[0.05] backdrop-blur-xl";
