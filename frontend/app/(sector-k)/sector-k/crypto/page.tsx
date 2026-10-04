import type { Metadata } from "next";
import { DatabaseZap } from "lucide-react";

export const metadata: Metadata = { title: "Крипто" };

const DATA_STATUS = [
  ["Инструменты", "0"],
  ["Цены и сделки", "—"],
  ["Стакан", "—"],
  ["История", "—"],
] as const;

export default function SectorKCryptoPage() {
  return (
    <div className="sk-page">
      <header className="sk-page-head sk-page-head--compact">
        <div className="sk-page-head__copy"><p className="sk-kicker">Crypto</p><h1>Крипто</h1><p>Рабочий источник данных не подключён.</p></div>
        <div className="sk-page-head__aside"><span className="sk-tag sk-tag--warning">Недоступно</span></div>
      </header>
      <section className="sk-panel sk-unavailable">
        <div className="sk-unavailable__head"><DatabaseZap size={20} className="sk-arrow" /><div><h2>Источник данных: —</h2><p>Биржа, список инструментов и время обновления не определены.</p></div></div>
        <dl className="sk-status-grid">
          {DATA_STATUS.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
    </div>
  );
}
