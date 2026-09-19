import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = { title: "Инструменты" };

const TOOLS = [
  { href: "/screener/strategies", name: "Strategy Lab", task: "Условия стратегии и историческая проверка" },
  { href: "/lab/preparation", name: "Подготовка", task: "Сценарий торговой сессии" },
  { href: "/lab/market-map", name: "Карта рынка", task: "Связи инструментов и рыночных потоков" },
  { href: "/lab/event-reactions", name: "Реакции на события", task: "Движение цены до и после события" },
  { href: "/lab/correlation-lab", name: "Корреляции", task: "Связь инструментов на выбранном окне" },
] as const;

export default function SectorKStrategiesPage() {
  return (
    <div className="sk-page">
      <header className="sk-page-head sk-page-head--compact"><div className="sk-page-head__copy"><p className="sk-kicker">ScreenerPRO Lab</p><h1>Инструменты</h1><p>Рабочие модули анализа и проверки гипотез.</p></div><div className="sk-page-head__aside"><span className="sk-tag">Только просмотр</span></div></header>
      <section className="sk-panel">
        <div className="sk-panel__head"><h2>Доступно</h2><span>{TOOLS.length} модулей</span></div>
        <ul className="sk-workspace-list">
          {TOOLS.map((tool) => (
            <li key={tool.href}><Link href={tool.href}><div><strong>{tool.name}</strong><span>{tool.task}</span></div><div><span className="sk-tag sk-tag--positive">Доступно</span><ArrowUpRight size={15} className="sk-arrow" /></div></Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
