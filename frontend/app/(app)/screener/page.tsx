import { Suspense } from "react";
import { ScreenerHomePage } from "@/components/screener/screener-home-page";
import { DataState } from "@/components/shell/page-primitives";

export default function ScreenerPage() {
  return (
    <Suspense fallback={<DataState kind="loading" title="Загрузка пульта рынка…" />}>
      <ScreenerHomePage />
    </Suspense>
  );
}
