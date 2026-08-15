/**
 * Newsletter signup section with terms/footer for the AURA CAFE promotions page.
 */
import { Zap } from 'lucide-react';
import { GlassCard } from './StitchPromotionsNew-glass-card';

export function PromotionsNewsletter() {
  return (
    <>
      <section className="px-4 py-12">
        <GlassCard className="relative overflow-hidden p-6">
          <div className="absolute -right-12 -top-12 opacity-5">
            <Zap className="text-[160px] text-[var(--aura-chrome-bright)]" />
          </div>
          <div className="relative z-10">
            <h3 className="mb-1 font-[family-name:var(--aura-display-font)] text-[28px] text-[var(--aura-chrome-bright)]">
              Join the Inner Circle
            </h3>
            <p className="mb-6 font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-soft)]">
              Direct access to private events, rare bean drops, and weekly
              rituals.
            </p>
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="relative">
                <input
                  className="w-full border-b border-[var(--aura-chrome-soft)]/50 bg-transparent py-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-wider text-[var(--aura-chrome-bright)] placeholder:text-[var(--aura-chrome-soft)]/50 focus:border-[var(--aura-bronze-shimmer)] focus:outline-none focus:ring-0"
                  placeholder="ENCRYPTED EMAIL"
                  type="email"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[var(--aura-bronze-shimmer)] py-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.2em] text-[var(--aura-surface-dim)] transition-all active:scale-95"
              >
                Authenticate
              </button>
            </form>
          </div>
        </GlassCard>
      </section>

      <footer className="px-4 pb-12 text-center">
        <p className="mb-1 font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest text-[var(--aura-chrome-soft)]/50">
          Promotion terms apply. Subject to availability.
        </p>
        <button
          type="button"
          className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)] underline underline-offset-4 decoration-[var(--aura-bronze-shimmer)]/30 transition-all hover:decoration-[var(--aura-bronze-shimmer)]"
        >
          View Details
        </button>
      </footer>
    </>
  );
}
