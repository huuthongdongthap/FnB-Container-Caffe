export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-[var(--aura-surface-container)]/10 backdrop-blur-2xl border-t border-chrome/20 flex justify-around items-center px-6 pb-4 pt-2 rounded-t-full">
      <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant pt-2 hover:bg-white/5 active:scale-95 transition-all">
        <span className="material-symbols-outlined">restaurant_menu</span>
        <span className="font-body-sm text-[10px] uppercase tracking-tighter mt-1">Menu</span>
      </a>
      <a href="#" className="flex flex-col items-center justify-center text-[var(--aura-tertiary)] pt-2 relative">
        <div className="absolute -top-1 w-8 h-[2px] bg-[var(--aura-tertiary)] shadow-[0_0_8px_#D4A574]" />
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
        <span className="font-body-sm text-[10px] uppercase tracking-tighter mt-1">Promotions</span>
      </a>
      <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant pt-2 hover:bg-white/5 active:scale-95 transition-all">
        <span className="material-symbols-outlined">person</span>
        <span className="font-body-sm text-[10px] uppercase tracking-tighter mt-1">Account</span>
      </a>
    </nav>
  );
}
