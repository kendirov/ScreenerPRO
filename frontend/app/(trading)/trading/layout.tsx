import type { Metadata } from "next";
import { TradingShell } from "@/components/trading/trading-shell";
import "../../(sector-k)/sector-k/sector-k.css";
import "./trading.css";

export const metadata: Metadata = {
  title: { default: "Trading Workspace", template: "%s — Trading Workspace" },
  description: "Рабочее пространство трейдера: рынок, отбор инструментов и доказательные торговые сценарии.",
};

export default function TradingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <TradingShell>{children}</TradingShell>;
}
