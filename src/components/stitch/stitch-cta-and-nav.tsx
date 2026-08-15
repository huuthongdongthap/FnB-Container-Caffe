import { ArrowRight } from 'lucide-react';

/* ─── CTA Section ──────────────────────────────────────────────────── */

export function CTASection() {
  return (
    <section className="pt-8">
      <button
        type="submit"
        className="mx-auto flex w-full items-center justify-center gap-3 rounded-full bg-[var(--aura-bronze-shimmer)] px-12 py-5 font-[family-name:var(--aura-display-font)] text-sm uppercase tracking-wider text-[var(--aura-surface-dim)] shadow-[0_0_15px_rgba(212,165,116,0.3)] transition-all hover:opacity-90 active:scale-95 md:w-auto md:min-w-[300px]"
      >
        Confirm Reservation
        <ArrowRight size={20} />
      </button>
      <p className="mt-6 text-center font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-chrome-soft)]">
        No cancellation fee up to 2 hours before the booking.
      </p>
    </section>
  );
}

/* ─── Bottom Navigation ────────────────────────────────────────────── */

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-xl border-t border-[var(--aura-chrome-soft)]/10 bg-[var(--aura-surface-container)] px-4 pb-6 pt-3 shadow-lg">
      <button
        type="button"
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-bronze-shimmer)] active:scale-90"
      >
        <span className="material-symbols-outlined mb-1">restaurant_menu</span>
        <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase">Menu</span>
      </button>
      <button
        type="button"
        className="flex flex-col items-center justify-center rounded-xl bg-[var(--aura-bronze-shimmer)]/20 px-4 py-1 text-[var(--aura-bronze-shimmer)] active:scale-90"
      >
        <span
          className="material-symbols-outlined mb-1"
          style={{ fontVariationSettings: "'FILL' 1, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
        >
          event_seat
        </span>
        <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase">Reservations</span>
      </button>
      <button
        type="button"
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] transition-colors hover:text-[var(--aura-bronze-shimmer)] active:scale-90"
      >
        <span className="material-symbols-outlined mb-1">person</span>
        <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase">Profile</span>
      </button>
    </nav>
  );
}
