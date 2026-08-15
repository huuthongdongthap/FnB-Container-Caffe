import { BOTTOM_NAV } from './account-constants';

export function AccountBottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-20 bg-[#040B14]/90 backdrop-blur-2xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {BOTTOM_NAV.map((item) => (
        <a
          key={item.label}
          href={item.href ?? '#'}
          aria-current={item.active ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-[3px] px-3 py-2 transition-all min-w-[64px] ${
            item.active
              ? 'text-[var(--aura-tertiary)]'
              : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)]'
          }`}
        >
          <span className="text-lg leading-none">{item.icon}</span>
          <span className="font-body text-[10px] font-semibold uppercase tracking-wider leading-tight">
            {item.label}
          </span>
        </a>
      ))}
    </nav>
  );
}
