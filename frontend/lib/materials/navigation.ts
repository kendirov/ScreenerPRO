import type { MaterialsPage } from "@/lib/materials/contracts";

export const materialsPages: MaterialsPage[] = [
  {
    slug: "technical-characteristics",
    title: "Технические характеристики",
    description: "Лоты, шаги цены, стоимость шага, спред, оборот, комиссии и производные метрики по инструментам MOEX.",
    href: "/materials/technical-characteristics",
    status: "live",
  },
  {
    slug: "stocks",
    title: "Акции",
    description: "Трейдерская карта рынка акций MOEX: сектора, капитализация, индексы и поводыри с фокусом на поток денег.",
    href: "/materials/stocks",
    status: "live",
  },
  {
    slug: "futures",
    title: "Фьючерсы",
    description: "Карта срочного рынка по базовым активам и цепочкам экспираций: кривая, ролл, ликвидность и базис.",
    href: "/materials/futures",
    status: "live",
  },
];
