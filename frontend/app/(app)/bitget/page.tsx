import type { Metadata } from "next";
import { BitgetScreener } from "./bitget-screener";

export const metadata: Metadata = {
  title: "Bitget Market Screener",
  description: "Все доступные инструменты Bitget в одном live-скринере.",
};

export default function BitgetPage() {
  return <BitgetScreener />;
}
