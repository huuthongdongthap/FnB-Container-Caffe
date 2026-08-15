/**
 * StitchCheckinNew — Loyalty check-in screen for AURA CAFE
 *
 * Regenerated from the original Stitch HTML export:
 *   stitch-exports/new-screens/checkin.html
 *
 * Design tokens mapped to --aura-* CSS variables:
 *   --aura-surface-dim    -> main bg (#081425)
 *   --aura-chrome-bright  -> bright text (#c6c6c7)
 *   --aura-chrome-soft    -> muted text (#a0a0a0)
 *   --aura-bronze-shimmer -> CTA/accent (#d4a574)
 *   Display font: 'EB Garamond', serif
 *   Body font: 'Space Grotesk', sans-serif
 */
'use client';

import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { cn } from '@/lib/cn';
import { Smartphone, ChevronRight } from 'lucide-react';

import { glassCardClasses, keyframeStyles } from './StitchCheckinNew-constants';
import { useCheckinForm } from './StitchCheckinNew-hooks';
import { TopAppBar } from './StitchCheckinNew-top-app-bar';
import { HeroCard } from './StitchCheckinNew-hero-card';
import { QrScanner } from './StitchCheckinNew-qr-scanner';
import { BottomNav } from './StitchCheckinNew-bottom-nav';

/* ─── Re-exports for backward compatibility ─────────────────────── */
export type { StitchCheckinNewProps } from './StitchCheckinNew-types';
export { formatPhone } from './StitchCheckinNew-hooks';

/* ─── Component ─────────────────────────────────────────────────── */

export function StitchCheckinNew({
  onCheckin,
  onMenu,
  onAccount,
  onNavigate,
  isLoading,
}: import('./StitchCheckinNew-types').StitchCheckinNewProps) {
  const { t } = useTranslation();
  const { phone, handlePhoneChange, handleSubmit } = useCheckinForm(onCheckin);

  return (
    <>
      <HelmetHead
        title="Loyalty Check-In"
        description="Check in to AURA CAFE and earn Aura Points with every visit."
      />

      {/* Ambient background decoration orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-[0.05] blur-[100px]"
          style={{
            background: 'var(--aura-bronze-shimmer)',
            animation: 'aura-pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
        <div
          className="absolute top-1/2 -left-32 w-80 h-80 rounded-full opacity-[0.04] blur-[120px]"
          style={{
            background: 'var(--aura-chrome-bright)',
            animation: 'aura-pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 2s',
          }}
        />
      </div>

      <TopAppBar onMenu={onMenu} onAccount={onAccount} />

      <main className="pt-24 pb-32 px-5 max-w-md mx-auto min-h-screen">
        <HeroCard />

        {/* Phone Input Section */}
        <section className="space-y-6 mb-12">
          <div className="space-y-2">
            <label
              htmlFor="checkin-phone"
              className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-bright)] block ml-1"
            >
              {t('checkin.phoneLabel', 'PHONE NUMBER')}
            </label>
            <div className="relative">
              <input
                id="checkin-phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(000) 000-0000"
                className="w-full bg-[var(--aura-surface-dim)]/60 border-b border-[var(--aura-chrome-bright)]/30 focus:border-[var(--aura-bronze-shimmer)] text-[var(--aura-chrome-bright)] py-4 px-1 text-[20px] font-medium outline-none transition-all placeholder:text-[var(--aura-chrome-soft)]/30"
                aria-label="Phone number"
              />
              <div className="absolute right-0 bottom-4 text-[var(--aura-bronze-shimmer)]/40 pointer-events-none">
                <Smartphone className="w-5 h-5" />
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading || phone.replace(/\D/g, '').length < 10}
            className={cn(
              'w-full py-5 bg-[var(--aura-bronze-shimmer)] text-white font-[\'Space_Grotesk\'] text-[18px] font-bold leading-tight rounded-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            style={{ boxShadow: '0px 0px 15px rgba(212, 165, 116, 0.3)' }}
          >
            {isLoading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {t('checkin.submit', 'Check-In & Earn Points')}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </section>

        <QrScanner />
      </main>

      <BottomNav onNavigate={onNavigate} />

      <style>{keyframeStyles}</style>
    </>
  );
}
