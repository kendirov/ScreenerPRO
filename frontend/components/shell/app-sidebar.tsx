"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  DRAFT_BADGE_LABELS,
  sidebarDraftsNav,
  sidebarMainNavGroups,
  type DraftNavBadge,
  type SidebarNavItem,
} from "@/lib/constants/navigation";
import { isDraftNavVisible, isDevLabLinkVisible } from "@/lib/constants/nav-visibility";
import { cn } from "@/lib/utils/cn";

const SIDEBAR_PINNED_KEY = "screenerpro.sidebar.pinned";

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/screener") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DraftBadge({
  badge,
  compact,
}: {
  badge: DraftNavBadge;
  compact?: boolean;
}) {
  const chipClass = {
    lab: "lab-chip-lab",
    draft: "lab-chip-draft",
    soon: "lab-chip-soon",
    wip: "lab-chip-dev",
  }[badge];

  return (
    <span
      className={cn(
        "lab-status-chip shrink-0 font-mono uppercase tracking-wide",
        chipClass,
        compact ? "px-0.5 py-px text-[6px]" : "px-1 py-px text-[6px] leading-none",
        badge === "wip" && !compact && "text-[5.5px] leading-tight",
      )}
      title={DRAFT_BADGE_LABELS[badge]}
    >
      {compact ? DRAFT_BADGE_LABELS[badge].slice(0, 1) : DRAFT_BADGE_LABELS[badge]}
    </span>
  );
}

