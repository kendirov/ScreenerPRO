"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";
import {
  TOP_LEVEL_AVAILABILITY_LABELS,
  marketContextNav,
  resolveTradingOsSection,
  sidebarMainNavGroups,
} from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

/** Общий контекст Trading OS без имитации auth, уведомлений или live-статуса. */
export function TopBar() {
  const pathname = usePathname();
  const sectionId = resolveTradingOsSection(pathname);
  const section = sidebarMainNavGroups[0].items.find((item) => item.section === sectionId);
  const showMarketContext = sectionId === "today" || sectionId === "market";

  return (
    <LabGlassPanel
      as="header"
      depth={10}
      className="sticky top-0 z-40 rounded-none border-x-0 border-t-0 px-1.5 py-2 sm:px-2.5 lg:px-3"
    >
      <div className="lab-accent-line mb-2 opacity-60" aria-hidden />
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-lab-dim">Trading OS</span>
          <span className="text-lab-border">/</span>
          <span className="truncate text-xs font-medium text-lab-text">{section?.label ?? "Сегодня"}</span>
          {section?.availability && section.availability !== "ready" ? (
            <span className="rounded border border-lab-border px-1 py-px font-mono text-[7px] uppercase tracking-wider text-lab-dim">
              {TOP_LEVEL_AVAILABILITY_LABELS[section.availability]}
            </span>
          ) : null}
        </div>
        {showMarketContext ? (
          <nav aria-label="Контекст рынка" className="flex items-center gap-0.5 overflow-x-auto">
            {marketContextNav.map((item) => {
              const active = item.href === "/screener"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors",
                    active ? "bg-lab-cyan/10 text-lab-cyan" : "text-lab-dim hover:bg-lab-surface-1 hover:text-lab-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-wider text-lab-dim">
            {sectionId === "studio" ? "Presentation OS" : sectionId === "knowledge" ? "База знаний" : "Рабочий контур"}
          </span>
        )}
      </div>
    </LabGlassPanel>
  );
}
