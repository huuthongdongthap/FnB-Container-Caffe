'use client';

import { useCallback } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

/**
 * Fixed top navigation header for StitchAbout page.
 */
export function HeaderNav() {
  const { t } = useTranslation();
  const scrollToOrder = useCallback(() => {
    const el = document.getElementById("order-section");
    el?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const navLinks = [
    { label: t('nav.home', 'Trang chủ'), href: "/" },
    { label: t('nav.menu', 'Thực đơn'), href: "/menu" },
    { label: t('landing.promotions', 'Ưu đãi'), href: "/promotions" },
    { label: t('landing.about', 'Giới thiệu'), href: "/about", active: true },
    { label: t('landing.contact', 'Liên hệ'), href: "/contact" },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16"
      style={{
        backgroundColor: "color-mix(in srgb, var(--aura-glass-bg) 85%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid color-mix(in srgb, var(--aura-border-muted) 10%, transparent)",
      }}
    >
      <div
        className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-[var(--aura-container-padding,24px)]"
      >
        <a
          href="/"
          className="text-xl font-bold uppercase tracking-wider"
          style={{ color: "var(--aura-chrome-light, #f2c08d)", fontFamily: 'var(--aura-font-display)' }}
        >
          AURA CAFE
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={clsx("text-sm transition-colors duration-200", link.active ? "font-semibold" : "hover:text-[var(--aura-chrome-light,#f2c08d)]")}
              style={{ color: link.active ? "var(--aura-chrome-light, #f2c08d)" : "var(--aura-text-secondary, #a0a8b0)" }}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
         type="button"
          onClick={scrollToOrder}
          className="rounded px-6 py-2 text-sm font-semibold uppercase tracking-wider transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--aura-tertiary, var(--aura-chrome-light, #C9D6DF))", color: "var(--aura-noir-void, var(--aura-bg-surface))" }}
        >
          {t('landing.orderNow', 'Gọi món ngay')}
        </button>
      </div>
    </header>
  );
}
