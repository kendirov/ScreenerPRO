import { cn } from "@/lib/utils/cn";

/** True glass — lab surfaces with neon edge definition */
export const auraGlass =
  "relative isolate overflow-hidden rounded-3xl bg-lab-surface-glass/70 backdrop-blur-2xl ring-1 ring-[var(--lab-border)] shadow-[0_0_40px_rgba(1,3,10,0.55)]";

/** @deprecated alias — use auraGlass */
export const glassCard = auraGlass;

export const auraGlassHover =
  "transition-transform duration-300 ease-out hover:scale-[1.02] hover:bg-lab-surface/60 hover:ring-[var(--lab-border-hot)]";

/** @deprecated alias */
export const glassCardHover = auraGlassHover;

/** Section chrome — lighter than interactive cells */
export const sectionShell = "relative rounded-3xl bg-lab-surface/30 px-1 py-3 sm:px-2";

export const commandHeaderShell = cn(
  "lab-glass-panel rounded-xl",
);

export const labPanelStrong = "lab-glass-panel";

/** Radial glow intensity scales with |%| — stronger green/red on large moves */
export function performanceAura(percentChange: number | null): string {
  const p = percentChange ?? 0;
  const abs = Math.abs(p);

  if (p > 0) {
    if (abs >= 6) {
      return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-lab-green/20 via-lab-bg-deep/20 to-transparent";
    }
    if (abs >= 3) {
      return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-lab-green/14 via-lab-bg-deep/15 to-transparent";
    }
    return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-lab-green/10 via-transparent to-transparent";
  }
  if (p < 0) {
    if (abs >= 6) {
      return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-lab-red/22 via-lab-bg-deep/22 to-transparent";
    }
    if (abs >= 3) {
      return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-lab-red/16 via-lab-bg-deep/18 to-transparent";
    }
    return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-lab-red/10 via-transparent to-transparent";
  }
  return "bg-[radial-gradient(ellipse_90%_70%_at_top_right,_var(--tw-gradient-stops))] from-lab-blue/8 via-transparent to-transparent";
}

export const heroTickerClass =
  "lab-ticker bg-gradient-to-br from-lab-text-main via-lab-text-main/92 to-lab-text-muted/55 bg-clip-text text-6xl text-transparent sm:text-7xl";

export function percentClass(value: number | null): string {
  if ((value ?? 0) > 0) return "text-lab-green";
  if ((value ?? 0) < 0) return "text-lab-red";
  return "text-lab-text-muted";
}

export function rowHeatClass(row: { percentChange: number | null; metrics: { dayRangePct: number | null } }, isAnomaly?: boolean): string {
  if (isAnomaly) return "ring-1 ring-lab-amber/35";
  if ((row.percentChange ?? 0) > 0) return "ring-1 ring-lab-green/25";
  if ((row.percentChange ?? 0) < 0) return "ring-1 ring-lab-red/25";
  return "ring-1 ring-lab-blue/15";
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
    ? cn(auraGlassHover, "hover:shadow-[var(--lab-glow-green)]")
    : cn(auraGlassHover, "hover:shadow-[var(--lab-glow-violet)]");
}

export const auraTag =
  "lab-chip rounded-full bg-lab-surface-3/80 px-2.5 py-0.5 text-[10px] uppercase tracking-wide";

export const auraPill =
  "lab-chip inline-flex items-center gap-1.5 rounded-full bg-lab-surface-2/80 px-2.5 py-0.5 text-[11px] backdrop-blur-xl";
