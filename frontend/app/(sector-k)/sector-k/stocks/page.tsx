import type { Metadata } from "next";
import { Suspense } from "react";
import { SectorKStocks } from "@/components/sector-k/sector-k-stocks";

export const metadata: Metadata = { title: "Акции" };

export default function SectorKStocksPage() {
  return <Suspense fallback={<div className="sk-panel sk-empty"><div><h2>Загрузка акций…</h2></div></div>}><SectorKStocks /></Suspense>;
}
