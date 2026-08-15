import type { Metadata } from "next";

export const metadata: Metadata = { title: "Рынок" };

export default function TradingPage() {
  return <div className="sk-page"><section className="sk-panel sk-empty"><div><h2>TRADING</h2><p>Рабочая поверхность рынка.</p></div></section></div>;
}
