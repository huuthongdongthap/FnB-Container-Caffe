'use client';

import { useCallback } from 'react';
import { clsx } from 'clsx';

/**
 * Fixed top navigation header for StitchAbout page.
 */
export function HeaderNav() {
  const scrollToOrder = useCallback(() => {
    const el = document.getElementById("order-section");
    el?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Order", href: "#order-section" },
    { label: "Events", href: "/#events" },
    { label: "About", href: "/about", active: true },
    { label: "Contact", href: "/#contact" },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16"
      style={{
        backgroundColor: "rgba(10, 26, 46, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--aura-border-muted, rgba(168, 169, 173, 0.1))",
      }}
    >
      <div
        className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-[var(--aura-container-padding,24px)]"
      >
        <a
          href="/"
          className="text-xl font-bold uppercase tracking-wider"
          style={{ color: "#f2c08d", fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)' }}
        >
          AURA CAFE
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={clsx("text-sm transition-colors duration-200", link.active ? "font-semibold" : "hover:text-[#f2c08d]")}
              style={{ color: link.active ? "#f2c08d" : "var(--aura-text-secondary, #a0a8b0)" }}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={scrollToOrder}
          className="rounded px-6 py-2 text-sm font-semibold uppercase tracking-wider transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--aura-tertiary, #d4a574)", color: "var(--aura-noir-void, #0A1A2E)" }}
        >
          Order Now
        </button>
      </div>
    </header>
  );
}
