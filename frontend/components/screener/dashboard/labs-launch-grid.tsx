"use client";

import Link from "next/link";
import {
  DRAFT_BADGE_LABELS,
  labCatalogItems,
  sidebarDraftsNav,
  type DraftNavBadge,
} from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

const DRAFT_CHIP: Record<DraftNavBadge, string> = {
  lab: "lab-chip-lab",
  draft: "lab-chip-draft",
  soon: "lab-chip-soon",
  wip: "lab-chip-dev",
};

function resolveDescription(href: string, label: string): string {
  const slug = href.replace(/^\/lab\//, "");
  const catalog = labCatalogItems.find((item) => item.slug === slug || item.href === href);
  if (catalog?.description) {
    return catalog.description.length > 72 ? `${catalog.description.slice(0, 70)}…` : catalog.description;
  }
  return `Экспериментальная страница — ${label.toLowerCase()}.`;
}

function DraftQuickCard({
  href,
  label,
  badge,
  disabled,
}: {
  href: string;
  label: string;
  badge: DraftNavBadge;
  disabled?: boolean;
}) {
  const description = resolveDescription(href, label);
  const chipClass = DRAFT_CHIP[badge];

  const shell = cn(
    "lab-glass-card group relative block min-h-[7.5rem] overflow-hidden p-3 shadow-none transition-all duration-200",
    "border-lab-border-violet/25 bg-lab-surface-hot/25 hover:border-lab-border-amber/35",
    disabled && "pointer-events-none cursor-not-allowed opacity-50",
  );

  const inner = (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lab-violet/45 to-lab-amber/35 opacity-80"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_70%_at_100%_0%,rgba(139,92,246,0.1),transparent_65%)]"
        aria-hidden
      />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight text-lab-text">{label}</h3>
          <span className={cn("lab-status-chip shrink-0 text-[7px]", chipClass)}>
            {DRAFT_BADGE_LABELS[badge]}
          </span>
        </div>
        <p className="lab-type-caption mt-2 flex-1 text-[11px] leading-snug">{description}</p>
        {!disabled ? (
          <span className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-lab-cyan transition group-hover:text-lab-cyan/90">
            Открыть →
          </span>
        ) : (
          <span className="mt-2 inline-block text-[10px] uppercase tracking-wider text-lab-dim">Скоро</span>
        )}
      </div>
    </>
  );

  if (disabled) {
    return (
      <div className={shell} title={`${label} — ${DRAFT_BADGE_LABELS[badge]}`}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className={shell}>
      {inner}
    </Link>
  );
}

export function LabsLaunchGrid() {
  const items = sidebarDraftsNav.items.filter((item) => item.visibility === "visible");

  return (
    <div className="lab-glass-panel relative overflow-hidden border-lab-border-violet/20 p-3 sm:p-4">
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-50" aria-hidden />
      <p className="lab-type-caption mb-3 max-w-2xl text-[11px] leading-relaxed">
        Быстрый вход в экспериментальные lab-страницы. Готовые инструменты позже переедут в материалы.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => (
          <DraftQuickCard
            key={item.href}
            href={item.href}
            label={item.label}
            badge={item.draftBadge ?? "draft"}
            disabled={item.disabled}
          />
        ))}
      </div>
    </div>
  );
}
