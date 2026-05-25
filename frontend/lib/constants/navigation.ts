import {
  Activity,
  BookOpen,
  CalendarDays,
  CandlestickChart,
  ChartCandlestick,
  ChartColumn,
  CircleDollarSign,
  Cog,
  Gem,
  Layers,
  Library,
  ListChecks,
  Map,
  ArrowLeftRight,
  Newspaper,
  NotebookPen,
  Percent,
} from "lucide-react";
import type { ComponentType } from "react";

type NavVisibility = "visible" | "hidden";

/** @deprecated — используйте draftBadge в блоке «Черновики» */
export type NavItemStatus = "live" | "soon";

/** Бейдж зрелости страницы в блоке «Черновики» */
export type DraftNavBadge = "lab" | "draft" | "soon" | "wip";

/** Куда перенести пункт после «выпуска» из черновиков */
export type NavPromotionTarget = "materials" | "main";

export type SidebarNavItem = {
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

/**
 * Основное меню sidebar — стабильные разделы продукта.
 * Экспериментальные /lab/* страницы здесь не размещаем.
 */
export const sidebarMainNavGroups: SidebarNavGroup[] = [
  {
    id: "pult",
    title: "Пульт",
    items: [
      { href: "/screener", label: "Пульт рынка", icon: ChartColumn, visibility: "visible" },
    ],
  },
  {
    id: "market",
    title: "Рынок",
    items: [
      { href: "/screener/stocks", label: "Акции", icon: CandlestickChart, visibility: "visible" },
      { href: "/screener/futures", label: "Фьючерсы", icon: ChartCandlestick, visibility: "visible" },
    ],
  },
  {
    id: "learning",
    title: "Обучение",
    items: [
      { href: "/materials", label: "Материалы", icon: Library, visibility: "visible" },
      { href: "/academy", label: "Академия", icon: BookOpen, visibility: "visible" },
    ],
  },
];

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
      href: "/lab/market-map",
      label: "Карта рынка",
      icon: Map,
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
      draftBadge: "draft",
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
  ],
};

/** @deprecated — используйте sidebarMainNavGroups */
export const sidebarNavGroups = sidebarMainNavGroups;

/** Скрытые маршруты — не в sidebar, но href сохранены */
export const hiddenNavConfig: SidebarNavItem[] = [
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
    slug: "currency-correlation",
    title: "Валютная связка",
    description: "Si / CNY / ED: расхождения, z-score, недельный контекст и режимы валютных пар.",
    href: "/lab/currency-correlation",
    status: "live",
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
];

export const DRAFT_BADGE_LABELS: Record<DraftNavBadge, string> = {
  lab: "ЛАБ",
  draft: "ЧЕРН.",
  soon: "СКОРО",
  wip: "В РАБ.",
};
