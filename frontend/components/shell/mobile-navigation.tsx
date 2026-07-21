"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { mobilePrimaryNav, mobileMoreNav, isNavItemActive } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function MobileNavigation() {
  const pathname = usePathname(); const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden"; return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; }; }, [open]);
  return <><nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-50 border-t border-lab-border bg-[color:var(--color-overlay)] px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl lg:hidden"><div className="mx-auto flex max-w-lg justify-around">{mobilePrimaryNav.map(i => { const active = isNavItemActive(pathname, i.href); return <Link key={i.id} href={i.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[10px]", active ? "text-lab-cyan" : "text-lab-dim")}><i.icon className="h-4 w-4"/><span>{i.shortLabel}</span></Link>; })}<button type="button" aria-label="Открыть дополнительную навигацию" aria-expanded={open} onClick={() => setOpen(true)} className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[10px] text-lab-dim"><Menu className="h-4 w-4"/><span>Ещё</span></button></div></nav>
  {open ? <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Дополнительная навигация"><button aria-label="Закрыть меню" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/55"/><section className="absolute inset-x-0 bottom-0 rounded-t-[var(--radius-lg)] border border-lab-border bg-lab-surface-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-raised)]"><div className="mb-3 flex items-center justify-between"><p className="font-mono text-xs uppercase tracking-[.16em] text-lab-muted">Разделы</p><button autoFocus onClick={() => setOpen(false)} className="rounded-md p-2 text-lab-muted" aria-label="Закрыть"><X className="h-4 w-4"/></button></div><div className="grid grid-cols-2 gap-2">{mobileMoreNav.map(i => <Link key={i.id} href={i.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-lab-border px-3 text-sm text-lab-muted"><i.icon className="h-4 w-4 text-lab-violet"/>{i.label}</Link>)}</div></section></div> : null}</>;
}
