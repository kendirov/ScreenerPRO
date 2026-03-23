import { notFound } from "next/navigation";
import { RangeTurnoverEditorial } from "@/components/academy/range-turnover-editorial";
import { SceneBlock } from "@/components/academy/scene-block";
import { academyEntries } from "@/lib/mock/screener";

export default async function AcademyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = academyEntries.find((item) => item.slug === slug);
  if (!entry) notFound();

  if (slug === "diapazon-i-oborot") {
    return <RangeTurnoverEditorial />;
  }

  return (
    <article className="py-6">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-100">{entry.title}</h1>
      <p className="mt-4 max-w-2xl text-slate-400">{entry.excerpt}</p>
      <div className="mt-10 space-y-2">
        <SceneBlock
          kicker="Сцена 01"
          title="Аукционный контекст задает базовый сценарий"
          text="Перед открытием отметьте дисбаланс и зоны ожидаемой ликвидности, чтобы не торговать вслепую."
        />
        <SceneBlock
          kicker="Сцена 02"
          title="Определение режима снижает лишние сделки"
          text="Сначала классифицируйте поведение рынка: тренд, возврат к среднему или сжатие, а затем выбирайте тактику."
        />
        <SceneBlock
          kicker="Сцена 03"
          title="Риск меняется вместе с потоком"
          text="Размер позиции должен адаптироваться к волатильности и ускорению оборота, а не к фиксированным шаблонам."
        />
      </div>
    </article>
  );
}
