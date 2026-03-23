import Link from "next/link";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/primitives";

export default function LandingPage() {
  return (
    <div className="space-y-8 py-8">
      <SectionHeader
        title="Super Screener"
        subtitle="Institutional-grade MOEX intelligence for stocks and futures."
        right={
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/screener">Open Screener</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        }
      />
      <GlassPanel className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-sm text-slate-400">Speed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">Dense Screener UI</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Depth</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">Instrument Analytics</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Edge</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">Premium Research Layer</p>
        </div>
      </GlassPanel>
    </div>
  );
}
