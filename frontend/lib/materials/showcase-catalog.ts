export type MaterialsCardType = "лаборатория" | "справочник" | "тренажёр" | "идея";
export type MaterialsCardMotif =
  | "bubbles"
  | "lines"
  | "orderbook"
  | "timeline"
  | "curve"
  | "grid"
  | "clusters"
  | "tape"
  | "futures"
  | "index";

/** Разделы витрины /materials */
export type MaterialsShowcaseSectionId = "ready" | "inDevelopment" | "ideas";

/** Статус карточки на витрине */
export type MaterialsCardStatus = "ready" | "draft" | "wip" | "idea" | "soon";

export type MaterialsShowcaseItem = {
  slug: string;
  title: string;
  description: string;
  href?: string;
  type: MaterialsCardType;
  motif: MaterialsCardMotif;
  status: MaterialsCardStatus;
  section: MaterialsShowcaseSectionId;
  /** Показать предупреждение «Черновик. Страница может меняться.» */
  draftNotice?: boolean;
};

export type MaterialsShowcaseSection = {
  id: MaterialsShowcaseSectionId;
  title: string;
  subtitle: string;
};

export const MATERIALS_SHOWCASE_SECTIONS: MaterialsShowcaseSection[] = [
  {
    id: "ready",
    title: "Готовые материалы",
    subtitle: "Стабильные справочники и учебные страницы — можно использовать в курсе и презентациях.",
  },
  {
    id: "inDevelopment",
    title: "В разработке",
    subtitle: "Экспериментальные lab-страницы: можно открыть, но содержание и UI ещё меняются.",
  },
  {
    id: "ideas",
    title: "Идеи на очереди",
    subtitle: "Концепты для следующих модулей — маршруты и контент пока не готовы.",
  },
];

