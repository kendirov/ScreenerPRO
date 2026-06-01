import { Suspense } from "react";
import { StocksScreenerPage } from "@/components/screener/stocks-screener-page";

export default function ScreenerStocksPage() {
  return (
    <Suspense fallback={<div className="px-2 py-8 text-center text-sm text-lab-muted">Загрузка скринера…</div>}>
      <StocksScreenerPage />
    </Suspense>
  );
}
