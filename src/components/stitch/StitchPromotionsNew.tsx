/**
 * StitchPromotionsNew — AURA CAFE Promotions (Stitch design, regenerated to exact HTML match)
 *
 * Dark navy promotions page with hero banner (countdown timer), active offers grid,
 * newsletter signup, and bottom navigation. Mobile-first responsive. Named export.
 * Source: stitch-exports/new-screens/promotions.html
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, ArrowRight, Lock, Zap } from 'lucide-react';

/* ─── Types ────────────────────────────────────────────────────────── */

export type PromoOfferStatus = 'active' | 'exclusive' | 'members-only';

export interface PromoOffer {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  badge?: { label: string; variant?: 'default' | 'glass' };
  schedule?: string;
  isLocked?: boolean;
  tags?: string[];
  cta?: string;
}

export interface StitchPromotionsNewProps {
  /** Duration of countdown in seconds */
  countdownSeconds?: number;
  /** Hero promotion data */
  hero?: PromoOffer;
  /** Active offers grid */
  offers?: PromoOffer[];
}

/* ─── Default hero data ────────────────────────────────────────────── */

const defaultHero: PromoOffer = {
  id: 'hero',
  title: 'The Nocturnal Reserve',
  description: 'Experience the depth of our signature dark roast. 20% off all signature brews for a limited time.',
  imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXZc7z3nQmqBI7wSM2YrEtK1XTa5i0dvuhUMsh5rfegDYqwjttjsQO9GT17jSAne54AnoItLlzu_Ud88YY3JeZtgF5mnAOtYtcbyd-X3bOZ5rhyYwZvSE5AfUp1egeyWWm7OdELUfAtyxsw3mwr9WLu7MSzU43wlPjirTR7933KNwj9l61kJ0IseGLXYCYqdneq1DIqHgdN_CQzzWKDxMlicX-L6ZYAj328cMZnw_VCTd1Kebp5CZA27o7xpxFhJH6BqiQbdh7c8w',
  imageAlt: 'A moody, high-contrast close-up of a premium espresso machine portafilter dispensing a rich, dark crema espresso',
  badge: { label: 'Limited Release', variant: 'default' },
};

const defaultOffers: PromoOffer[] = [
  {
    id: 'golden-hour',
    title: 'Golden Hour Ritual',
    description: '2-for-1 on all cold brews during the final hour of service.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBbz03dO05LEHW8M7oOjgzUtUMuj1i6D2gS_stoSDAmOWc9sH6WACJ2JrzKsHIzyRcGZKOHtssAbhshucUIBuCuUU9r7pMKyE7He-K10RAgHSSK0HTlEaUIQAuXRgp6uwrCIV4-FThy2vj8lq8e4V4vbENn5_ywgyxSdEA1NOj4pX6ZvqGyt92CbtI-nfWioIQEmkZvVMN0wU-WyF6rvMWJOeA_-p05SY0znfSB6KhtDAn0Y_cGy1P5q4iUDBHgNfxSdQ-tm7WdOTM',
    imageAlt: 'Two glasses of chilled nitro cold brew coffee on a brushed metal counter',
    badge: { label: 'Active', variant: 'default' },
    schedule: 'DAILY 8PM - 9PM',
  },
  {
    id: 'inner-circle',
    title: 'Inner Circle Exclusive',
    description: '15% off artisanal pastries for our Inner Circle members.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBO9jQXkMZApig7yiTKPXWTtp9c4wtV486LyQu8ryem0dlXjYwvnH__gC5P22OJ7MRJXYh-plld-3gzvdP0uOwJMn1mTq9D1e4AhDQ8ict72nmNEf2mNQB3iLKUUfUPGA_k5FgvXgyAcIbhmrvyMTaslf8YvnGIHJU_nrzPo3mslDSwH0wwrVHdJ1DX0OTp5tAw4m5gnhgAaEWpLowE3J5YRuaDmonae_6rDq2YFHE6t6mBCr3EEDzMh-HC4j28k2jJCuG5I7XYrn8',
    imageAlt: 'A selection of artisanal pastries arranged on a sleek black slate tray',
    badge: { label: 'Exclusive', variant: 'glass' },
    isLocked: true,
  },
  {
    id: 'weekend-solace',
    title: 'Weekend Solace',
    description: 'Receive a complimentary chrome-plated vessel with all bulk bean purchases this weekend only.',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA41EThFPJ_vHeqAPS8kNCeuPv3tCQCBjUwACrxNlKGu-ijeLCSgc3r8-UdsK5_uHU7fgTMo6fnPswmcKHVqjagEbKyodeWLeyVxbWNnO7JOSLqrEYyDIw0EZGcr5ahAODc5I6vjb7VyuGiQ4K9xcbZRYV6YaPZZaapXMQ70IuzKVbuqVS1_-alWHI-t6yGNlz7oIxPPu7U3Q01SJjfJHgxDLw7SiOsEMMl6vs9Lxyl112YhnbViCz5eEkTQYmx6Ot1j5fg10yPfh4',
    imageAlt: 'A sleek, minimalist chrome-plated reusable coffee vessel on a dark industrial surface',
    badge: { label: 'Limited', variant: 'default' },
    tags: ['CHROME SERIES', 'LIMITED STOCK'],
    cta: 'Details',
  },
];

