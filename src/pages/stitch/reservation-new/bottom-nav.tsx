export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 pb-safe bg-[var(--aura-surface-container)] border-t border-outline-variant/10 shadow-lg rounded-t-xl">
      <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-secondary transition-colors active:scale-90 transition-transform">
        <span className="material-symbols-outlined mb-1">restaurant_menu</span>
        <span className="font-label-sm text-label-sm uppercase">Menu</span>
      </a>
      <a href="#" className="flex flex-col items-center justify-center text-secondary bg-secondary-container/20 rounded-xl px-4 py-1 active:scale-90 transition-transform">
        <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>
          event_seat
        </span>
        <span className="font-label-sm text-label-sm uppercase">Reservations</span>
      </a>
      <a href="#" className="flex flex-col items-center justify-center text-on-surface-variant hover:text-secondary transition-colors active:scale-90 transition-transform">
        <span className="material-symbols-outlined mb-1">person</span>
        <span className="font-label-sm text-label-sm uppercase">Profile</span>
      </a>
    </nav>
  );
}
