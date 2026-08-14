import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = { title: "Стратегии" };

export default function SectorKStrategiesPage() {
  return (
    <div className="sk-page">
      <header className="sk-page-head"><div className="sk-page-head__copy"><p className="sk-kicker">ScreenerPRO Lab</p><h1>Стратегии и тесты</h1><p>Условия, исторические проверки и параметры стратегии.</p></div><div className="sk-page-head__aside"><span className="sk-tag">Read-only</span></div></header>
      <div className="sk-grid sk-grid--3">
        <Link className="sk-panel sk-card-link" href="/screener/strategies"><div className="sk-card-link__top"><span className="sk-tag sk-tag--positive">Доступно</span><ArrowUpRight className="sk-arrow" size={18} /></div><div><h2>Strategy Lab</h2><p>Конструктор условий и историческая проверка.</p></div></Link>
        <Link className="sk-panel sk-card-link" href="/lab"><div className="sk-card-link__top"><span className="sk-tag">Доступно</span><ArrowUpRight className="sk-arrow" size={18} /></div><div><h2>Market Lab</h2><p>Корреляции, события, карта рынка и подготовка.</p></div></Link>
        <div className="sk-panel sk-card-link"><div className="sk-card-link__top"><span className="sk-tag sk-tag--warning">Нет данных</span></div><div><h2>Публичные стратегии</h2><p>Опубликованных стратегий: 0.</p></div></div>
      </div>
    </div>
  );
}