/* ─── Component ────────────────────────────────────────────────────── */

export function StitchPromotionsNew({
  countdownSeconds = 4 * 60 * 60 + 22 * 60 + 15,
  hero = defaultHero,
  offers = defaultOffers,
}: Readonly<StitchPromotionsNewProps>) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(countdownSeconds);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

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

  const formatTime = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  /* ─── Safe-access local refs ──────────────────────────────────────── */
  const o0: NonNullable<(typeof offers)[0]> = offers[0]!;
  const o1: NonNullable<(typeof offers)[0]> = offers[1]!;
  const o2: NonNullable<(typeof offers)[0]> = offers[2]!;

  return (
    <>
      <header
        data-promo-header
        className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-[var(--aura-chrome-soft)]/30 bg-[var(--aura-surface-dim)]/80 px-4 py-2 backdrop-blur-xl"
      >
        <div className="flex items-center">
          <button className="flex items-center text-[var(--aura-chrome-bright)]" type="button" aria-label="Menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
        <h1 className="font-[family-name:var(--aura-display-font)] text-2xl tracking-tighter text-[var(--aura-chrome-bright)]">
          AURA CAFE
        </h1>
        <div className="h-6 w-6" />
      </header>
      <main className="min-h-screen bg-[var(--aura-surface-dim)] pb-32 pt-14">
        {/* Hero Promotion Section */}
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
              <div
                className="p-6"
                style={{
                  background: 'rgba(198, 198, 199, 0.1)',
                  backdropFilter: 'blur(24px)',
                  borderTop: '1px solid rgba(198, 198, 199, 0.3)',
                  borderLeft: '1px solid rgba(198, 198, 199, 0.3)',
                  borderBottom: '1px solid rgba(187, 199, 222, 0.1)',
                  borderRight: '1px solid rgba(187, 199, 222, 0.1)',
                  boxShadow: '0 0 20px 0 rgba(212, 165, 116, 0.15)',
                }}
              >
                <div className="mb-2 flex items-start justify-between">
                  {hero.badge && (
                    <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.1em] text-[var(--aura-bronze-shimmer)]">
                      {hero.badge.label}
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-[var(--aura-bronze-shimmer)]">
                    <Clock className="h-4 w-4" />
                    <span className="font-[family-name:var(--aura-body-font)] text-xs">{formatTime(timeLeft)}</span>
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
              </div>
            </div>
          </div>
        </section>

        {/* Active Offers Grid */}
        <section className="space-y-6 px-4">
          <h3 className="border-l-2 border-[var(--aura-bronze-shimmer)] pl-4 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.3em] text-[var(--aura-chrome-soft)]">
            Active Rituals
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Offer 1 */}
            <div
              className="group overflow-hidden"
              style={{
                background: 'rgba(198, 198, 199, 0.1)',
                backdropFilter: 'blur(24px)',
                borderTop: '1px solid rgba(198, 198, 199, 0.3)',
                borderLeft: '1px solid rgba(198, 198, 199, 0.3)',
                borderBottom: '1px solid rgba(187, 199, 222, 0.1)',
                borderRight: '1px solid rgba(187, 199, 222, 0.1)',
              }}
            >
              <div className="relative h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={o0.imageUrl}
                  alt={o0.imageAlt}
                />
                {o0.badge && (
                  <div className="absolute left-4 top-4 bg-[var(--aura-bronze-shimmer)] px-2 py-1">
                    <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase text-[var(--aura-surface-dim)]">
                      {o0.badge.label}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h4 className="mb-1 font-[family-name:var(--aura-display-font)] text-2xl text-[var(--aura-chrome-bright)]">
                  {o0.title}
                </h4>
                <p className="mb-6 font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-soft)]">
                  {o0.description}
                </p>
                <div className="mb-6 h-px w-full bg-[var(--aura-chrome-soft)]/30" />
                <div className="flex items-center justify-between">
                  {o0.schedule && (
                    <span className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)]">
                      {o0.schedule}
                    </span>
                  )}
                  <ArrowRight className="text-[var(--aura-chrome-bright)]" size={20} />
                </div>
              </div>
            </div>

            {/* Offer 2 */}
            <div
              className="group overflow-hidden"
              style={{
                background: 'rgba(198, 198, 199, 0.1)',
                backdropFilter: 'blur(24px)',
                borderTop: '1px solid rgba(198, 198, 199, 0.3)',
                borderLeft: '1px solid rgba(198, 198, 199, 0.3)',
                borderBottom: '1px solid rgba(187, 199, 222, 0.1)',
                borderRight: '1px solid rgba(187, 199, 222, 0.1)',
              }}
            >
              <div className="relative h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={o1.imageUrl}
                  alt={o1.imageAlt}
                />
                {o1.badge && (
                  <div className="absolute right-4 top-4 border border-[var(--aura-chrome-soft)]/50 bg-[var(--aura-chrome-soft)]/20 px-2 py-1 backdrop-blur-md">
                    <span className="font-[family-name:var(--aura-body-font)] text-xs uppercase text-[var(--aura-chrome-bright)]">
                      {o1.badge.label}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h4 className="mb-1 font-[family-name:var(--aura-display-font)] text-2xl text-[var(--aura-chrome-bright)]">
                  {o1.title}
                </h4>
                <p className="mb-6 font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-soft)]">
                  {o1.description}
                </p>
                <div className="mb-6 h-px w-full bg-[var(--aura-chrome-soft)]/30" />
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)]">
                    MEMBERS ONLY
                  </span>
                  <Lock className="text-[var(--aura-chrome-bright)]" size={20} />
                </div>
              </div>
            </div>

            {/* Offer 3 - Full width */}
            <div
              className="group overflow-hidden md:col-span-2"
              style={{
                background: 'rgba(198, 198, 199, 0.1)',
                backdropFilter: 'blur(24px)',
                borderTop: '1px solid rgba(198, 198, 199, 0.3)',
                borderLeft: '1px solid rgba(198, 198, 199, 0.3)',
                borderBottom: '1px solid rgba(187, 199, 222, 0.1)',
                borderRight: '1px solid rgba(187, 199, 222, 0.1)',
              }}
            >
              <div className="flex flex-col md:flex-row">
                <div className="relative h-48 overflow-hidden md:h-auto md:w-1/3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    src={o2.imageUrl}
                    alt={o2.imageAlt}
                  />
                </div>
                <div className="flex-1 p-6">
                  <h4 className="mb-1 font-[family-name:var(--aura-display-font)] text-2xl text-[var(--aura-chrome-bright)]">
                    {o2.title}
                  </h4>
                  <p className="mb-6 font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-soft)]">
                    {o2.description}
                  </p>
                  {o2.tags && (
                    <div className="mb-6 flex flex-wrap gap-2">
                      {o2.tags.map((tag) => (
                        <span
                          key={tag}
                          className="border border-[var(--aura-chrome-soft)]/50 bg-[var(--aura-surface-container)] px-3 py-1 font-[family-name:var(--aura-body-font)] text-[10px] text-[var(--aura-chrome-soft)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="border border-[var(--aura-chrome-bright)] px-8 py-3 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-widest text-[var(--aura-chrome-bright)] transition-colors hover:bg-[var(--aura-chrome-bright)] hover:text-[var(--aura-surface-dim)]"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="px-4 py-12">
          <div
            className="relative overflow-hidden p-6"
            style={{
              background: 'rgba(198, 198, 199, 0.1)',
              backdropFilter: 'blur(24px)',
              borderTop: '1px solid rgba(198, 198, 199, 0.3)',
              borderLeft: '1px solid rgba(198, 198, 199, 0.3)',
              borderBottom: '1px solid rgba(187, 199, 222, 0.1)',
              borderRight: '1px solid rgba(187, 199, 222, 0.1)',
            }}
          >
            <div className="absolute -right-12 -top-12 opacity-5">
              <Zap className="text-[160px] text-[var(--aura-chrome-bright)]" />
            </div>
            <div className="relative z-10">
              <h3 className="mb-1 font-[family-name:var(--aura-display-font)] text-[28px] text-[var(--aura-chrome-bright)]">
                Join the Inner Circle
              </h3>
              <p className="mb-6 font-[family-name:var(--aura-body-font)] text-sm text-[var(--aura-chrome-soft)]">
                Direct access to private events, rare bean drops, and weekly rituals.
              </p>
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <div className="relative">
                  <input
                    className="w-full border-b border-[var(--aura-chrome-soft)]/50 bg-transparent py-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-wider text-[var(--aura-chrome-bright)] placeholder:text-[var(--aura-chrome-soft)]/50 focus:border-[var(--aura-bronze-shimmer)] focus:outline-none focus:ring-0"
                    placeholder="ENCRYPTED EMAIL"
                    type="email"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[var(--aura-bronze-shimmer)] py-2 font-[family-name:var(--aura-body-font)] text-xs uppercase tracking-[0.2em] text-[var(--aura-surface-dim)] transition-all active:scale-95"
                >
                  Authenticate
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Terms */}
        <footer className="px-4 pb-12 text-center">
          <p className="mb-1 font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-widest text-[var(--aura-chrome-soft)]/50">
            Promotion terms apply. Subject to availability.
          </p>
          <button
            type="button"
            className="font-[family-name:var(--aura-body-font)] text-xs text-[var(--aura-bronze-shimmer)] underline underline-offset-4 decoration-[var(--aura-bronze-shimmer)]/30 transition-all hover:decoration-[var(--aura-bronze-shimmer)]"
          >
            View Details
          </button>
        </footer>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-full border-t border-[var(--aura-chrome-bright)]/20 bg-[var(--aura-surface-dim)]/10 px-4 pb-6 pt-3 backdrop-blur-2xl">
        <button
          type="button"
          className="flex flex-col items-center justify-center pt-3 text-[var(--aura-chrome-soft)] transition-all hover:bg-[var(--aura-chrome-soft)]/20 active:scale-95"
        >
          <span
            className="material-symbols-outlined text-[var(--aura-chrome-soft)]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          >
            restaurant_menu
          </span>
          <span className="mt-1 font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-tighter text-[var(--aura-chrome-soft)]">
            Menu
          </span>
        </button>
        <button
          type="button"
          className="relative flex flex-col items-center justify-center pt-3 text-[var(--aura-bronze-shimmer)]"
        >
          <div
            className="absolute -top-1 w-8"
            style={{
              height: '2px',
              background: 'var(--aura-bronze-shimmer)',
              boxShadow: '0 0 8px var(--aura-bronze-shimmer)',
            }}
          />
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          >
            auto_awesome
          </span>
          <span className="mt-1 font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-tighter text-[var(--aura-bronze-shimmer)]">
            Promotions
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center pt-3 text-[var(--aura-chrome-soft)] transition-all hover:bg-[var(--aura-chrome-soft)]/20 active:scale-95"
        >
          <span className="material-symbols-outlined text-[var(--aura-chrome-soft)]">person</span>
          <span className="mt-1 font-[family-name:var(--aura-body-font)] text-[10px] uppercase tracking-tighter text-[var(--aura-chrome-soft)]">
            Account
          </span>
        </button>
      </nav>
    </>
  );
}
