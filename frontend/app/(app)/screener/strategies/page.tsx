import { Suspense } from "react";
import { StrategyLabPage } from "@/components/screener/strategies/strategy-lab-page";

export default function ScreenerStrategiesPage() {
  return (
    <Suspense
      fallback={
        <div className="px-2 py-8 text-center font-mono text-xs text-lab-muted">Загрузка стратегий…</div>
      }
    >
      <StrategyLabPage />
    </Suspense>
  );
}
