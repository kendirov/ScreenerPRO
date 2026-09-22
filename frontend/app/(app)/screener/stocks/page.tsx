import { Suspense } from "react";
import { StocksScreenerPage } from "@/components/screener/stocks-screener-page";
import { DataState } from "@/components/shell/page-primitives";

export default function ScreenerStocksPage() {
  return (
    <Suspense fallback={<DataState kind="loading" title="Загрузка скринера акций…" />}>
      <StocksScreenerPage />
    </Suspense>
  );
}
