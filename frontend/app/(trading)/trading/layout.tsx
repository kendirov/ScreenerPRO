import type { Metadata } from "next";
import { TradingShell } from "@/components/trading/trading-shell";
import "./trading.css";

export const metadata: Metadata = {
  title: { default: "TRADING", template: "%s — TRADING" },
  description: "Рабочий экран анализа рынка для активного трейдера.",
};

export default function TradingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <TradingShell>{children}</TradingShell>;
}
