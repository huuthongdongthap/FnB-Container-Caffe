export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-[var(--aura-surface-container)] flex justify-around items-center px-4 pb-4 pt-2 border-t border-secondary-container rounded-t-xl">
      <button type="button" className="flex flex-col items-center justify-center text-secondary hover:text-[var(--aura-tertiary)] transition-colors active:scale-90 duration-200">
        <span className="material-symbols-outlined">restaurant_menu</span>
        <span className="font-label-sm text-label-sm uppercase mt-1">Menu</span>
      </button>
      <button type="button" className="flex flex-col items-center justify-center bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] rounded-full px-4 py-1 active:scale-90 duration-200">
        <span className="material-symbols-outlined">military_tech</span>
        <span className="font-label-sm text-label-sm uppercase mt-1">Rewards</span>
      </button>
      <button type="button" className="flex flex-col items-center justify-center text-secondary hover:text-[var(--aura-tertiary)] transition-colors active:scale-90 duration-200">
        <span className="material-symbols-outlined">person</span>
        <span className="font-label-sm text-label-sm uppercase mt-1">Account</span>
      </button>
    </nav>
  );
}
