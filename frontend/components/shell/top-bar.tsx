import Link from "next/link";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";

/** Минимальная верхняя панель публичного терминала — без auth и уведомлений. */
export function TopBar() {
  return (
    <LabGlassPanel
      as="header"
      depth={10}
      className="sticky top-0 z-40 rounded-none border-x-0 border-t-0 px-1.5 py-2 sm:px-2.5 lg:px-3"
    >
      <div className="lab-accent-line mb-2 opacity-60" aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <span className="hidden text-[10px] uppercase tracking-[0.14em] text-lab-dim sm:inline">
          Лаборатория рынка
        </span>
        <div className="flex items-center gap-2 font-mono text-[9px] tracking-wide text-zinc-700 lg:hidden">
          <Link href="/lab" className="transition-colors hover:text-zinc-300">Черновики</Link>
          <Link href="/screener/ai-data" className="transition-colors hover:text-zinc-300">AI Data</Link>
        </div>
      </div>
    </LabGlassPanel>
  );
}
