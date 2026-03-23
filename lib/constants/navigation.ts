import { BookOpen, ChartColumn, CircleDollarSign, Cog, ListChecks } from "lucide-react";

export const sidebarNav = [
  { href: "/screener", label: "Screener", icon: ChartColumn },
  { href: "/app/watchlist", label: "Watchlist", icon: ListChecks },
  { href: "/academy", label: "Academy", icon: BookOpen },
  { href: "/pricing", label: "Pricing", icon: CircleDollarSign },
  { href: "/app/settings", label: "Settings", icon: Cog },
];
