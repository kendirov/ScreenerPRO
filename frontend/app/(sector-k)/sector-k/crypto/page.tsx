import type { Metadata } from "next";
import { DatabaseZap } from "lucide-react";

export const metadata: Metadata = { title: "Крипто" };

export default function SectorKCryptoPage() {
  return (
    <div className="sk-page">
      <header className="sk-page-head"><div className="sk-page-head__copy"><p className="sk-kicker">Crypto</p><h1>Крипто-данные не подключены</h1><p>Инструменты, цены и метрики отсутствуют.</p></div><div className="sk-page-head__aside"><span className="sk-tag sk-tag--warning">Строк: 0</span></div></header>
      <section className="sk-panel sk-empty"><div><DatabaseZap size={30} className="sk-arrow" /><h2>Источник данных: —</h2><div className="sk-tags"><span className="sk-tag">Биржа: —</span><span className="sk-tag">Обновление: —</span><span className="sk-tag">Baseline: —</span></div></div></section>
      <div className="sk-grid sk-grid--3"><div className="sk-panel sk-panel__body"><p className="sk-kicker">Инструменты</p><h2 className="sk-scene-title">0</h2><p className="sk-lede">Universe не подключён.</p></div><div className="sk-panel sk-panel__body"><p className="sk-kicker">Same-time baseline</p><h2 className="sk-scene-title">—</h2><p className="sk-lede">История не подключена.</p></div><div className="sk-panel sk-panel__body"><p className="sk-kicker">Спред и глубина</p><h2 className="sk-scene-title">—</h2><p className="sk-lede">Order book не подключён.</p></div></div>
    </div>
  );
}
