import type { Metadata } from "next";
import { SectorKShell } from "@/components/sector-k/sector-k-shell";
import "./sector-k.css";

export const metadata: Metadata = {
  title: {
    default: "Сектор K — торговый экран",
    template: "%s — Сектор K",
  },
  description: "Read-only торговый экран и учебная лаборатория на данных MOEX ISS.",
};

export default function SectorKLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SectorKShell>{children}</SectorKShell>;
}
