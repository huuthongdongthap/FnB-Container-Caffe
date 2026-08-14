/**
 * Feature cards bento grid section.
 */
'use client';

import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, type FeatureCard } from './stitch-container-new2-types';
import { FeatureIcon } from './stitch-container-new2-feature-icon';

export function FeatureCardsSection({
  sectionTitle,
  cards,
}: {
  sectionTitle: string;
  cards: FeatureCard[];
}) {
  const { t } = useTranslation();
  return (
    <section
      className="py-32 px-5 md:px-[64px] max-w-[1280px] mx-auto"
      aria-labelledby="features-heading"
    >
      <div className="mb-16">
        <h2
          id="features-heading"
          className="mb-4"
          style={{
            fontFamily: FONTS.display,
            fontSize: '32px',
            lineHeight: '40px',
            fontWeight: 500,
            color: COLORS.primaryFixedDim,
          }}
        >
          {sectionTitle}
        </h2>
        <div
          className="h-px w-24"
          style={{ backgroundColor: COLORS.primary }}
          aria-hidden="true"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {cards.map((card) => (
          <article
            key={card.id}
            className="glass-card p-10 flex flex-col space-y-6 group hover:-translate-y-2 transition-all duration-500"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--aura-surface-container) 60%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 20%, transparent)',
              borderLeft: '1px solid color-mix(in srgb, var(--aura-chrome-soft) 10%, transparent)',
            }}
            aria-label={card.title}
          >
            <FeatureIcon icon={card.icon} />
            <h3
              style={{
                fontFamily: FONTS.display,
                fontSize: '24px',
                lineHeight: '32px',
                fontWeight: 500,
                color: COLORS.onSurface,
              }}
            >
              {card.title}
            </h3>
            <p
              style={{
                fontFamily: FONTS.body,
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 400,
                color: COLORS.onSurfaceVariant,
              }}
            >
              {card.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
