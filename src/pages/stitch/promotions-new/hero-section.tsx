import type { CardOffer } from './types';

interface HeroSectionProps {
  offer: CardOffer;
  timer: number;
  formatTime: (sec: number) => string;
}

export function HeroSection({ offer, timer, formatTime }: HeroSectionProps) {
  return (
    <section className="px-6 pt-4 pb-6">
      <div className="relative overflow-hidden group">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-[420px] object-cover brightness-50 grayscale-[0.2]"
            alt={offer.desc}
            src={offer.image}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" aria-hidden="true" />
        </div>
        <div className="relative z-10 pt-[240px]">
          <div className="glass-panel p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="font-label-caps text-label-caps text-[var(--aura-tertiary)] uppercase tracking-widest">
                Limited Release
              </span>
              <div className="flex items-center gap-1 text-[var(--aura-tertiary)]">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                <span className="font-label-caps text-label-caps">{formatTime(timer)}</span>
              </div>
            </div>
            <h2 className="font-display-lg-mobile text-display-lg-mobile text-on-background mb-1">
              {offer.title}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-4 max-w-[80%]">
              {offer.desc}
            </p>
            <button type="button" className="w-full py-3 bg-[var(--aura-tertiary)] text-primary-container font-label-caps text-label-caps uppercase tracking-[0.2em] transition-all active:scale-95">
              Claim Offer
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
