import Link from "next/link";
import { materialsPages } from "@/lib/materials/navigation";
import { SectionHeader } from "@/components/ui/primitives";

export default function MaterialsLandingPage() {
  return (
    <div className="space-y-3">
      <SectionHeader
        title="Материалы"
        subtitle="Рабочие разделы для интрадей: без статей и roadmap-блоков, только практические инструменты."
      />

      <div className="grid gap-2.5 lg:grid-cols-3">
        {materialsPages.map((item) => (
          <article key={item.slug} className="rounded-lg border border-slate-800/90 bg-slate-900/45 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-slate-100">{item.title}</h3>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                рабочий
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">{item.description}</p>
            <div className="mt-3">
              <Link href={item.href} className="text-xs font-medium uppercase tracking-[0.08em] text-cyan-300 hover:text-cyan-200">
                Открыть инструмент
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
