import { Suspense } from "react";
import { StocksCommandCenterLab } from "@/components/lab/stocks-command-center-lab";

export const metadata = { title: "Акции · Command Center Lab", description: "Экспериментальный intraday workspace для акций MOEX." };

export default function StocksCommandCenterLabPage() {
  return <Suspense fallback={<div className="p-6 font-mono text-sm text-slate-500">Загрузка лаборатории…</div>}><StocksCommandCenterLab /></Suspense>;
}
