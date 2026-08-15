import { useEffect, useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';
import { OFFERS } from './constants';
import { HeroSection } from './hero-section';
import { OfferCard } from './offer-card';
import { NewsletterSection } from './newsletter-section';
import { BottomNav } from './bottom-nav';

export type { CardOffer } from './types';

export default function PromotionsNew() {
  const [timer, setTimer] = useState(4 * 3600 + 22 * 60 + 15);

  useEffect(() => {
    const id = setInterval(() => {
      setTimer(t => (t > 0 ? t - 1 : 4 * 3600 + 22 * 60 + 15));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatTime = (sec: number) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <StitchShell>
      <PageHeader brand="AURA CAFE" scrollEffect />

      <main className="pb-32">
        <HeroSection offer={OFFERS[0]!} timer={timer} formatTime={formatTime} />

        <section className="px-6 space-y-4">
          <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-[0.3em] border-l-2 border-[var(--aura-tertiary)] pl-4">
            Active Rituals
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {OFFERS.slice(1).map(offer => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>

        <NewsletterSection />

        <PageFooter brand="AURA CAFE" socialSize="sm" />
      </main>

      <BottomNav />
    </StitchShell>
  );
}
