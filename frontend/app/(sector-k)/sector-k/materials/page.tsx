import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = { title: "Материалы" };

export default function SectorKMaterialsPage() {
  return (
    <div className="sk-page">
      <header className="sk-page-head"><div className="sk-page-head__copy"><p className="sk-kicker">Материалы</p><h1>Учебные материалы и калькуляторы</h1><p>Опубликовано: 0 · на проверке: 1.</p></div><div className="sk-page-head__aside"><span className="sk-tag sk-tag--violet">1 на проверке</span></div></header>
      <div className="sk-grid sk-grid--3">
        <Link className="sk-panel sk-card-link" href="/sector-k/materials/intraday-selection"><div className="sk-card-link__top"><div className="sk-tags"><span className="sk-tag sk-tag--violet">На проверке</span><span className="sk-tag">По ссылке</span></div><ArrowUpRight className="sk-arrow" size={18} /></div><div><h2>Отбор инструментов для внутридневной торговли</h2><p>Акции в игре · MOEX · расходы на сделку · версия 2.</p></div></Link>
        <div className="sk-panel sk-card-link"><div className="sk-card-link__top"><span className="sk-tag">Нет данных</span></div><div><h2>Перекат фьючерса</h2><p>Spot: — · expiry: MOEX · ALGOPACK: не подключён.</p></div></div>
        <div className="sk-panel sk-card-link"><div className="sk-card-link__top"><span className="sk-tag">Черновик</span></div><div><h2>Расходы на исполнение</h2><p>Комиссия · спред · проскальзывание · стоимость лота.</p></div></div>
      </div>
    </div>
  );
}
