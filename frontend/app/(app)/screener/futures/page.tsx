import { Suspense } from "react";
import { FuturesScreenerPage } from "@/components/screener/futures-screener-page";
import { DataState } from "@/components/shell/page-primitives";

export default function ScreenerFuturesPage() {
  return (
    <Suspense fallback={<DataState kind="loading" title="Загрузка скринера фьючерсов…" />}>
      <FuturesScreenerPage />
    </Suspense>
  );
}
