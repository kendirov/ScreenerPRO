"use client";
import { usePathname } from "next/navigation";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";

/** Минимальная верхняя панель публичного терминала — без auth и уведомлений. */
export function TopBar() {
  const pathname = usePathname();
  const title = pathname.startsWith("/screener/stocks") ? "Акции" : pathname.startsWith("/screener/futures") ? "Фьючерсы" : pathname.startsWith("/screener/strategies") ? "Стратегии" : pathname.startsWith("/relationships") ? "Связи" : pathname.startsWith("/academy") ? "Академия" : pathname.startsWith("/lab") ? "Черновики" : "Главная";
  return (
    <LabGlassPanel
      as="header"
      depth={10}
      className="sticky top-0 z-40 rounded-none border-x-0 border-t-0 px-1.5 py-2 sm:px-2.5 lg:px-3"
    >
      <div className="lab-accent-line mb-2 opacity-60" aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-lab-muted">{title}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-lab-dim">MOEX</span>
      </div>
    </LabGlassPanel>
  );
}
