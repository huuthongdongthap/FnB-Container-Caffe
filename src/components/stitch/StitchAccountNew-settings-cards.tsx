/**
 * Settings cards grid for StitchAccountNew.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

'use client';

import { clsx } from 'clsx';
import { Star, CreditCard } from 'lucide-react';
import type { AccountCardNew } from './StitchAccountNew-types';

const glassCardStyle = {
  background: 'rgba(30, 41, 59, 0.4)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
} as const;

/* ─── Settings Cards Grid ─────────────────────────────────────── */

export function AccountNewSettingsCards({
  cards,
}: {
  cards: AccountCardNew[];
}) {
  return (
    <section aria-label="Account settings">
      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <div
            key={card.type}
            className={clsx(
              'p-5 rounded-xl transition-all hover:scale-[1.02]',
              card.accent
                ? 'border-l-2 border-l-[#d4a574]'
                : 'border-l border-l-transparent',
            )}
            style={glassCardStyle}
            aria-label={`${card.title} - ${card.subtitle}`}
          >
            {card.type === 'subscription' ? (
              <Star className="w-6 h-6 text-[#d4a574] mb-3" />
            ) : (
              <CreditCard className="w-6 h-6 text-[var(--aura-primary, #c6c6c7)] mb-3" />
            )}
            <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--aura-text-secondary, #a0a8b0)] mb-1">
              {card.subtitle}
            </p>
            <p
              className="text-sm font-bold text-[var(--aura-text-primary, #e8e8e8)]"
              style={{ fontFamily: "'Hanken Grotesk', system-ui, sans-serif" }}
            >
              {card.title}
            </p>
            <p className="text-[10px] text-[#7c838a] mt-2">
              {card.meta}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
