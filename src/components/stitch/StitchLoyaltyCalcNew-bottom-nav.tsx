export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-xl border-t border-[var(--aura-surface-container)] bg-[var(--aura-surface-container)] px-4 pb-4 pt-2">
      <button
        type="button"
        className="flex flex-col items-center justify-center text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-chrome-bright)] active:scale-90"
      >
        <span className="material-symbols-outlined">restaurant_menu</span>
        <span className="mt-1 font-[family-name:var(--aura-body-font)] text-xs uppercase">Menu</span>
      </button>
      <button
        type="button"
        className="flex flex-col items-center justify-center rounded-full bg-[var(--aura-bronze-shimmer)] px-4 py-1 text-[var(--aura-surface-dim)] active:scale-90"
      >
        <span className="material-symbols-outlined">military_tech</span>
        <span className="mt-1 font-[family-name:var(--aura-body-font)] text-xs uppercase">Rewards</span>
      </button>
      <button
        type="button"
        className="flex flex-col items-center justify-center text-[var(--aura-bronze-shimmer)] transition-colors hover:text-[var(--aura-chrome-bright)] active:scale-90"
      >
        <span className="material-symbols-outlined">person</span>
        <span className="mt-1 font-[family-name:var(--aura-body-font)] text-xs uppercase">Account</span>
      </button>
    </nav>
  );
}
