import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { sectorKContentItems, sectorKContentStatusLabels, sectorKVisibilityLabels } from "@/lib/sector-k/content-model";

export const metadata: Metadata = { title: "Материалы" };

export default function SectorKMaterialsPage() {
  return (
    <div className="sk-page">
      <header className="sk-page-head sk-page-head--compact"><div className="sk-page-head__copy"><p className="sk-kicker">Материалы</p><h1>Материалы</h1><p>Доступные учебные модули и калькуляторы.</p></div><div className="sk-page-head__aside"><span className="sk-mono sk-muted">{sectorKContentItems.length} материал</span></div></header>
      <section className="sk-panel">
        <div className="sk-panel__head"><h2>Реестр</h2><span>Статус и версия</span></div>
        <ul className="sk-workspace-list">
          {sectorKContentItems.map((item) => {
            const revision = item.revisions.find((candidate) => candidate.id === item.currentDraftRevisionId);
            return (
              <li key={item.id}><Link href={`/sector-k/materials/${item.slug}`}><div><strong>{item.title}</strong><span>{item.summary}</span></div><div className="sk-workspace-list__meta"><span className="sk-tag sk-tag--violet">{sectorKContentStatusLabels[item.status]}</span><span className="sk-tag">{sectorKVisibilityLabels[item.visibility]}</span><span className="sk-mono">v{revision?.number ?? "—"}</span><ArrowUpRight size={15} className="sk-arrow" /></div></Link></li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
