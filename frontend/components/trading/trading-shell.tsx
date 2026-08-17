"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";

type NavigationItem = {
  href: string;
  label: string;
  exact?: boolean;
};

const primaryNavigation: readonly NavigationItem[] = [
  { href: "/trading/stocks", label: "Акции" },
  { href: "/trading/futures", label: "Фьючерсы" },
  { href: "/trading/crypto", label: "Криптовалюта" },
];

const secondaryNavigation: readonly NavigationItem[] = [
  { href: "/sector-k/strategies", label: "Стратегии" },
  { href: "/sector-k/materials", label: "Материалы" },
];

const navigation = [...primaryNavigation, ...secondaryNavigation] as const;

type TradingTheme = "dark" | "light";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname.startsWith(href);
}

function MoscowClock() {
  const [time, setTime] = useState("—:—:—");

  useEffect(() => {
    const format = () => new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
    const tick = () => setTime(format());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="tr-moex-clock" title="Текущее время Europe/Moscow">
      <span>MOEX</span>
      <b className="sk-mono" aria-label={`Московское время ${time}`}>{time}</b>
      <small>МСК</small>
    </div>
  );
}

export function TradingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<TradingTheme>("dark");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="sk-root tr-root" data-sector-theme={theme}>
      <a className="sk-skip" href="#trading-main">К содержанию</a>
      <header className="tr-header">
        <div className="tr-header__inner">
          <Link className="tr-brand" href="/trading/stocks" aria-label="Trading Workspace — акции">
            <span className="tr-brand__mark" aria-hidden="true">TW</span>
            <strong>TRADING WORKSPACE</strong>
          </Link>

          <nav className="tr-nav" aria-label="Основная навигация">
            <div className="tr-nav__primary">
              {primaryNavigation.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className={isActive(pathname, item.href, item.exact) ? "is-active" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <MoscowClock />
            <div className="tr-nav__secondary">
              {secondaryNavigation.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className={isActive(pathname, item.href, item.exact) ? "is-active" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="tr-header__actions">
            <MoscowClock />
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
