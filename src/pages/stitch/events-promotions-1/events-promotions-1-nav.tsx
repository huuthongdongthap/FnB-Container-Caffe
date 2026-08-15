import { type Dispatch, type SetStateAction } from 'react';
import { NAV_LINKS } from './events-promotions-1-data';

interface NavProps {
  hoveredReserve: boolean;
  onHover: Dispatch<SetStateAction<boolean>>;
}

export function EventsNav({ hoveredReserve, onHover }: NavProps) {
  return (
    <nav
      className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-5 md:px-16 py-4 bg-white/5 backdrop-blur-xl border-b border-[var(--aura-border-chrome)]/30"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <span className="font-display text-lg md:text-xl text-[var(--aura-chrome-bright)] tracking-widest uppercase">
        AURA CAFE
      </span>

      <div className="hidden md:flex items-center gap-10">
        {NAV_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="font-body text-base text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] transition-colors"
          >
            {l.label}
          </a>
        ))}
      </div>

      <button
        className={`px-6 py-2 font-body text-xs font-semibold uppercase tracking-widest transition-all ${
          hoveredReserve
            ? 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] shadow-[0_0_20px_rgba(212,165,116,0.3)]'
            : 'bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]'
        }`}
      >
        Reserve
      </button>
    </nav>
  );
}
