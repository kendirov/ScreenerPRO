import { PriceChartPlaceholder } from "@/components/charts/price-chart-placeholder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/ui/glass-panel";
import { MetricCard, SectionHeader, EmptyState } from "@/components/ui/primitives";
import { formatPct, formatPrice } from "@/lib/formatters/number";
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
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="volume">Объем</TabsTrigger>
              <TabsTrigger value="volatility">Волатильность</TabsTrigger>
              <TabsTrigger value="open-interest">Открытый интерес</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 text-sm text-slate-300">
              Базовый обзор инструмента. Блок подготовлен для подключения реальных аналитических модулей.
            </TabsContent>
            <TabsContent value="volume" className="mt-4">
              <EmptyState title="Модуль объема" text="Профиль ликвидности и аукционные слои будут добавлены следующим этапом." />
            </TabsContent>
            <TabsContent value="volatility" className="mt-4">
              <EmptyState title="Модуль волатильности" text="Здесь появятся расчеты исторической и ожидаемой волатильности." />
            </TabsContent>
            <TabsContent value="open-interest" className="mt-4">
              <EmptyState title="Модуль открытого интереса" text="Блок подготовлен для будущего обогащения данными OI." />
            </TabsContent>
          </Tabs>
        </GlassPanel>
        <GlassPanel>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Панель контекста</h3>
          <p className="mt-3 text-sm text-slate-400">Здесь будут отображаться заметки и сигналы по инструменту.</p>
        </GlassPanel>
      </div>
    </div>
  );
}
