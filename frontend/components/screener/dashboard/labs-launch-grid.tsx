"use client";

import Link from "next/link";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  DRAFT_BADGE_LABELS,
  sidebarDraftsNav,
  type DraftNavBadge,
} from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

const FEATURED_LAB_HREFS = [
  "/lab/preparation",
  "/lab/weekly-inflation",
  "/lab/market-map",
  "/lab/currency-correlation",
  "/lab/orderflow-simulator",
] as const;

const DRAFT_CHIP: Record<DraftNavBadge, string> = {
  lab: "lab-chip-lab",
  draft: "lab-chip-draft",
  soon: "lab-chip-soon",
  wip: "lab-chip-dev",
};

const SHORT_DESC: Record<string, string> = {
  "/lab/preparation": "Премаркет-пульт перед эфиром",
  "/lab/weekly-inflation": "Недельная инфляция и режим для ставки",
  "/lab/market-map": "Карта акций MOEX — пузырьки и сигналы",
  "/lab/currency-correlation": "Si · CNY · ED — расхождения и недели",
  "/lab/orderflow-simulator": "Учебный привод и стакан",
};

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
  const description = SHORT_DESC[href] ?? "Экспериментальная lab-страница";
  const chipClass = DRAFT_CHIP[badge];

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight text-lab-text">{label}</h3>
        <span className={cn("lab-status-chip shrink-0 text-[7px]", chipClass)}>
          {DRAFT_BADGE_LABELS[badge]}
        </span>
      </div>
      <p className="lab-type-caption mt-1.5 flex-1 text-[10px] leading-snug">{description}</p>
      {!disabled ? (
        <span className="mt-2 inline-block text-[9px] font-medium uppercase tracking-wider text-lab-cyan">
          Открыть →
        </span>
      ) : (
        <span className="mt-2 inline-block text-[9px] uppercase tracking-wider text-lab-dim">Скоро</span>
      )}
    </>
  );

  if (disabled) {
    return (
      <div
        className="rounded-xl border border-lab-border/40 bg-lab-surface-soft/50 p-2.5 opacity-50"
        title={`${label} — ${DRAFT_BADGE_LABELS[badge]}`}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-lab-border/40 bg-lab-surface-soft/40 p-2.5 transition-colors duration-200 hover:border-lab-violet/30 hover:bg-lab-violet/6 hover:shadow-[var(--lab-glow-violet)]"
    >
      {inner}
    </Link>
  );
}

export function LabsLaunchGrid() {
  const items = sidebarDraftsNav.items.filter(
    (item) => item.visibility === "visible" && FEATURED_LAB_HREFS.includes(item.href as (typeof FEATURED_LAB_HREFS)[number]),
  );

  const ordered = FEATURED_LAB_HREFS.map(
    (href) => items.find((item) => item.href === href)!,
  ).filter(Boolean);

  return (
    <LabGlassPanel depth={10} className="relative overflow-hidden p-3">
      <div className="lab-accent-line absolute inset-x-0 top-0 opacity-40" aria-hidden />
      <p className="lab-type-caption mb-2.5 text-[10px] leading-relaxed">
        Быстрый вход в lab-черновики. Готовые инструменты позже переедут в материалы.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ordered.map((item) => (
          <DraftQuickCard
            key={item.href}
            href={item.href}
            label={item.label}
            badge={item.draftBadge ?? "draft"}
            disabled={item.disabled}
          />
        ))}
      </div>
    </LabGlassPanel>
  );
}
