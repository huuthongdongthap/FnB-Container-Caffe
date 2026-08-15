import { BOTTOM_NAV } from './mobile-data';

/**
 * Fixed bottom navigation bar with center scan button.
 */
export function MobileBottomNav() {
  return (
    <nav
      className="fixed bottom-6 left-6 right-6 z-50 h-20 rounded-full bg-white/5 backdrop-blur-2xl border border-white/15 flex items-center justify-around px-2"
      aria-label="Main navigation"
    >
      {BOTTOM_NAV.map((item) => {
        if (item.center) {
          return (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              className="relative -mt-8 w-12 h-12 rounded-full flex items-center justify-center text-[var(--aura-noir-deep)] text-lg shadow-lg hover:scale-110 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #E5E4E2, #C0C0C0)' }}
            >
              {item.icon}
            </button>
          );
        }

        return (
          <button
            key={item.label}
            type="button"
            aria-label={`${item.label} / ${item.labelEn}`}
            aria-current={item.active ? 'page' : undefined}
            className={`nav-item--active flex flex-col items-center gap-1 px-3 py-2 text-[10px] font-medium tracking-wider uppercase transition-colors ${
              item.active
                ? 'text-[var(--aura-chrome-bright)]'
                : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-light)]'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
