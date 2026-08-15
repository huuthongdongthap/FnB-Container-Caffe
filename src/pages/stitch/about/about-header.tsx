import { NAV_ITEMS } from './about-constants';

export function AboutHeader() {
  return (
    <header className="fixed top-0 w-full z-50">
      <div className="flex justify-between items-center px-5 md:px-16 py-4 bg-[var(--aura-noir-deep)]/80 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/20">
        {/* Brand */}
        <span className="font-display text-lg md:text-xl text-[var(--aura-tertiary)] tracking-widest uppercase">
          AURA CAFE
        </span>

        {/* Menu icon (desktop links) */}
        <nav className="hidden md:flex items-center gap-10">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors duration-300 uppercase tracking-wider"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Reservation badge */}
        <a
          href="#reservation"
          className="flex items-center gap-2 bg-[var(--aura-tertiary)]/15 border border-[var(--aura-tertiary)]/40 text-[var(--aura-tertiary)] px-5 py-2 font-body text-xs font-semibold uppercase tracking-widest hover:bg-[var(--aura-tertiary)]/25 transition-all"
        >
          <span aria-hidden="true">{'\u{1F4CB}'}</span>
          Reservation
        </a>
      </div>
    </header>
  );
}
