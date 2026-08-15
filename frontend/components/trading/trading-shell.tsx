"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  { href: "/trading", label: "Рынок", exact: true },
  { href: "/trading/stocks", label: "Акции" },
  { href: "/trading/futures", label: "Фьючерсы" },
  { href: "/trading/crypto", label: "Крипто" },
  { href: "/trading/strategies", label: "Стратегии", secondary: true },
  { href: "/trading/materials", label: "Материалы", secondary: true },
] as const;

type TradingTheme = "dark" | "light";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function TradingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<TradingTheme>("dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const primary = navigation.filter((item) => !item.secondary);
  const secondary = navigation.filter((item) => item.secondary);

  return (
    <div className="sk-root tr-root" data-sector-theme={theme}>
      <a className="sk-skip" href="#trading-main">К содержанию</a>
      <header className="tr-header">
        <div className="tr-header__inner">
          <Link className="tr-brand" href="/trading/stocks" aria-label="TRADING — акции">
            <span className="tr-brand__mark" aria-hidden="true">T</span>
            <strong>TRADING</strong>
          </Link>

          <nav className="tr-nav" aria-label="Основная навигация">
            <div className="tr-nav__primary">
              {primary.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className={isActive(pathname, item.href, item.exact) ? "is-active" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="tr-nav__secondary">
              {secondary.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className={isActive(pathname, item.href) ? "is-active" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="tr-header__actions">
            <button
              className="tr-icon-button"
              type="button"
              aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="tr-icon-button tr-menu-button"
              type="button"
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="tr-mobile-nav" aria-label="Мобильная навигация">
            {navigation.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                className={isActive(pathname, item.href, item.exact) ? "is-active" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="sk-main tr-main" id="trading-main">{children}</main>
    </div>
  );
}
