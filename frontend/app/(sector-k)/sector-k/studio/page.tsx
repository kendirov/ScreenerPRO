import type { Metadata } from "next";
import { SectorKStudio } from "@/components/sector-k/sector-k-studio";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

export default function SectorKStudioPage() {
  return <SectorKStudio />;
}
