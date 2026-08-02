import {
  Activity,
  BookOpen,
  CalendarDays,
  CandlestickChart,
  ChartColumn,
  CircleDollarSign,
  Cog,
  Gem,
  Grid3x3,
  Landmark,
  Layers,
  Library,
  ListChecks,
  Map,
  ArrowLeftRight,
  Newspaper,
  NotebookPen,
  Percent,
  TrendingUp,
  UserCircle2,
  FlaskConical,
} from "lucide-react";
import type { ComponentType } from "react";

type NavVisibility = "visible" | "hidden";

/** @deprecated — используйте draftBadge в блоке «Черновики» */
export type NavItemStatus = "live" | "soon";

/** Бейдж зрелости страницы в блоке «Черновики» */
export type DraftNavBadge = "lab" | "draft" | "soon" | "wip";

/** Куда перенести пункт после «выпуска» из черновиков */
export type NavPromotionTarget = "materials" | "main";
export type TradingOsSectionId =
  | "today"
  | "market"
  | "laboratory"
  | "news"
  | "studio"
  | "knowledge"
  | "management";
export type TopLevelAvailability = "ready" | "draft" | "bridge" | "wip";

export type SidebarNavItem = {
  id?: string;
  shortLabel?: string;
  group?: "product" | "validated" | "research" | "service";
  mobile?: boolean;
  exact?: boolean;
  section?: TradingOsSectionId;
  availability?: TopLevelAvailability;
  featureFlag?: string;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  visibility: NavVisibility;
  /** @deprecated — только для legacy; в черновиках используйте draftBadge */
  isLab?: boolean;
  /** @deprecated — только для legacy */
  status?: NavItemStatus;
  /** Бейдж в блоке «Черновики»: LAB / DRAFT / СКОРО / В РАЗРАБОТКЕ */
  draftBadge?: DraftNavBadge;
  /** true — пункт виден, но не кликабелен (маршрута ещё нет) */
  disabled?: boolean;
  /**
   * Куда перенести после готовности:
   * - materials → секция «Лаборатории» на /materials (+ labCatalogItems)
   * - main → sidebarMainNavGroups (основное меню)
   */
  promotionTarget?: NavPromotionTarget;
};

export type SidebarNavGroup = {
  id: string;
  title: string;
  items: SidebarNavItem[];
};

/** Верхний уровень Trading OS. Рабочие экраны рынка остаются на прежних URL. */
export const sidebarMainNavGroups: SidebarNavGroup[] = [
  {
    id: "trading-os",
    title: "Trading OS",
    items: [
      { id: "today", section: "today", availability: "ready", shortLabel: "Сегодня", href: "/screener", label: "Сегодня", icon: ChartColumn, visibility: "visible", group: "product", mobile: true, exact: true },
      { id: "market", section: "market", availability: "ready", shortLabel: "Рынок", href: "/screener/stocks", label: "Рынок", icon: CandlestickChart, visibility: "visible", group: "product", mobile: true },
      { id: "laboratory", section: "laboratory", availability: "ready", shortLabel: "Лаборатория", href: "/relationships", label: "Лаборатория", icon: FlaskConical, visibility: "visible", group: "research", mobile: true },
      { id: "news", section: "news", availability: "draft", shortLabel: "Новости", href: "/lab/event-reactions", label: "Новости", icon: Newspaper, visibility: "visible", group: "research" },
      { id: "studio", section: "studio", availability: "bridge", shortLabel: "Студия", href: "/studio", label: "Студия", icon: NotebookPen, visibility: "visible", group: "service" },
      { id: "knowledge", section: "knowledge", availability: "ready", shortLabel: "Знания", href: "/materials", label: "Знания", icon: Library, visibility: "visible", group: "validated" },
      { id: "management", section: "management", availability: "wip", shortLabel: "Управление", href: "/app/settings", label: "Управление", icon: Cog, visibility: "visible", group: "service" },
    ],
  },
];

export const marketContextNav = [
  { href: "/screener", label: "Пульт" },
  { href: "/screener/stocks", label: "Акции" },
  { href: "/screener/futures", label: "Фьючерсы" },
  { href: "/screener/strategies", label: "Стратегии" },
] as const;

export const TOP_LEVEL_AVAILABILITY_LABELS: Record<TopLevelAvailability, string> = {
  ready: "готово",
  draft: "черновик",
  bridge: "мост",
  wip: "в разработке",
};

/**
 * Черновики — экспериментальные lab-страницы до «выпуска» в материалы или основное меню.
 *
 * Promotion workflow:
 * 1. Перенести item из sidebarDraftsNav.items → sidebarMainNavGroups или showcase-catalog (materials).
 * 2. Убрать draftBadge / disabled; при необходимости добавить в labCatalogItems со status: "live".
 * 3. Обновить PROJECT_CONTEXT.md и AI_SESSION_STATE.md.
 */
