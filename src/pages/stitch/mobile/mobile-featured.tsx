import type { RefObject } from 'react';
import { FEATURED_ITEMS } from './mobile-data';

interface MobileFeaturedProps {
  featuredRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: (dir: number) => void;
}

/**
 * Featured items horizontal carousel with scroll buttons.
 */
export function MobileFeatured({ featuredRef, scrollRef, onScroll }: MobileFeaturedProps) {
  return (
    <section ref={featuredRef} className="mt-8">
      <div className="flex items-center justify-between px-6 mb-4">
        <h2 className="font-body text-base font-semibold tracking-wide text-[var(--aura-chrome-bright)]">
          Featured Items
        </h2>
        <button
          type="button"
          className="font-body text-xs text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-light)] transition-colors tracking-wider uppercase"
        >
          See Menu &rarr;
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto carousel-scroll snap-x snap-mandatory px-6 pb-6 scroll-smooth"
        role="list"
        aria-label="Featured menu items"
      >
        {FEATURED_ITEMS.map((item) => (
          <article
            key={item.id}
            className="glass-card-reveal flex-shrink-0 w-64 glass-card rounded-xl snap-center overflow-hidden group"
            role="listitem"
          >
            <div className="relative h-48 overflow-hidden">
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url(${item.image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-deep)]/60 to-transparent" />
            </div>

            <div className="p-4">
              <h3 className="font-display text-lg italic text-[var(--aura-chrome-bright)] leading-snug">
                {item.nameEn}
              </h3>
              <p className="font-body text-sm text-[var(--aura-chrome-mid)] mt-0.5">
                {item.nameVi}
              </p>
              <div className="flex items-center justify-between mt-3">
                <span className="font-body text-sm font-semibold text-[var(--aura-chrome-light)]">
                  ${item.price.toFixed(2)}
                </span>
                <button
                  type="button"
                  aria-label={`Add ${item.nameEn} to cart`}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--aura-noir-deep)] text-sm font-bold hover:scale-110 active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #E5E4E2, #C0C0C0)' }}
                >
                  +
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="flex gap-2 px-6 -mt-2">
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => onScroll(-1)}
          className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
        >
          &larr;
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => onScroll(1)}
          className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
        >
          &rarr;
        </button>
      </div>
    </section>
  );
}
