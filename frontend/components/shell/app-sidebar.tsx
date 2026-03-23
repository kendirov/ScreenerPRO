"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { sidebarNav } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

const SIDEBAR_PINNED_KEY = "screenerpro.sidebar.pinned";

export function AppSidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const persistedState = window.localStorage.getItem(SIDEBAR_PINNED_KEY);
    if (persistedState === "1") {
      setIsExpanded(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_PINNED_KEY, isExpanded ? "1" : "0");
  }, [isExpanded]);

  return (
    <aside
      className={cn(
        "relative hidden shrink-0 border-r py-4 transition-[width,padding,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex lg:flex-col",
        isExpanded
          ? "w-52 border-slate-700/70 bg-slate-950/70 px-3 backdrop-blur-xl"
          : "w-[74px] border-slate-800/70 bg-slate-950/92 px-2 backdrop-blur-sm",
      )}
    >
      <div className={cn("mb-4 flex items-center px-1", isExpanded ? "justify-between" : "justify-center")}>
        <Link
          href="/screener"
          className={cn(
            "rounded-md border border-transparent px-2 py-1 text-xs font-semibold tracking-[0.14em] text-slate-300 transition-colors duration-200 hover:border-slate-800/80 hover:bg-slate-900/70",
            !isExpanded && "w-full text-center",
          )}
        >
          {isExpanded ? "SCREENERPRO" : "SP"}
        </Link>
        {isExpanded ? null : (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="absolute left-1/2 top-16 -translate-x-1/2 rounded-md border border-slate-800/60 bg-slate-900/70 p-1.5 text-slate-500 transition-all duration-200 hover:border-slate-700/80 hover:bg-slate-900 hover:text-slate-200"
            aria-label="Развернуть меню"
            title="Развернуть меню"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>
      <p
        className={cn(
          "mb-2 px-2 text-[10px] uppercase tracking-[0.2em] text-slate-500 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isExpanded ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        Рабочие разделы
      </p>
      <nav className="space-y-1.5">
        {sidebarNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={!isExpanded ? item.label : undefined}
              className={cn(
                "group flex items-center rounded-md border py-2 text-slate-400 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                isExpanded ? "gap-3 px-3 text-sm" : "justify-center px-2",
                isActive
                  ? "border-slate-600/70 bg-slate-900/75 text-slate-100 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]"
                  : "border-transparent hover:border-slate-700/70 hover:bg-slate-900/55 hover:text-slate-100",
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 text-slate-500 transition-colors duration-200 group-hover:text-slate-300",
                  isActive && "text-cyan-300",
                )}
              />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isExpanded ? "max-w-[120px] translate-x-0 opacity-100" : "max-w-0 -translate-x-1 overflow-hidden opacity-0",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      {isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="mt-3 self-end rounded-md border border-transparent p-2 text-slate-500 transition-colors duration-200 hover:border-slate-700/80 hover:bg-slate-900/60 hover:text-slate-200"
          aria-label="Свернуть меню"
          title="Свернуть меню"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      ) : null}
    </aside>
  );
}
