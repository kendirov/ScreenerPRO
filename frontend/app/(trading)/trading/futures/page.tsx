import type { Metadata } from "next";
import { TradingFutures } from "@/components/trading/trading-futures";

export const metadata: Metadata = { title: "Фьючерсы" };

export default function TradingFuturesPage() {
  return <TradingFutures />;
}
