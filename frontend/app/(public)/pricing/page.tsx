import { EntitlementBoundary } from "@/components/premium/entitlement-boundary";
import { premiumFlagsMock } from "@/lib/mock/screener";
import { GlassPanel } from "@/components/ui/glass-panel";
import { SectionHeader } from "@/components/ui/primitives";

export default function PricingPage() {
  return (
    <div className="space-y-6 py-8">
      <SectionHeader title="Pricing" subtitle="Billing is not wired yet. This is a premium architecture placeholder." />
      <div className="grid gap-4 md:grid-cols-2">
        <GlassPanel>
          <h3 className="text-lg font-semibold text-slate-100">Core</h3>
          <p className="mt-2 text-sm text-slate-400">Market overview, basic filters, and academy essentials.</p>
        </GlassPanel>
        <EntitlementBoundary
          isAllowed={premiumFlagsMock.advancedScreener}
          fallbackTitle="Pro Plan"
          fallbackText="Unlock premium factor dashboards, advanced watchlists, and deep analytics."
        >
          <GlassPanel>Premium unlocked content placeholder.</GlassPanel>
        </EntitlementBoundary>
      </div>
    </div>
  );
}
