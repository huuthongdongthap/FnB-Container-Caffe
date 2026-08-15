import type { RefObject } from 'react';
import { PROMOTIONS } from './events-promotions-1-data';

interface PromosProps {
  promoRef: RefObject<HTMLElement | null>;
  isVisible: boolean;
}

export function EventsPromos({ promoRef, isVisible }: PromosProps) {
  return (
    <section
      ref={promoRef}
      id="promo"
      className={`py-20 max-w-[1200px] mx-auto px-8 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
        <div>
          <h2 className="font-display text-2xl md:text-3xl mb-2">
            Curated Engagements
          </h2>
          <div className="h-1 w-20" style={{ backgroundColor: 'var(--aura-neon-bronze)' }} />
        </div>
        <p className="font-body text-base text-[var(--aura-chrome-mid)] max-w-md">
          Exclusive promotions and workshops designed for the discerning
          coffee connoisseur.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PROMOTIONS.map((promo) => (
          <div
            key={promo.id}
            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] overflow-hidden transition-all duration-500 hover:-translate-y-2"
          >
            <div className="h-64 overflow-hidden">
              <img
                src={promo.image}
                alt={promo.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            </div>
            <div className="p-8">
              <span
                className="font-body text-xs font-medium uppercase tracking-widest"
                style={{ color: 'var(--aura-neon-bronze)' }}
              >
                {promo.label}
              </span>
              <h3 className="font-display text-xl md:text-2xl italic mt-2 mb-4">
                {promo.title}
              </h3>
              <p className="font-body text-sm text-[var(--aura-chrome-mid)] mb-6">
                {promo.description}
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-2 text-sm hover:gap-4 transition-all"
                style={{ color: 'var(--aura-tertiary)' }}
              >
                {promo.cta}
                <span className="text-[16px]">→</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
