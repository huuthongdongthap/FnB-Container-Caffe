/**
 * StitchPromotionsNew — AURA CAFE Promotions (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy promotions page with hero banner (countdown timer), active offers grid,
 * newsletter signup, and bottom navigation. Mobile-first responsive. Named export.
 * Source: stitch-exports/new-screens/promotions.html
 */
'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  PromoOfferStatus,
  PromoOffer,
  StitchPromotionsNewProps,
} from './StitchPromotionsNew-types';
import { defaultHero, defaultOffers } from './StitchPromotionsNew-constants';
import { PromotionsHeader } from './StitchPromotionsNew-header';
import { PromotionsBottomNav } from './StitchPromotionsNew-bottom-nav';
import { HeroSection } from './StitchPromotionsNew-hero';
import { SectionHeader } from './StitchPromotionsNew-section-header';
import {
  StandardOfferCard,
  ExclusiveOfferCard,
  FullWidthOfferCard,
} from './StitchPromotionsNew-offer-card';
import { PromotionsNewsletter } from './StitchPromotionsNew-newsletter';

/* ─── Re-export all public types ───────────────────────────────── */
export type { PromoOfferStatus, PromoOffer, StitchPromotionsNewProps };

/* ─── Default props ────────────────────────────────────────────── */

const defaultProps: Required<StitchPromotionsNewProps> = {
  countdownSeconds: 4 * 60 * 60 + 22 * 60 + 15,
  hero: defaultHero,
  offers: defaultOffers,
};

/* ─── Component ────────────────────────────────────────────────── */

export function StitchPromotionsNew({
  countdownSeconds = defaultProps.countdownSeconds,
  hero = defaultProps.hero,
  offers = defaultProps.offers,
}: Readonly<StitchPromotionsNewProps>) {
  const { t } = useTranslation();

  /* Scroll-based header opacity transition */
  useEffect(() => {
    const header = document.querySelector('[data-promo-header]');
    const handleScroll = () => {
      if (!header) return;
      if (window.scrollY > 20) {
        header.classList.remove('bg-[var(--aura-surface-dim)]/80');
        header.classList.add('bg-[var(--aura-surface-dim)]');
      } else {
        header.classList.remove('bg-[var(--aura-surface-dim)]');
        header.classList.add('bg-[var(--aura-surface-dim)]/80');
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <PromotionsHeader />
      <main className="min-h-screen bg-[var(--aura-surface-dim)] pb-32 pt-14">
        <HeroSection hero={hero} countdownSeconds={countdownSeconds} />

        <section className="space-y-6 px-4">
          <SectionHeader title="Active Rituals" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <StandardOfferCard offer={offers[0]!} />
            <ExclusiveOfferCard offer={offers[1]!} />
            <FullWidthOfferCard offer={offers[2]!} />
          </div>
        </section>

        <PromotionsNewsletter />
      </main>
      <PromotionsBottomNav />
    </>
  );
}
