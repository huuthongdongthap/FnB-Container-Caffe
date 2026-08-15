import { EventCard } from './events-types';

interface EventsCardGridProps {
  cards: EventCard[];
}

export function EventsCardGrid({ cards }: EventsCardGridProps) {
  return (
    <section className="py-8 pb-20">
      <div className="max-w-[1200px] mx-auto px-5 md:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {cards.map((card) => (
            <article
              key={card.id}
              className="glass-panel overflow-hidden flex flex-col group"
            >
              {/* Card Image */}
              <div className="relative h-56 md:h-64 overflow-hidden">
                <img
                  src={card.image}
                  alt={`${card.titleEn} — ${card.titleVn}`}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-noir-deep)] via-transparent to-transparent opacity-70" />

                {/* Category badge */}
                <span className="absolute top-4 left-4 font-label-caps px-3 py-1 rounded-full bg-[var(--aura-noir-deep)]/70 backdrop-blur-sm border border-[var(--aura-border-chrome)] text-[var(--aura-chrome-light)] uppercase tracking-wider">
                  {card.icon} {card.category}
                </span>

                {/* Price badge */}
                <span className="absolute top-4 right-4 font-body text-sm font-semibold px-3 py-1 rounded-full bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)]">
                  {card.price === 'Free' ? '🎫 Free / Miễn phí' : `$${card.price.replace('$', '')}`}
                </span>
              </div>

              {/* Card Body */}
              <div className="flex flex-col flex-1 p-6 md:p-8 gap-3">
                {/* Title */}
                <h3 className="font-headline-md text-xl md:text-2xl text-[var(--aura-chrome-bright)] leading-snug">
                  {card.titleVn}
                  <br />
                  <span className="text-[var(--aura-tertiary)]">
                    {card.titleEn}
                  </span>
                </h3>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-body text-[var(--aura-chrome-mid)]">
                    📅 {card.date}
                  </span>
                  <span className="font-body text-[var(--aura-chrome-mid)]">
                    🕖 {card.time}
                  </span>
                </div>
                <span className="font-body text-xs text-[var(--aura-chrome-dark)] tracking-wide uppercase">
                  {card.spots} spots / chỗ
                </span>

                {/* Description */}
                <p className="font-body text-sm text-[var(--aura-chrome-mid)] leading-relaxed flex-1">
                  {card.descriptionVn}{' '}
                  <span className="text-[var(--aura-chrome-dark)]">
                    {card.descriptionEn}
                  </span>
                </p>

                {/* CTA Button */}
                <div className="mt-4 pt-4 border-t border-[var(--aura-border-chrome)]/40">
                  {card.ctaStyle === 'solid' ? (
                    <button className="w-full py-3 rounded-full bg-[var(--aura-tertiary)] text-[var(--aura-noir-deep)] font-body text-xs font-semibold uppercase tracking-widest hover:opacity-90 active:scale-[0.97] transition-all">
                      {card.ctaVn} / {card.ctaEn}
                    </button>
                  ) : (
                    <button className="w-full py-3 rounded-full border border-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)] font-body text-xs font-semibold uppercase tracking-widest hover:bg-[var(--aura-chrome-light)]/10 active:scale-[0.97] transition-all">
                      {card.ctaVn} / {card.ctaEn}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Empty state */}
        {cards.length === 0 && (
          <p className="text-center font-body text-[var(--aura-chrome-mid)] py-20">
            Không có sự kiện trong danh mục này / No events in this
            category.
          </p>
        )}
      </div>
    </section>
  );
}