export const sidebarDraftsNav: SidebarNavGroup = {
  id: "drafts",
  title: "Черновики",
  items: [
    {
      href: "/lab/stocks-command-center",
      label: "Акции · Command Center",
      icon: FlaskConical,
      visibility: "visible",
      draftBadge: "wip",
      promotionTarget: "main",
    },
    {
      href: "/lab/market-map",
      label: "Карта рынка",
      icon: Map,
      visibility: "visible",
      draftBadge: "lab",
      promotionTarget: "materials",
    },
    {
      href: "/materials/technical-characteristics",
      label: "Тех. характеристики",
      icon: ListChecks,
      visibility: "visible",
      draftBadge: "lab",
      promotionTarget: "materials",
    },
    {
      href: "/lab/currency-correlation",
      label: "Валютная связка",
      icon: ArrowLeftRight,
      visibility: "visible",
      draftBadge: "lab",
      promotionTarget: "materials",
    },
    {
      href: "/lab/si-usdrub-lab",
      label: "SI-лаборатория",
      icon: CircleDollarSign,
      visibility: "visible",
      draftBadge: "wip",
      promotionTarget: "materials",
    },
    {
      href: "/lab/session-liquidity-map",
      label: "Пульс сессии",
      icon: Activity,
      visibility: "visible",
      draftBadge: "wip",
      promotionTarget: "materials",
    },
    {
      href: "/lab/perpetual-leverage",
      label: "Liquidation Map",
      icon: TrendingUp,
      visibility: "visible",
      draftBadge: "draft",
      promotionTarget: "materials",
    },
    {
      href: "/lab/orderflow-simulator",
      label: "Привод-симулятор",
      icon: Layers,
      visibility: "visible",
      draftBadge: "draft",
      promotionTarget: "materials",
    },
    {
      href: "/lab/preparation",
      label: "Подготовка",
      icon: NotebookPen,
      visibility: "visible",
      promotionTarget: "materials",
    },
    {
      href: "/lab/weekly-inflation",
      label: "Инфляционная лаборатория",
      icon: Percent,
      visibility: "visible",
      draftBadge: "draft",
      promotionTarget: "materials",
    },
    {
      href: "/lab/correlation-lab",
      label: "Матрица связей",
      icon: Grid3x3,
      visibility: "visible",
      draftBadge: "draft",
      promotionTarget: "materials",
    },
    {
      href: "/lab/cbr-rate-reaction",
      label: "Ставка ЦБ",
      icon: Landmark,
      visibility: "visible",
      draftBadge: "lab",
      promotionTarget: "materials",
    },
  ],
};

/** @deprecated — используйте sidebarMainNavGroups */
export const sidebarNavGroups = sidebarMainNavGroups;

/** Скрытые маршруты — не в публичном sidebar, прямые URL сохранены */
export const hiddenDevNavConfig: SidebarNavItem[] = [
  { href: "/materials", label: "Материалы", icon: Library, visibility: "hidden" },
  { href: "/academy", label: "Академия", icon: BookOpen, visibility: "hidden" },
  { href: "/sandbox", label: "Песочница", icon: Activity, visibility: "hidden" },
  { href: "/login", label: "Вход", icon: UserCircle2, visibility: "hidden" },
  { href: "/pricing", label: "Тарифы", icon: CircleDollarSign, visibility: "hidden" },
];

/** @deprecated alias */
export const hiddenNavConfig: SidebarNavItem[] = [
  ...hiddenDevNavConfig,
  { href: "/pro", label: "Скринер PRO", icon: Gem, visibility: "hidden" },
  { href: "/news", label: "Новости", icon: Newspaper, visibility: "hidden" },
  { href: "/events", label: "События", icon: CalendarDays, visibility: "hidden" },
  { href: "/app/watchlist", label: "Наблюдение", icon: ListChecks, visibility: "hidden" },
  { href: "/app/settings", label: "Настройки", icon: Cog, visibility: "hidden" },
];

/** Полный список пунктов (main + drafts + hidden) */
export const sidebarNavConfig: SidebarNavItem[] = [
  ...sidebarMainNavGroups.flatMap((g) => g.items),
  ...sidebarDraftsNav.items,
  ...hiddenNavConfig,
];

export const sidebarNav = sidebarNavConfig.filter((item) => item.visibility === "visible");

