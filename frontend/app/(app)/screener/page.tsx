import { Suspense } from "react";
import { ScreenerHomePage } from "@/components/screener/screener-home-page";

export default function ScreenerPage() {
  return (
    <Suspense fallback={<div className="px-2 py-8 text-center text-sm text-lab-muted">Загрузка пульта…</div>}>
      <ScreenerHomePage />
    </Suspense>
  );
}
