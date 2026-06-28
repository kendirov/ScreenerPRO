import Link from "next/link";
import { labCatalogItems, sidebarDraftsNav, DRAFT_BADGE_LABELS } from "@/lib/constants/navigation";
import { LabGlassPanel } from "@/components/ui/lab-glass-panel";

export const metadata = {
  title: "Черновики · Лаборатория рынка",
  description: "Каталог экспериментальных lab-страниц — прямой доступ, не в публичном меню.",
};

export default function LabCatalogPage() {
  const draftItems = sidebarDraftsNav.items.filter((item) => item.visibility === "visible");

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-3 py-4">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lab-dim">Служебный каталог</p>
        <h1 className="text-lg font-semibold text-lab-text">Черновики и лаборатории</h1>
        <p className="text-[12px] leading-relaxed text-lab-text-dim">
          Эти страницы не входят в публичное меню трейдера. Прямые URL сохранены для разработки и тестов.
        </p>
      </header>

      <LabGlassPanel depth={20} className="divide-y divide-lab-border/30">
        {draftItems.map((item) => {
          const catalog = labCatalogItems.find((c) => c.href === item.href);
          const badge = item.draftBadge ? DRAFT_BADGE_LABELS[item.draftBadge] : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col gap-1 px-3 py-3 transition hover:bg-lab-surface-1/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-lab-text">{item.label}</span>
                {badge ? (
                  <span className="lab-status-chip lab-chip-draft font-mono text-[8px] uppercase">{badge}</span>
                ) : null}
                <span className="font-mono text-[9px] text-lab-dim">{item.href}</span>
              </div>
              {catalog?.description ? (
                <p className="text-[11px] leading-relaxed text-lab-text-dim">{catalog.description}</p>
              ) : null}
            </Link>
          );
        })}
      </LabGlassPanel>

      <p className="text-[10px] text-lab-dim">
        Публичное ядро:{" "}
        <Link href="/screener" className="text-lab-cyan hover:underline">
          Рынок
        </Link>
        {" · "}
        <Link href="/screener/stocks" className="text-lab-cyan hover:underline">
          Акции
        </Link>
        {" · "}
        <Link href="/screener/futures" className="text-lab-cyan hover:underline">
          Фьючерсы
        </Link>
      </p>
    </div>
  );
}
