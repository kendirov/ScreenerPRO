import { PriceChartPlaceholder } from "@/components/charts/price-chart-placeholder";
import { EntitlementBoundary } from "@/components/premium/entitlement-boundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/ui/glass-panel";
import { MetricCard, SectionHeader, EmptyState } from "@/components/ui/primitives";
import { formatPct, formatPrice } from "@/lib/formatters/number";
import { premiumFlagsMock } from "@/lib/mock/screener";
import type { InstrumentDetail } from "@/lib/types/market";

export function InstrumentLayout({ detail }: { detail: InstrumentDetail }) {
  return (
    <div className="space-y-5">
      <SectionHeader title={`${detail.ticker} · ${detail.title}`} subtitle={detail.description} />
      <div className="grid gap-3 md:grid-cols-4">
        {detail.metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={`${formatPrice(metric.value)}${metric.suffix ?? ""}`}
            change={metric.delta !== undefined ? formatPct(metric.delta) : undefined}
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <GlassPanel>
          <PriceChartPlaceholder />
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="volume">Volume</TabsTrigger>
              <TabsTrigger value="volatility">Volatility</TabsTrigger>
              <TabsTrigger value="open-interest">Open Interest</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 text-sm text-slate-300">
              Overview module placeholder with architecture ready for real query-bound data.
            </TabsContent>
            <TabsContent value="volume" className="mt-4">
              <EmptyState title="Volume module" text="Depth profile and auction overlays plug in here later." />
            </TabsContent>
            <TabsContent value="volatility" className="mt-4">
              <EmptyState title="Volatility module" text="Surface and realized-vol analytics placeholder." />
            </TabsContent>
            <TabsContent value="open-interest" className="mt-4">
              <EmptyState title="Open interest module" text="Open interest and positioning map placeholder." />
            </TabsContent>
            <TabsContent value="premium" className="mt-4">
              <EntitlementBoundary isAllowed={premiumFlagsMock.deepRiskMetrics} />
            </TabsContent>
          </Tabs>
        </GlassPanel>
        <GlassPanel>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Insight Panel</h3>
          <p className="mt-3 text-sm text-slate-400">Contextual analyst notes and machine insights will be rendered here.</p>
        </GlassPanel>
      </div>
    </div>
  );
}
