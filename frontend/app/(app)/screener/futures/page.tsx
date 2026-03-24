import { Suspense } from "react";
import { FuturesScreenerPage } from "@/components/screener/futures-screener-page";

export default function ScreenerFuturesPage() {
  return (
    <Suspense fallback={<div className="rounded-xl border border-white/5 bg-slate-950/45 p-4 text-sm text-slate-400">Загрузка фьючерсов...</div>}>
      <FuturesScreenerPage />
    </Suspense>
  );
}
