import type { Metadata } from "next";
import { Suspense } from "react";
import { TradingStocks } from "@/components/trading/trading-stocks";

export const metadata: Metadata = { title: "Акции" };

export default function TradingStocksPage() {
  return <Suspense fallback={<div className="sk-panel sk-empty"><div><h2>Загрузка рынка…</h2></div></div>}><TradingStocks /></Suspense>;
}