export const MATERIALS_SHOWCASE_ITEMS: MaterialsShowcaseItem[] = [
  // —— Готовые материалы ——
  {
    slug: "technical-characteristics",
    section: "ready",
    title: "Технические характеристики",
    description: "Лот, шаг, спред, оборот, комиссии и скоринги по акциям и фьючерсам MOEX.",
    href: "/materials/technical-characteristics",
    type: "справочник",
    motif: "grid",
    status: "ready",
  },
  {
    slug: "stocks-map",
    section: "ready",
    title: "Карта акций",
    description: "Сектора, капитализация, индексы и поводыри — поток денег по TQBR.",
    href: "/materials/stocks",
    type: "справочник",
    motif: "bubbles",
    status: "ready",
  },
  {
    slug: "screener-logic",
    section: "ready",
    title: "Логика скринера",
    description: "Как считается in-play, пороги активности и интерпретация для интрадей.",
    href: "/materials/screener",
    type: "справочник",
    motif: "grid",
    status: "ready",
  },
  {
    slug: "futures-reading",
    section: "ready",
    title: "Как читать фьючерсы",
    description: "Базовый актив, экспирация, оборот и контекст для intraday-решений на FORTS.",
    href: "/materials/futures",
    type: "справочник",
    motif: "futures",
    status: "ready",
  },

  // —— В разработке ——
  {
    slug: "market-map",
    section: "inDevelopment",
    title: "Карта рынка",
    description: "Пузырьки, координаты и сигналы по акциям MOEX — где сейчас деньги и движение.",
    href: "/lab/market-map",
    type: "лаборатория",
    motif: "bubbles",
    status: "draft",
    draftNotice: true,
  },
  {
    slug: "currency-correlation",
    section: "inDevelopment",
    title: "Валютная связка",
    description: "Si / CNY / ED: расхождения, z-score и недельный контекст валютных пар.",
    href: "/lab/currency-correlation",
    type: "лаборатория",
    motif: "lines",
    status: "draft",
    draftNotice: true,
  },
  {
    slug: "perpetual-leverage",
    section: "inDevelopment",
    title: "Leverage Liquidation Map",
    description:
      "Интерактивная карта: чем выше плечо, тем ближе ликвидация в perpetual-фьючерсах.",
    href: "/lab/perpetual-leverage",
    type: "тренажёр",
    motif: "curve",
    status: "draft",
    draftNotice: true,
  },
  {
    slug: "orderflow-simulator",
    section: "inDevelopment",
    title: "Привод-симулятор",
    description: "Учебный терминал: стакан, лента, footprint и сценарии без котировок MOEX.",
    href: "/lab/orderflow-simulator",
    type: "лаборатория",
    motif: "orderbook",
    status: "draft",
    draftNotice: true,
  },
  {
    slug: "preparation",
    section: "inDevelopment",
    title: "Подготовка",
    description: "Рабочий пульт утреннего и недельного брифинга: события, драйверы, инструменты, черновик эфира.",
    href: "/lab/preparation",
    type: "лаборатория",
    motif: "timeline",
    status: "wip",
    draftNotice: true,
  },
  {
    slug: "weekly-inflation",
    section: "inDevelopment",
    title: "Инфляционная лаборатория",
    description: "Недельная инфляция РФ: тренд 4/8/12 нед., годовой темп, цель ЦБ 4% и рыночная интерпретация.",
    href: "/lab/weekly-inflation",
    type: "лаборатория",
    motif: "curve",
    status: "draft",
    draftNotice: true,
  },
  {
    slug: "session-liquidity-map",
    section: "inDevelopment",
    title: "Пульс сессии",
    description: "Ликвидность и активность внутри торговой сессии — timeline по фазам дня.",
    href: "/lab/session-liquidity-map",
    type: "лаборатория",
    motif: "timeline",
    status: "wip",
    draftNotice: true,
  },
  {
    slug: "si-usdrub-lab",
    section: "inDevelopment",
    title: "SI-лаборатория",
    description: "Эксперименты с фьючерсом Si и парой USD/RUB — кривая, спред, режимы.",
    href: "/lab/si-usdrub-lab",
    type: "лаборатория",
    motif: "curve",
    status: "wip",
    draftNotice: true,
  },
  {
    slug: "book-model",
    section: "inDevelopment",
    title: "Модель стакана",
    description: "Учебная схема: ask/bid, спред, сценарии исполнения и презентационный режим.",
    href: "/lab/orderflow-simulator?view=book-model",
    type: "тренажёр",
    motif: "orderbook",
    status: "draft",
    draftNotice: true,
  },
  {
    slug: "clusters-lesson",
    section: "inDevelopment",
    title: "Кластера",
    description: "Объём по цене и времени: покупки, продажи и дельта в footprint-панели.",
    href: "/lab/orderflow-simulator?view=domfocus",
    type: "тренажёр",
    motif: "clusters",
    status: "draft",
    draftNotice: true,
  },
  {
    slug: "tape-lesson",
    section: "inDevelopment",
    title: "Лента сделок",
    description: "Принты, пузырьки у стакана и связь ленты с движением цены.",
    href: "/lab/orderflow-simulator?view=terminal",
    type: "тренажёр",
    motif: "tape",
    status: "draft",
    draftNotice: true,
  },

  // —— Идеи на очереди ——
  {
    slug: "index-inside",
    section: "ideas",
    title: "Индекс изнутри",
    description: "Состав IMOEX/RTSI, веса и поводыри — интерактивная карта индекса.",
    type: "идея",
    motif: "index",
    status: "idea",
  },
  {
    slug: "futures-curve",
    section: "ideas",
    title: "Фьючерсная кривая",
    description: "Term structure, календарный спред и ролл по цепочкам FORTS.",
    type: "идея",
    motif: "curve",
    status: "idea",
  },
  {
    slug: "liquidity-day-map",
    section: "ideas",
    title: "Карта ликвидности дня",
    description: "Где и когда внутри сессии концентрируется оборот и активность по инструментам.",
    type: "идея",
    motif: "timeline",
    status: "idea",
  },
  {
    slug: "orderflow-patterns",
    section: "ideas",
    title: "Библиотека паттернов привода",
    description: "Каталог типовых сценариев стакана, ленты и footprint для разбора на уроках.",
    type: "идея",
    motif: "clusters",
    status: "idea",
  },
  {
    slug: "exporters-ruble",
    section: "ideas",
    title: "Экспортёры и рубль",
    description: "Связка экспортных акций, валюты и сырьевых фьючерсов в одном рабочем столе.",
    type: "идея",
    motif: "lines",
    status: "idea",
  },
];

export function itemsBySection(sectionId: MaterialsShowcaseSectionId): MaterialsShowcaseItem[] {
  return MATERIALS_SHOWCASE_ITEMS.filter((item) => item.section === sectionId);
}

export function resolveShowcaseTypeLabel(item: MaterialsShowcaseItem): string {
  return item.type;
}

export const SHOWCASE_STATUS_LABELS: Record<MaterialsCardStatus, string> = {
  ready: "ГОТОВО",
  draft: "ЧЕРНОВИК",
  wip: "В РАЗРАБОТКЕ",
  idea: "ИДЕЯ",
  soon: "СКОРО",
};

export function resolveShowcaseStatusLabel(status: MaterialsCardStatus): string {
  return SHOWCASE_STATUS_LABELS[status];
}

export function isShowcaseItemOpenable(item: MaterialsShowcaseItem): boolean {
  return Boolean(item.href) && item.status !== "idea";
}

/** @deprecated — используйте MaterialsCardStatus */
export type MaterialsItemStatus = MaterialsCardStatus;
