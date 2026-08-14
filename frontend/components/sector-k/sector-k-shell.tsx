"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, PanelRight, Sun, X } from "lucide-react";
import { useState } from "react";

const nav = [
  { href: "/sector-k", label: "Сегодня", exact: true },
  { href: "/sector-k/stocks", label: "Акции" },
  { href: "/sector-k/futures", label: "Фьючерсы" },
  { href: "/sector-k/crypto", label: "Крипто" },
  { href: "/sector-k/strategies", label: "Инструменты" },
  { href: "/sector-k/materials", label: "Материалы" },
] as const;

type SectorKTheme = "dark" | "light";

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function SectorKShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<SectorKTheme>("dark");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="sk-root" data-sector-theme={theme}>
      <a className="sk-skip" href="#sector-k-main">
        К содержанию
      </a>
      <header className="sk-header">
        <div className="sk-header__inner">
          <Link className="sk-brand" href="/sector-k" aria-label="Сектор K — сегодня">
            <span className="sk-brand__mark" aria-hidden="true">K</span>
            <span className="sk-brand__text">
              <strong>Сектор K</strong>
              <small>MOEX screener</small>
            </span>
          </Link>

          <nav className="sk-nav" aria-label="Основная навигация">
            {nav.map((item) => (
              <Link
                className={isActive(pathname, item.href, "exact" in item ? item.exact : false) ? "is-active" : undefined}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="sk-header__actions">
            <button
              className="sk-icon-button"
              type="button"
              aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link className="sk-studio-link" href="/sector-k/studio">
              <PanelRight size={16} />
              Studio
            </Link>
            <button
              className="sk-icon-button sk-menu-button"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="sector-k-mobile-nav"
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav className="sk-mobile-nav" id="sector-k-mobile-nav" aria-label="Мобильная навигация">
            {[...nav, { href: "/sector-k/studio", label: "Studio" }].map((item) => (
              <Link className={isActive(pathname, item.href, item.href === "/sector-k") ? "is-active" : undefined} href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="sk-main" id="sector-k-main">{children}</main>
      <footer className="sk-footer">
        <span>Сектор K · MOEX ISS</span>
        <span>Только просмотр · без исполнения сделок</span>
      </footer>
    </div>
  );
}
