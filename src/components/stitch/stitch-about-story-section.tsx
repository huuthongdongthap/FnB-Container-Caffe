'use client';

import { clsx } from 'clsx';
import { ICON_MAP } from './stitch-about-types';
import type { StoryCard } from './stitch-about-types';

/**
 * Story section with bento-style cards for StitchAbout page.
 */
export function StorySection({
  title,
  lead,
  cards,
}: {
  title: string;
  lead: string;
  cards: StoryCard[];
}) {
  const getIcon = (key: keyof typeof ICON_MAP) => {
    const Icon = ICON_MAP[key];
    return Icon ? <Icon className="h-8 w-8" /> : null;
  };

  const StoryCardItem = ({
    card,
    index,
  }: {
    card: StoryCard;
    index: number;
  }) => {
    const isFeatured = index === 0;

    return (
      <div
        className={clsx(
          'glass-card-about chrome-border-top group flex flex-col p-8 md:p-12',
          card.span || 'md:col-span-5',
        )}
      >
        <div className="flex items-center gap-4 mb-6">
          <span style={{ color: 'var(--aura-tertiary, #d4a574)' }}>
            {getIcon(card.icon)}
          </span>
          <span
            className="font-bold tracking-tighter"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            REF: 00{index + 1}
          </span>
        </div>
        <h3
          className="mb-4 text-2xl text-white md:text-3xl"
          style={{ fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)' }}
        >
          {card.title}
        </h3>
        <p
          className="leading-relaxed"
          style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
        >
          {card.description}
        </p>
        {isFeatured && card.imageUrl && (
          <div className="mt-8 h-48 overflow-hidden rounded-lg border border-white/5 md:h-64">
            <img
              className="h-full w-full object-cover opacity-70 grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
              src={card.imageUrl}
              alt={card.imageAlt ?? card.title}
              loading="lazy"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="px-[var(--aura-container-padding,24px)] py-24 md:py-32">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-12 md:mb-16">
          <h2
            className="mb-4 text-4xl md:text-5xl"
            style={{
              color: 'var(--aura-text-primary, #e8e8e8)',
              fontFamily: 'var(--aura-font-display, "Libre Caslon Text", Georgia, serif)',
            }}
          >
            {title}
          </h2>
          <p
            className="max-w-2xl font-light leading-relaxed"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
          >
            {lead}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {cards.map((card, idx) => (
            <StoryCardItem key={card.id} card={card} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}
