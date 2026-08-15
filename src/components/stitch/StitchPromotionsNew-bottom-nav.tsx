/**
 * Fixed bottom navigation bar for the AURA CAFE promotions page.
 */

const navItems = [
  { icon: 'restaurant_menu', label: 'Menu', active: false, fill: 0 },
  { icon: 'auto_awesome', label: 'Promotions', active: true, fill: 1 },
  { icon: 'person', label: 'Account', active: false, fill: 0 },
] as const;

export function PromotionsBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-full border-t border-[var(--aura-chrome-bright)]/20 bg-[var(--aura-surface-dim)]/10 px-4 pb-6 pt-3 backdrop-blur-2xl">
      {navItems.map((item) => (
        <button
          key={item.label}
          type="button"
          className={`relative flex flex-col items-center justify-center pt-3 ${
            item.active
              ? 'text-[var(--aura-bronze-shimmer)]'
              : 'text-[var(--aura-chrome-soft)] transition-all hover:bg-[var(--aura-chrome-soft)]/20 active:scale-95'
          }`}
        >
          {item.active && (
            <div
              className="absolute -top-1 w-8"
              style={{
                height: '2px',
                background: 'var(--aura-bronze-shimmer)',
                boxShadow: '0 0 8px var(--aura-bronze-shimmer)',
              }}
            />
          )}
          <span
            className={`material-symbols-outlined ${item.active ? '' : 'text-[var(--aura-chrome-soft)]'}`}
            style={{
              fontVariationSettings: `'FILL' ${item.fill}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
            }}
          >
            {item.icon}
          </span>
          <span
            className={`mt-1 font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-tighter ${
              item.active
                ? 'text-[var(--aura-bronze-shimmer)]'
                : 'text-[var(--aura-chrome-soft)]'
            }`}
          >
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
