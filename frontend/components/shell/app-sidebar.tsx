"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { labNavConfig, sidebarNav, type SidebarNavItem } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

const SIDEBAR_PINNED_KEY = "screenerpro.sidebar.pinned";

function SidebarLink({
  item,
  pathname,
  isExpanded,
  tone,
}: {
  item: SidebarNavItem;
  pathname: string;
  isExpanded: boolean;
  tone: "main" | "lab";
}) {
  const isScreenerOverview = item.href === "/screener";
  const isActive = isScreenerOverview
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      title={!isExpanded ? item.label : undefined}
      className={cn(
        "group relative flex items-center rounded-lg border border-transparent transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isExpanded ? "gap-3 px-3 text-sm" : "justify-center px-2",
        tone === "lab" ? "py-1.5 text-slate-500" : "py-2 text-slate-400",
        isActive
          ? tone === "lab"
            ? "border-violet-500/15 bg-violet-950/20 text-violet-100/90"
            : "border-white/10 bg-white/[0.03] text-slate-100 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08),0_8px_24px_rgba(2,6,23,0.45)]"
          : tone === "lab"
            ? "hover:border-violet-500/10 hover:bg-violet-950/10 hover:text-violet-100/80"
            : "hover:border-white/10 hover:bg-white/[0.02] hover:text-slate-100",
      )}
    >
      <span
        className={cn(
          "absolute bottom-1.5 left-0 top-1.5 w-px rounded-full bg-transparent transition-all duration-300",
          isActive && tone === "main" && "bg-indigo-500 shadow-[0_0_14px_rgba(99,102,241,0.8)]",
          isActive && tone === "lab" && "bg-violet-500/80 shadow-[0_0_10px_rgba(139,92,246,0.5)]",
          !isActive && "group-hover:bg-white/10",
        )}
      />
      <item.icon
        className={cn(
          "shrink-0 transition-colors duration-200",
          tone === "lab" ? "h-3.5 w-3.5" : "h-4 w-4",
          tone === "lab" ? "text-slate-600 group-hover:text-violet-300/70" : "text-slate-500 group-hover:text-slate-300",
          isActive && tone === "main" && "text-indigo-300",
          isActive && tone === "lab" && "text-violet-300/80",
        )}
      />
      <span
        className={cn(
          "whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isExpanded ? "max-w-[140px] translate-x-0 opacity-100" : "max-w-0 -translate-x-1 overflow-hidden opacity-0",
          tone === "lab" && isExpanded && "text-xs",
        )}
      >
        {item.label}
      </span>
    </Link>
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
      <aside className="hidden w-[80px] shrink-0 border-r border-white/5 bg-slate-950/55 px-2 py-3.5 backdrop-blur-2xl lg:flex lg:flex-col" />
    );
  }

  return (
    <aside
      className={cn(
        "relative hidden shrink-0 border-r py-3.5 transition-[width,padding,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex lg:flex-col",
        isExpanded
          ? "w-60 border-white/5 bg-slate-950/45 px-3.5 backdrop-blur-2xl"
          : "w-[80px] border-white/5 bg-slate-950/60 px-2 backdrop-blur-2xl",
      )}
    >
      <div className={cn("mb-4 flex items-center px-1", isExpanded ? "justify-between" : "justify-center")}>
        <Link
          href="/screener"
          className={cn(
            "rounded-lg border border-transparent px-2 py-1 text-xs font-semibold tracking-[0.2em] text-slate-300 transition-colors duration-200 hover:border-white/10 hover:bg-white/[0.03] hover:text-slate-100",
            !isExpanded && "w-full text-center",
          )}
        >
          {isExpanded ? "SCREENERPRO" : "SP"}
        </Link>
        {isExpanded ? null : (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="absolute left-1/2 top-14 -translate-x-1/2 rounded-lg border border-white/10 bg-black/45 p-1.5 text-slate-500 transition-all duration-200 hover:border-white/15 hover:text-slate-200"
            aria-label="Развернуть меню"
            title="Развернуть меню"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>
      <p
        className={cn(
          "mb-2.5 px-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isExpanded ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        Рабочие разделы
      </p>
      <nav className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-1">
          {sidebarNav.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} isExpanded={isExpanded} tone="main" />
          ))}
        </div>
        <div
          className={cn(
            "mt-auto border-t border-white/[0.04] pt-3 transition-opacity duration-300",
            isExpanded ? "opacity-100" : "opacity-90",
          )}
        >
          <div
            className={cn(
              "mb-2 flex items-center gap-2 px-2 transition-all duration-300",
              isExpanded ? "justify-between" : "justify-center",
            )}
          >
            {isExpanded ? (
              <>
                <p className="text-[9px] uppercase tracking-[0.18em] text-slate-600">Черновики</p>
                <span className="rounded border border-violet-500/20 bg-violet-950/30 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-violet-300/70">
                  LAB
                </span>
              </>
            ) : (
              <span
                className="rounded border border-violet-500/15 bg-violet-950/25 px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-violet-300/60"
                title="Черновики"
              >
                LAB
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            {labNavConfig.map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} isExpanded={isExpanded} tone="lab" />
            ))}
          </div>
        </div>
      </nav>
      {isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="mt-3.5 self-end rounded-lg border border-transparent p-2 text-slate-500 transition-colors duration-200 hover:border-white/10 hover:bg-white/[0.03] hover:text-slate-200"
          aria-label="Свернуть меню"
          title="Свернуть меню"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      ) : null}
    </aside>
  );
}
