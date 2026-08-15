import { DESKTOP_NAV_ITEMS, MOBILE_NAV_ITEMS } from './referral-rewards-2-data';

export function TopNav() {
  return (
    <nav
      className="fixed top-0 w-full z-50 flex justify-between items-center px-5 md:px-6 py-4"
      style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <div className="flex items-center gap-4">
        <button
          className="text-[var(--aura-tertiary)] cursor-pointer active:scale-95 transition-transform text-xl"
          aria-label="Go back"
        >
          ←
        </button>
        <h1 className="font-display text-xl md:text-2xl text-[var(--aura-tertiary)] tracking-tight uppercase">
          AURA CAFE
        </h1>
      </div>

      <div className="hidden md:flex items-center gap-8">
        {DESKTOP_NAV_ITEMS.map((item) => (
          <a
            key={item}
            href="#"
            className={`font-body text-xs font-semibold tracking-widest uppercase transition-colors ${
              item === 'REFERRALS'
                ? 'text-[var(--aura-tertiary)]'
                : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'
            }`}
          >
            {item}
          </a>
        ))}
      </div>

      <button className="text-[var(--aura-chrome-mid)] text-2xl" aria-label="Account">
        👤
      </button>
    </nav>
  );
}

export function MobileBottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-20 px-2 pb-4 z-50"
      style={{
        background: 'rgba(0,14,35,0.6)',
        backdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {MOBILE_NAV_ITEMS.map((item) => (
        <button
          key={item.label}
          className={`flex flex-col items-center justify-center transition-all duration-200 active:scale-90 ${
            item.active ? 'font-bold' : ''
          }`}
          style={{
            color: item.active ? 'var(--aura-tertiary)' : 'var(--aura-chrome-mid)',
            background: item.active ? 'rgba(57,71,94,0.4)' : 'transparent',
            borderRadius: '9999px',
            padding: '4px 16px',
          }}
        >
          <span className="text-lg">{item.icon}</span>
          <span className="font-body text-[10px] mt-1 tracking-widest uppercase font-semibold">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
