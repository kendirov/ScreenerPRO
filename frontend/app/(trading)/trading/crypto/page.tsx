import type { Metadata } from "next";
import { DatabaseZap } from "lucide-react";

export const metadata: Metadata = { title: "Криптовалюта" };

const DATA_STATUS = [
  ["Инструменты", "0"],
  ["Цены и сделки", "—"],
  ["Стакан", "—"],
  ["История", "—"],
] as const;

export default function TradingCryptoPage() {
  return (
    <div className="sk-page">
      <header className="sk-page-head sk-page-head--compact">
        <div className="sk-page-head__copy"><p className="sk-kicker">Crypto</p><h1>Криптовалюта</h1><p>Источник данных пока не выбран.</p></div>
        <div className="sk-page-head__aside"><span className="sk-tag sk-tag--warning">Не подключено</span></div>
      </header>
      <section className="sk-panel sk-unavailable">
        <div className="sk-unavailable__head"><DatabaseZap size={20} className="sk-arrow" /><div><h2>Источник данных: —</h2><p>Интерфейс не подставляет демонстрационные котировки вместо реального рынка.</p></div></div>
        <dl className="sk-status-grid">
          {DATA_STATUS.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
    </div>
  );
}
