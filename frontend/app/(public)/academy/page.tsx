import Link from "next/link";
import { academyEntries } from "@/lib/mock/screener";
import { GlassPanel } from "@/components/ui/glass-panel";
import { SectionHeader } from "@/components/ui/primitives";

export default function AcademyLandingPage() {
  return (
    <div className="space-y-8 py-8">
      <SectionHeader
        title="Academy"
        subtitle="Interactive learning modules designed like premium research presentations."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {academyEntries.map((entry) => (
          <Link key={entry.slug} href={`/academy/${entry.slug}`}>
            <GlassPanel className="h-full transition hover:border-cyan-500/40">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">{entry.level}</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-100">{entry.title}</h3>
              <p className="mt-3 text-sm text-slate-400">{entry.excerpt}</p>
              <p className="mt-4 text-xs text-slate-500">{entry.readTimeMin} min</p>
            </GlassPanel>
          </Link>
        ))}
      </div>
    </div>
  );
}
