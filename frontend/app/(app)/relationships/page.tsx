import Link from "next/link";
import { PageHeader, NavBadge, SectionFrame } from "@/components/shell/page-primitives";

const items = [
  ["Карта рынка", "Сектора, капитализация и текущая структура рынка.", "/lab/market-map", "lab"],
  ["Валютная связка", "SI, CNY и ED: расхождения и режимы валютных пар.", "/lab/currency-correlation", "lab"],
  ["Матрица связей", "Исследовательская матрица факторов и взаимосвязей.", "/lab/correlation-lab", "draft"],
  ["Реакция на ставку ЦБ", "Исторические сценарии и реакция рынка на решения ЦБ.", "/lab/cbr-rate-reaction", "lab"],
  ["Реакция на новости", "Черновой инструмент для исследования событийных движений.", "/lab/event-reactions", "draft"],
  ["Недельная инфляция", "Контекст инфляционных публикаций для рынка.", "/lab/weekly-inflation", "draft"],
  ["SI-лаборатория", "Рабочая гипотеза связей фьючерса на доллар и рынка.", "/lab/si-usdrub-lab", "wip"],
  ["Пульс сессии", "Карта ликвидности и активности внутри торговой сессии.", "/lab/session-liquidity-map", "wip"],
] as const;

export default function RelationshipsPage() { return <div className="mx-auto max-w-[1440px] space-y-4"><PageHeader eyebrow="Исследовательский контур" title="Лаборатория" description="Карты, события и проверяемые рыночные гипотезы. Статус каждого инструмента показан честно." /><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map(([title, description, href, status]) => <Link key={href} href={href}><SectionFrame className="group h-full p-4 transition-colors hover:border-lab-border-hot hover:bg-lab-surface-strong"><div className="mb-5 flex items-start justify-between gap-2"><h2 className="text-sm font-semibold text-lab-text group-hover:text-lab-cyan">{title}</h2><NavBadge status={status} /></div><p className="text-xs leading-relaxed text-lab-muted">{description}</p></SectionFrame></Link>)}</div></div>; }
