import { notFound } from "next/navigation";
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

  return (
    <article className="py-10">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-100">{entry.title}</h1>
      <p className="mt-4 max-w-2xl text-slate-400">{entry.excerpt}</p>
      <div className="mt-10 space-y-2">
        <SceneBlock
          kicker="Scene 01"
          title="Auction context sets your first bias"
          text="Start each session by mapping the opening auction imbalance and expected liquidity concentration windows."
        />
        <SceneBlock
          kicker="Scene 02"
          title="Regime detection prevents overtrading"
          text="Classify intraday behavior into trend, mean reversion, or compression before selecting tactics."
        />
        <SceneBlock
          kicker="Scene 03"
          title="Risk is a flow variable"
          text="Position sizing should respond to volatility state and relative volume acceleration, not static templates."
        />
      </div>
    </article>
  );
}