function SidebarNavLink({
  item,
  pathname,
  isExpanded,
  variant = "main",
}: {
  item: SidebarNavItem;
  pathname: string;
  isExpanded: boolean;
  variant?: "main" | "draft";
}) {
  const isDraft = variant === "draft";
  const isDisabled = item.disabled === true;
  const isActive = !isDisabled && isNavItemActive(pathname, item.href);
  const badge = item.draftBadge;

  const rowClass = cn(
    "group relative flex w-full items-center rounded-md border border-transparent transition-all duration-200",
    isDraft
      ? isExpanded
        ? "gap-1.5 px-1.5 py-1 text-[12px]"
        : "justify-center px-1 py-1.5"
      : isExpanded
        ? "gap-2 px-2 py-1.5 text-[13px]"
        : "justify-center px-1.5 py-2",
    isDisabled
      ? "cursor-not-allowed opacity-45"
      : isDraft
        ? isActive
          ? "border-lab-violet/35 bg-lab-violet/10 text-lab-violet shadow-[var(--lab-glow-violet)]"
          : "text-lab-muted hover:border-lab-amber/25 hover:bg-lab-amber/6 hover:text-lab-amber/95"
        : isActive
          ? "border-lab-border-hot bg-lab-surface-2/90 text-lab-text shadow-[inset_0_0_0_1px_rgba(34,211,238,0.12),var(--lab-glow-cyan)]"
          : "text-lab-muted hover:border-lab-border hover:bg-lab-surface-1/70 hover:text-lab-text",
  );

  const content = (
    <>
      <span
        className={cn(
          "absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-transparent transition-all duration-200",
          isActive && !isDraft && "bg-lab-cyan shadow-[var(--lab-glow-cyan)]",
          isActive && isDraft && "bg-lab-violet shadow-[var(--lab-glow-violet)]",
          !isActive && !isDisabled && isDraft && "group-hover:bg-lab-amber/40",
          !isActive && !isDisabled && !isDraft && "group-hover:bg-lab-border",
        )}
      />
      <item.icon
        className={cn(
          "shrink-0 transition-colors duration-200",
          isDraft ? (isExpanded ? "h-3 w-3" : "h-3.5 w-3.5") : isExpanded ? "h-3.5 w-3.5" : "h-4 w-4",
          isDisabled
            ? "text-lab-dim"
            : isActive && isDraft
              ? "text-lab-violet"
              : isActive
                ? "text-lab-cyan"
                : isDraft
                  ? "text-lab-dim group-hover:text-lab-amber/85"
                  : "text-lab-dim group-hover:text-lab-muted",
        )}
      />
      {isExpanded ? (
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <span className="truncate">{item.label}</span>
          {isDraft && badge ? <DraftBadge badge={badge} /> : null}
        </span>
      ) : isDraft && badge ? (
        <span className="absolute -right-0.5 -top-0.5">
          <DraftBadge badge={badge} compact />
        </span>
      ) : null}
    </>
  );

  if (isDisabled) {
    return (
      <span
        className={rowClass}
        aria-disabled="true"
        title={`${item.label} — ${DRAFT_BADGE_LABELS[badge ?? "soon"]}`}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      title={!isExpanded ? item.label : undefined}
      className={rowClass}
      aria-current={isActive ? "page" : undefined}
    >
      {content}
    </Link>
  );
}

function SidebarNavGroup({
  title,
  items,
  pathname,
  isExpanded,
  showDivider,
  variant = "main",
}: {
  title: string;
  items: SidebarNavItem[];
  pathname: string;
  isExpanded: boolean;
  showDivider: boolean;
  variant?: "main" | "draft";
}) {
  const visible = items.filter((i) => i.visibility === "visible");
  if (visible.length === 0) return null;

  const isDraft = variant === "draft";

  return (
    <div
      className={cn(
        showDivider && (isDraft ? "border-t border-lab-border-amber/25 pt-2" : "border-t border-lab-border pt-2"),
        isDraft && "rounded-lg border border-lab-border-violet/20 bg-lab-surface-hot/35 px-1 py-1.5 backdrop-blur-sm",
      )}
    >
      <p
        className={cn(
          "mb-1 px-1.5 font-medium uppercase tracking-[0.16em] transition-all duration-200",
          isDraft ? "text-[8px] text-lab-amber/80" : "text-[9px] text-lab-dim",
          isExpanded ? "opacity-100" : "pointer-events-none h-0 overflow-hidden opacity-0",
        )}
      >
        {title}
      </p>
      {!isExpanded && showDivider ? (
        <div
          className={cn("mx-2 mb-1.5 border-t", isDraft ? "border-lab-amber/20" : "border-lab-border")}
          aria-hidden
        />
      ) : null}
      <div className="space-y-0.5">
        {visible.map((item) => (
          <SidebarNavLink
            key={item.href}
            item={item}
            pathname={pathname}
            isExpanded={isExpanded}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_PINNED_KEY) === "1";
  });

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SIDEBAR_PINNED_KEY, isExpanded ? "1" : "0");
  }, [isExpanded, hydrated]);

  if (!hydrated) {
    return (
      <aside className="hidden w-[68px] shrink-0 border-r border-lab-border bg-lab-surface/90 lab-depth-10 backdrop-blur-2xl lg:flex lg:flex-col" />
    );
  }

  return (
    <aside
      className={cn(
        "relative hidden h-screen shrink-0 border-r border-lab-border bg-lab-surface/88 lab-depth-10 backdrop-blur-2xl transition-[width,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:sticky lg:top-0 lg:flex lg:flex-col",
        isExpanded ? "w-[220px] px-2.5 py-2.5" : "w-[68px] px-1.5 py-2.5",
      )}
    >
      <div className={cn("mb-2 shrink-0 px-1", isExpanded ? "" : "flex justify-center")}>
        <Link
          href="/screener"
          className={cn(
            "block rounded-md border border-transparent px-1.5 py-1 transition-colors duration-200 hover:border-lab-border hover:bg-lab-surface-1/60",
            !isExpanded && "text-center",
          )}
        >
          {isExpanded ? (
            <span className="text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-lab-text">
              Лаборатория рынка
            </span>
          ) : (
            <span className="text-[11px] font-bold tracking-wider text-lab-cyan">ЛР</span>
          )}
        </Link>
        {!isExpanded ? (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="absolute left-1/2 top-[3.25rem] -translate-x-1/2 rounded-md border border-lab-border bg-lab-surface-1/80 p-1 text-lab-dim transition-all duration-200 hover:border-lab-border-hot hover:text-lab-text"
            aria-label="Развернуть меню"
            title="Развернуть меню"
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-lab-border">
        {sidebarMainNavGroups.map((group, index) => (
          <SidebarNavGroup
            key={group.id}
            title={group.title}
            items={group.items}
            pathname={pathname}
            isExpanded={isExpanded}
            showDivider={index > 0}
            variant="main"
          />
        ))}
      </nav>

      <div className="ui-mode-hide-focus mt-1.5 shrink-0 border-t border-lab-border-violet/20 pt-1.5">
        {isDevLabLinkVisible() ? (
          <Link
            href="/lab"
            className={cn(
              "mb-1 flex w-full items-center rounded-md border border-dashed border-lab-border-violet/30 px-2 py-1.5 text-[10px] text-lab-dim transition hover:border-lab-violet/40 hover:text-lab-violet",
              isExpanded ? "justify-start gap-1.5" : "justify-center",
            )}
            title="Каталог экспериментальных lab-страниц (только dev)"
          >
            <span className="font-mono uppercase tracking-wide">{isExpanded ? "Черновики /lab" : "LAB"}</span>
          </Link>
        ) : null}
        {isDraftNavVisible() ? (
          <SidebarNavGroup
            title={sidebarDraftsNav.title}
            items={sidebarDraftsNav.items}
            pathname={pathname}
            isExpanded={isExpanded}
            showDivider={false}
            variant="draft"
          />
        ) : null}
      </div>

      {isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="mt-2 shrink-0 self-end rounded-md border border-transparent p-1.5 text-lab-dim transition-colors duration-200 hover:border-lab-border hover:bg-lab-surface-1/60 hover:text-lab-text"
          aria-label="Свернуть меню"
          title="Свернуть меню"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </aside>
  );
}
