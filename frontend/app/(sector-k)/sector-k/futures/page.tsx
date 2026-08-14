import type { Metadata } from "next";
import { SectorKFutures } from "@/components/sector-k/sector-k-futures";

export const metadata: Metadata = { title: "Фьючерсы" };

export default function SectorKFuturesPage() {
  return <SectorKFutures />;
}
