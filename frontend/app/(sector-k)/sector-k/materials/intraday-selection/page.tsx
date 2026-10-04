import type { Metadata } from "next";
import { SectorKMaterial } from "@/components/sector-k/sector-k-material";

export const metadata: Metadata = { title: "Отбор инструментов" };

export default function IntradaySelectionPage() {
  return <SectorKMaterial />;
}
