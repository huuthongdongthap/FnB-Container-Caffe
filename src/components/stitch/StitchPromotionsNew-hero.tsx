/**
 * Hero promotion section with countdown timer for the AURA CAFE promotions page.
 */
import { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import type { PromoOffer } from './StitchPromotionsNew-types';
import { HeroGlassCard } from './StitchPromotionsNew-glass-card';

interface HeroSectionProps {
  hero: PromoOffer;
  countdownSeconds: number;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function HeroSection({ hero, countdownSeconds }: HeroSectionProps) {
  const [timeLeft, setTimeLeft] = useState(countdownSeconds);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  return (
    <section className="px-4 pb-12 pt-6">
      <div className="group relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="h-[420px] w-full object-cover brightness-50 grayscale-[0.2]"
            src={hero.imageUrl}
            alt={hero.imageAlt}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--aura-surface-dim)] via-transparent to-transparent" />
        </div>
        <div className="relative z-10 pt-[240px]">
          <HeroGlassCard className="p-6">
            <div className="mb-2 flex items-start justify-between">
              {hero.badge && (
                <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
                  {hero.badge.label}
                </span>
              )}
              <div className="flex items-center gap-1 text-[var(--aura-bronze-shimmer)]">
                <Clock className="h-4 w-4" />
                <span className="font-[family-name:var(--aura-body-font)] text-xs">
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
            <h2 className="mb-1 font-[family-name:var(--aura-display-font)] text-2xl text-[var(--aura-chrome-bright)]">
              {hero.title}
            </h2>
            <p className="mb-6 max-w-[80%] font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-soft)]">
              {hero.description}
            </p>
            <button
              type="button"
              className="w-full bg-[var(--aura-bronze-shimmer)] py-2 text-center font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.2em] text-[var(--aura-surface-dim)] transition-all active:scale-95"
            >
              Claim Offer
            </button>
          </HeroGlassCard>
        </div>
      </div>
    </section>
  );
}
