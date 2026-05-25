"use client";

import Link from "next/link";
import { MaterialsShowcaseMotif } from "@/components/materials/materials-showcase-motif";
import {
  isShowcaseItemOpenable,
  resolveShowcaseStatusLabel,
  resolveShowcaseTypeLabel,
  type MaterialsShowcaseItem,
} from "@/lib/materials/showcase-catalog";
import { cn } from "@/lib/utils/cn";

const TYPE_STYLES: Record<string, { chip: string; glow: string; gradient: string }> = {
  лаборатория: {
    chip: "lab-status-chip lab-chip-lab",
    glow: "hover:shadow-[var(--lab-glow-violet)]",
    gradient:
      "bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(139,92,246,0.18),transparent_65%)]",
  },
  справочник: {
    chip: "lab-status-chip lab-chip-moex",
    glow: "hover:shadow-[var(--lab-glow-cyan)]",
    gradient:
      "bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(34,211,238,0.14),transparent_65%)]",
  },
  тренажёр: {
    chip: "lab-status-chip lab-chip-draft",
    glow: "hover:shadow-[var(--lab-glow-amber)]",
    gradient:
      "bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(245,158,11,0.12),transparent_65%)]",
  },
  идея: {
    chip: "lab-status-chip lab-chip-dev",
    glow: "",
    gradient: "bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(59,130,246,0.06),transparent_65%)]",
  },
};

const STATUS_STYLES: Record<string, string> = {
  ГОТОВО: "lab-status-chip lab-chip-live",
  ЧЕРНОВИК: "lab-status-chip lab-chip-draft",
  "В РАЗРАБОТКЕ": "lab-status-chip lab-chip-dev",
  ИДЕЯ: "lab-status-chip lab-chip-dev",
  СКОРО: "lab-status-chip lab-chip-soon",
};

export function MaterialsShowcaseCard({
  item,
  variant = "default",
}: {
  item: MaterialsShowcaseItem;
  variant?: "default" | "draft" | "idea";
}) {
  const typeLabel = resolveShowcaseTypeLabel(item);
  const statusLabel = resolveShowcaseStatusLabel(item.status);
  const styles = TYPE_STYLES[typeLabel] ?? TYPE_STYLES.справочник;
  const openable = isShowcaseItemOpenable(item);
  const isIdea = item.section === "ideas" || item.status === "idea";

  const shell = cn(
    "lab-glass-card relative flex min-h-[12.5rem] flex-col overflow-hidden p-4 shadow-none transition-all duration-200 sm:min-h-[13.5rem] sm:p-5",
    openable && styles.glow,
    openable && "hover:-translate-y-0.5 hover:border-lab-border-hot",
    variant === "draft" && "border-lab-border-violet/30 bg-lab-surface-hot/20",
    variant === "idea" && "border-lab-border/60 opacity-80",
    !openable && "cursor-default",
  );

  const inner = (
    <>
      <div className={cn("pointer-events-none absolute inset-0 -z-20", styles.gradient)} aria-hidden />
      <MaterialsShowcaseMotif motif={item.motif} className="-z-10 opacity-45" />
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-px opacity-70",
          item.status === "ready"
            ? "bg-gradient-to-r from-transparent via-lab-cyan/60 to-lab-green/40"
            : variant === "draft" || item.draftNotice
              ? "bg-gradient-to-r from-transparent via-lab-violet/50 to-lab-amber/40"
              : "bg-gradient-to-r from-transparent via-lab-blue/30 to-transparent",
        )}
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className={cn("lab-status-chip text-[9px] capitalize", styles.chip)}>{typeLabel}</span>
          <span className={cn("lab-status-chip text-[9px]", STATUS_STYLES[statusLabel])}>{statusLabel}</span>
        </div>

        <h3 className="mt-3 text-lg font-semibold leading-tight tracking-tight text-lab-text sm:text-xl">
          {item.title}
        </h3>

        <p className="lab-type-caption mt-2 flex-1 text-xs leading-relaxed sm:text-[13px]">{item.description}</p>

        {item.draftNotice ? (
          <p className="mt-2 rounded-md border border-lab-amber/25 bg-lab-amber/8 px-2 py-1.5 text-[10px] leading-snug text-lab-amber/95">
            Черновик. Страница может меняться.
          </p>
        ) : null}

        <div className="mt-4">
          {!openable ? (
            <span className="lab-btn-secondary inline-flex items-center rounded-lg px-3 py-2 text-xs font-medium text-lab-dim">
              Скоро
            </span>
          ) : (
            <span className="inline-flex items-center rounded-lg border border-lab-border-hot bg-lab-cyan/10 px-3 py-2 text-xs font-semibold text-lab-cyan transition group-hover:border-lab-cyan/45 group-hover:bg-lab-cyan/15">
              Открыть →
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (!openable || !item.href) {
    return (
      <article className={shell} title={isIdea ? `${item.title} — идея на очереди` : item.title}>
        {inner}
      </article>
    );
  }

  return (
    <Link href={item.href} className={cn(shell, "group")}>
      {inner}
    </Link>
  );
}
