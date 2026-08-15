import { FOOTER_CONNECT, FOOTER_LEGAL } from './events-promotions-1-data';

export function EventsFooter() {
  return (
    <footer className="border-t py-20 mt-20" style={{ borderColor: 'var(--aura-border-chrome)', backgroundColor: 'var(--aura-noir-deep)' }}>
      <div className="max-w-[1200px] mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Brand */}
        <div className="flex flex-col gap-3">
          <span className="font-display text-xl italic text-[var(--aura-chrome-mid)]">
            AURA CAFE
          </span>
          <p className="font-body text-sm text-[var(--aura-chrome-dark)]">
            Precision engineering meets atmospheric tranquility. The sanctum
            of the modern connoisseur.
          </p>
        </div>

        {/* Connect */}
        <div className="flex flex-col gap-3">
          <h5
            className="font-body text-sm font-medium uppercase tracking-widest"
            style={{ color: 'var(--aura-tertiary)' }}
          >
            Connect
          </h5>
          <div className="flex flex-col gap-2">
            {FOOTER_CONNECT.map((link) => (
              <a
                key={link}
                href="#"
                className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
        </div>

        {/* Legal */}
        <div className="flex flex-col gap-3">
          <h5
            className="font-body text-sm font-medium uppercase tracking-widest"
            style={{ color: 'var(--aura-tertiary)' }}
          >
            Legal
          </h5>
          <div className="flex flex-col gap-2">
            {FOOTER_LEGAL.map((link) => (
              <a
                key={link}
                href="#"
                className="font-body text-sm text-[var(--aura-chrome-dark)] hover:text-[var(--aura-chrome-bright)] transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div
        className="max-w-[1200px] mx-auto px-8 mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4"
        style={{ borderColor: 'rgba(142,144,151,0.2)' }}
      >
        <p
          className="font-body text-xs text-[var(--aura-chrome-dark)]"
        >
          © 2024 AURA CAFE. ENGINEERED FOR CALM.
        </p>
        <div className="flex gap-4 items-center">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--aura-neon-bronze)' }} />
          <span className="font-body text-xs uppercase tracking-wider text-[var(--aura-chrome-bright)]">
            Live at Pier 14
          </span>
        </div>
      </div>
    </footer>
  );
}
