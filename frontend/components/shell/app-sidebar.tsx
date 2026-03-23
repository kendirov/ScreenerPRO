"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sidebarNav } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-800/80 bg-slate-950/80 p-4 lg:block">
      <Link href="/" className="mb-8 block px-2 text-lg font-semibold tracking-tight text-slate-100">
        Скринер ПРО
      </Link>
      <nav className="space-y-1">
        {sidebarNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-slate-100",
                isActive && "bg-slate-800 text-white",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