export function isNavItemActive(pathname: string, href: string): boolean {
  const topLevelItem = sidebarMainNavGroups[0].items.find((item) => item.href === href);
  if (topLevelItem?.section) {
    return resolveTradingOsSection(pathname) === topLevelItem.section;
  }
  return href === "/screener" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function resolveTradingOsSection(pathname: string): TradingOsSectionId {
  if (pathname === "/screener") return "today";
  if (
    pathname.startsWith("/screener/stocks") ||
    pathname.startsWith("/screener/futures") ||
    pathname.startsWith("/screener/strategies") ||
    pathname.startsWith("/stocks/") ||
    pathname.startsWith("/futures/")
  ) return "market";
  if (pathname.startsWith("/lab/event-reactions")) return "news";
  if (pathname.startsWith("/relationships") || pathname.startsWith("/lab")) return "laboratory";
  if (pathname.startsWith("/studio")) return "studio";
  if (pathname.startsWith("/materials") || pathname.startsWith("/academy")) return "knowledge";
  if (pathname.startsWith("/app/") || pathname.startsWith("/login") || pathname.startsWith("/pricing")) return "management";
  return "today";
}

/** Три главных мобильных назначения; остальные разделы открываются через «Ещё». */
export const mobilePrimaryNav = sidebarMainNavGroups[0].items.filter((item) => item.mobile).map((item) => ({ ...item, id: item.id ?? item.href, shortLabel: item.shortLabel ?? item.label }));
export const mobileMoreNav = sidebarMainNavGroups[0].items
  .filter((item) => !item.mobile)
  .map((item) => ({ ...item, id: item.id ?? item.href, shortLabel: item.shortLabel ?? item.label }));

/** Пункты блока «Черновики» (обратная совместимость с labNavConfig) */
export const labNavConfig: SidebarNavItem[] = sidebarDraftsNav.items.filter(
  (i) => i.visibility === "visible",
);

export type LabCatalogItem = {
  slug: string;
  title: string;
  description: string;
  href: string;
  status: NavItemStatus;
};

/** Каталог лабораторий для /materials — синхронизировать при promotion из sidebarDraftsNav */
export const labCatalogItems: LabCatalogItem[] = [
  {
    slug: "market-map",
    title: "Карта рынка",
    description: "Интерактивная карта акций MOEX: пузырьки, координаты и сигналы по живым данным.",
    href: "/lab/market-map",
    status: "live",
  },
  {
    slug: "technical-characteristics",
    title: "Технические характеристики",
    description: "Лот, шаг, спред, оборот, комиссии и скоринги по акциям и фьючерсам MOEX.",
    href: "/materials/technical-characteristics",
    status: "live",
  },
  {
    slug: "currency-correlation",
    title: "Валютная связка",
    description: "Si / CNY / ED: расхождения, z-score, недельный контекст и режимы валютных пар.",
    href: "/lab/currency-correlation",
    status: "live",
  },
  {
    slug: "perpetual-leverage",
    title: "Perpetual Leverage Lab",
    description: "Плечо, маржа, funding и ликвидация в perpetual — учебный терминал для перехода с MOEX.",
    href: "/lab/perpetual-leverage",
    status: "soon",
  },
  {
    slug: "orderflow-simulator",
    title: "Привод-симулятор",
    description: "Учебный терминал: стакан, лента, footprint и сценарии без реальных котировок MOEX.",
    href: "/lab/orderflow-simulator",
    status: "live",
  },
  {
    slug: "session-liquidity-map",
    title: "Пульс сессии",
    description: "Карта ликвидности и активности внутри торговой сессии — в разработке.",
    href: "/lab/session-liquidity-map",
    status: "soon",
  },
  {
    slug: "si-usdrub-lab",
    title: "SI-лаборатория",
    description: "Эксперименты с фьючерсом Si и парой USD/RUB — в разработке.",
    href: "/lab/si-usdrub-lab",
    status: "soon",
  },
  {
    slug: "preparation",
    title: "Подготовка",
    description: "Пульт подготовки к утреннему и недельному брифингу — события, драйверы, инструменты.",
    href: "/lab/preparation",
    status: "soon",
  },
  {
    slug: "weekly-inflation",
    title: "Инфляционная лаборатория",
    description: "Недельная инфляция РФ: тренд, категории, годовой темп и рыночная интерпретация.",
    href: "/lab/weekly-inflation",
    status: "soon",
  },
  {
    slug: "correlation-lab",
    title: "Матрица связей",
    description: "Корреляции акций MOEX с индексом, рублём, нефтью, золотом и секторами — по доходностям.",
    href: "/lab/correlation-lab",
    status: "soon",
  },
  {
    slug: "cbr-rate-reaction",
    title: "Ставка ЦБ",
    description: "Реакция валюты, индекса и акций на решение Банка России.",
    href: "/lab/cbr-rate-reaction",
    status: "live",
  },
  {
    slug: "event-reactions",
    title: "Реакция на новости",
    description: "Локальная база: новость → событие → тикер → реакция рынка по окнам времени.",
    href: "/lab/event-reactions",
    status: "soon",
  },
];

export const DRAFT_BADGE_LABELS: Record<DraftNavBadge, string> = {
  lab: "ЛАБ",
  draft: "ЧЕРН.",
  soon: "СКОРО",
  wip: "В РАБ.",
};
