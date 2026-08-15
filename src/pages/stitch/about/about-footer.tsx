import { SOCIAL_LINKS } from './about-constants';

export function AboutFooter() {
  return (
    <footer className="bg-[var(--aura-noir-void)] border-t border-[var(--aura-border-chrome)]/10 py-14 px-6 md:px-16">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-8">
        {/* Brand */}
        <span className="font-display text-headline-md text-[var(--aura-tertiary)] tracking-widest uppercase">
          AURA CAFE
        </span>

        {/* Social links */}
        <nav className="flex items-center gap-8" aria-label="Social links">
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              aria-label={link.label}
              className="text-[var(--aura-chrome-mid)] hover:text-[var(--aura-tertiary)] transition-colors duration-300 text-xl"
            >
              {link.icon}
            </a>
          ))}
        </nav>

        {/* Copyright */}
        <div className="text-center">
          <p className="font-body text-body-sm text-[var(--aura-chrome-dark)]">
            {'©'} 2024 AURA CAFE. ENGINEERED ELEGANCE.
          </p>
          <p className="font-body text-body-sm text-[var(--aura-chrome-dark)]/50 mt-1 text-xs">
            INDUSTRIAL LUXURY CAFE &mdash; SA DEC, VIETNAM
          </p>
        </div>
      </div>
    </footer>
  );
}
