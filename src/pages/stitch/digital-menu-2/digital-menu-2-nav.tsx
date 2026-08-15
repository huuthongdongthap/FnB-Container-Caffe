import { useState } from 'react';
import { NAV_LINKS } from './digital-menu-2-constants';

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-[var(--aura-noir-deep)]/80 backdrop-blur-xl border-b border-white/10">
      <div className="flex justify-between items-center w-full px-4 md:px-16 py-4 max-w-7xl mx-auto">
        {/* Brand */}
        <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
          AURA CAFE
        </span>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Mobile burger */}
          <button
            className="md:hidden text-[var(--aura-chrome-mid)]"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
          <button
            className="bg-[var(--aura-noir-deep)] text-[var(--aura-tertiary)] border border-[var(--aura-border-chrome)]/40 px-6 py-2 font-body text-xs font-semibold uppercase tracking-widest hover:bg-white/10 active:scale-95 transition-all"
          >
            Reservation
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden flex flex-col gap-4 px-5 pb-6 bg-[var(--aura-noir-deep)]/95 backdrop-blur-xl border-t border-white/10">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="font-body text-sm text-[var(--aura-chrome-mid)] uppercase tracking-wider"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
