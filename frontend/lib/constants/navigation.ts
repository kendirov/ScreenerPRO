import { BookOpen, CalendarDays, ChartColumn, Cog, Gem, Library, ListChecks, Newspaper, CandlestickChart, ChartCandlestick } from "lucide-react";
import type { ComponentType } from "react";

type NavVisibility = "visible" | "hidden";

type SidebarNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  visibility: NavVisibility;
};

export const sidebarNavConfig: SidebarNavItem[] = [
  { href: "/screener", label: "Скринер: Обзор", icon: ChartColumn, visibility: "visible" },
  { href: "/screener/stocks", label: "Скринер: Акции", icon: CandlestickChart, visibility: "visible" },
  { href: "/screener/futures", label: "Скринер: Фьючерсы", icon: ChartCandlestick, visibility: "visible" },
  { href: "/academy", label: "Академия", icon: BookOpen, visibility: "visible" },
  { href: "/materials", label: "Материалы", icon: Library, visibility: "visible" },
  { href: "/pro", label: "Скринер PRO", icon: Gem, visibility: "hidden" },
  { href: "/news", label: "Новости", icon: Newspaper, visibility: "hidden" },
  { href: "/events", label: "События", icon: CalendarDays, visibility: "hidden" },
  { href: "/app/watchlist", label: "Наблюдение", icon: ListChecks, visibility: "hidden" },
  { href: "/app/settings", label: "Настройки", icon: Cog, visibility: "hidden" },
];

export const sidebarNav = sidebarNavConfig.filter((item) => item.visibility === "visible");
