"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import {
  TOP_LEVEL_AVAILABILITY_LABELS,
  mobilePrimaryNav,
  mobileMoreNav,
  isNavItemActive,
} from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function MobileNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-50 border-t border-lab-border bg-[color:var(--color-overlay)] px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg justify-around">
          {mobilePrimaryNav.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[10px]", active ? "text-lab-cyan" : "text-lab-dim")}>
                <item.icon className="h-4 w-4" />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
          <button type="button" aria-label="Открыть дополнительную навигацию" aria-expanded={open} onClick={() => setOpen(true)} className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[10px] text-lab-dim">
            <Menu className="h-4 w-4" />
            <span>Ещё</span>
          </button>
        </div>
      </nav>
      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Дополнительная навигация">
          <button aria-label="Закрыть меню" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/55" />
          <section className="absolute inset-x-0 bottom-0 rounded-t-[var(--radius-lg)] border border-lab-border bg-lab-surface-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-raised)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[.18em] text-lab-dim">Trading OS</p>
                <p className="mt-1 text-sm font-medium text-lab-text">Остальные разделы</p>
              </div>
              <button autoFocus onClick={() => setOpen(false)} className="rounded-md p-2 text-lab-muted" aria-label="Закрыть"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {mobileMoreNav.map((item) => (
                <Link key={item.id} href={item.href} aria-label={item.label} onClick={() => setOpen(false)} className="flex min-h-14 flex-col justify-between rounded-[var(--radius-sm)] border border-lab-border px-3 py-2 text-sm text-lab-muted">
                  <span className="flex items-center gap-2"><item.icon className="h-4 w-4 text-lab-violet" />{item.label}</span>
                  {item.availability && item.availability !== "ready" ? <span className="font-mono text-[8px] uppercase tracking-wider text-lab-dim">{TOP_LEVEL_AVAILABILITY_LABELS[item.availability]}</span> : null}
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
