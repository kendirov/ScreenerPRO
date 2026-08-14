import type { Metadata } from "next";
import { SectorKStocks } from "@/components/sector-k/sector-k-stocks";

export const metadata: Metadata = { title: "Акции" };

export default function SectorKStocksPage() {
  return <SectorKStocks />;
}
