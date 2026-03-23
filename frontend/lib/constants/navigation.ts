import { BookOpen, ChartColumn, Cog, FlaskConical, ListChecks } from "lucide-react";

export const sidebarNav = [
  { href: "/screener", label: "Скринер", icon: ChartColumn },
  { href: "/app/watchlist", label: "Наблюдение", icon: ListChecks },
  { href: "/academy", label: "Академия", icon: BookOpen },
  { href: "/sandbox", label: "Песочница (тест)", icon: FlaskConical },
  { href: "/app/settings", label: "Настройки", icon: Cog },
];
