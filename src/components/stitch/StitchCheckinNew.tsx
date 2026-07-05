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
import { useState } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { cn } from '@/lib/cn';
import {
  Menu,
  UserCircle,
  Smartphone,
  ChevronRight,
  Scan,
  Home,
  History,
} from 'lucide-react';

/* ─── Glass card style ──────────────────────────────────────────── */

const glassCardClasses =
  'bg-[rgba(22,32,47,0.6)] backdrop-blur-[12px] border border-[rgba(198,198,199,0.1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

/* ─── Props ─────────────────────────────────────────────────────── */

export interface StitchCheckinNewProps {
  onCheckin?: (phone: string) => void;
  onMenu?: () => void;
  onAccount?: () => void;
  onNavigate?: (path: string) => void;
  isLoading?: boolean;
}

/* ─── Phone number formatter ────────────────────────────────────── */

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  const match = digits.match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
  if (!match) return digits;
  const p1 = match[1] ?? '';
  const p2 = match[2] ?? '';
  const p3 = match[3] ?? '';
  if (!p2) return p1;
  return `(${p1}) ${p2}${p3 ? `-${p3}` : ''}`;
}

/* ─── Component ─────────────────────────────────────────────────── */

export function StitchCheckinNew({
  onCheckin,
  onMenu,
  onAccount,
  onNavigate,
  isLoading,
}: StitchCheckinNewProps) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSubmit = () => {
    const raw = phone.replace(/\D/g, '');
    if (raw.length >= 10) {
      onCheckin?.(raw);
    }
  };

  return (
    <>
      <HelmetHead
        title="Loyalty Check-In"
        description="Check in to AURA CAFE and earn Aura Points with every visit."
      />

      {/* Ambient background decoration orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-[0.05] blur-[100px]"
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

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[var(--aura-surface-dim)]/80 backdrop-blur-md border-b border-white/10 flex justify-between items-center px-5 h-16"
        style={{ boxShadow: '0px 0px 15px rgba(212,165,116,0.1)' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onMenu}
            className="text-[var(--aura-bronze-shimmer)] hover:opacity-80 transition-opacity active:scale-95 transition-transform"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-[24px] font-bold leading-tight font-['EB_Garamond'] text-[var(--aura-bronze-shimmer)] tracking-tighter">
            AURA CAFE
          </h1>
        </div>
        <button
          onClick={onAccount}
          className="text-[var(--aura-bronze-shimmer)] hover:opacity-80 transition-opacity active:scale-95 transition-transform"
          aria-label="Account"
        >
          <UserCircle className="w-6 h-6" />
        </button>
      </header>

      <main className="pt-24 pb-32 px-5 max-w-md mx-auto min-h-screen">
        {/* Hero Glass Card */}
        <section className={cn(glassCardClasses, 'rounded-xl p-8 mb-8 relative overflow-hidden')}>
          <div className="relative z-10">
            <p className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-bronze-shimmer)] mb-2">
              {t('checkin.loyaltyProgram', 'LOYALTY PROGRAM')}
            </p>
            <h2 className="text-[24px] font-bold leading-tight font-['EB_Garamond'] text-[var(--aura-chrome-bright)] mb-4">
              {t('checkin.title', 'Check-In')}
            </h2>
            <p className="font-['Space_Grotesk'] text-[16px] leading-relaxed text-[var(--aura-chrome-soft)]">
              {t('checkin.description', 'Welcome back to Aura. Enter your mobile number to earn')}{' '}
              <span className="text-[var(--aura-bronze-shimmer)] font-bold">Aura Points</span>{' '}
              {t('checkin.forVisit', 'for your visit today.')}
            </p>
          </div>
          {/* Decorative vertical line */}
          <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-transparent via-[var(--aura-bronze-shimmer)]/20 to-transparent" />
        </section>

        {/* Input Section */}
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
            style={{
              boxShadow: '0px 0px 15px rgba(212, 165, 116, 0.3)',
            }}
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

        {/* QR divider */}
        <div className="flex items-center gap-4 mb-12">
          <div className="h-px flex-1 bg-white/10" />
          <span className="font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-bright)]/50">
            {t('checkin.orScan', 'OR SCAN CODE')}
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* QR Scanner Viewfinder */}
        <section className="flex flex-col items-center">
          <div
            className={cn(
              glassCardClasses,
              'rounded-lg overflow-hidden relative flex items-center justify-center group',
            )}
            style={{ width: 180, height: 180 }}
          >
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[var(--aura-chrome-bright)]" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[var(--aura-chrome-bright)]" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[var(--aura-chrome-bright)]" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[var(--aura-chrome-bright)]" />

            {/* Scan placeholder */}
            <div className="w-full h-full relative">
              <div
                className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700"
                style={{
                  backgroundImage:
                    'url("https://lh3.googleusercontent.com/aida-public/AB6AXuAUzz6Ndzmf_7DYvRwfw0dyyAdr258WHDlCKJLLtVur7Jc98y6A8oAQC21wLKBwsPauaFdnzKIa59vNDZd6G04BjsXA73U-aklpE6pK0jJ2z-eXD6cilqtdUbSzBwQQgeJTV9DY6RPt5P3ZR6phG_Nhh7MCvToNNE98kPjFUwQmdSEksj8e_64BDymYs1v2b7kXbYC9y40_uD2R0J4a1cDQMHIMooUwxMC74y8YZOp-qSk2pWFDaPDIg723owN6fZMKoOhm9QxQEr4")',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              {/* Laser scan line */}
              <div
                className="absolute left-0 w-full h-[2px] bg-[var(--aura-bronze-shimmer)]"
                style={{
                  boxShadow: '0px 0px 10px var(--aura-bronze-shimmer)',
                  animation: 'aura-scan 3s ease-in-out infinite',
                }}
              />
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-[var(--aura-bronze-shimmer)]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <Scan className="w-9 h-9 text-[var(--aura-bronze-shimmer)]" />
            </div>
          </div>
          <p className="mt-6 font-['Space_Grotesk'] text-[12px] font-semibold tracking-[0.1em] uppercase text-[var(--aura-chrome-bright)] text-center tracking-widest">
            {t('checkin.qrHint', 'POSITION QR CODE IN FRAME')}
          </p>
        </section>
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-5 py-4 bg-[var(--aura-surface-dim)]/90 backdrop-blur-xl border-t border-[var(--aura-chrome-bright)]/20 z-50">
        <button
          onClick={() => onNavigate?.('/')}
          className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] p-3 hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-90 transition-all duration-200"
        >
          <Home className="w-6 h-6" />
        </button>
        <button
          onClick={() => onNavigate?.('/checkin')}
          className="flex flex-col items-center justify-center bg-[var(--aura-bronze-shimmer)] text-white rounded-full p-3 active:scale-90 transition-all duration-200"
          style={{ boxShadow: '0px 0px 12px rgba(212,165,116,0.4)' }}
        >
          <Scan className="w-6 h-6" />
        </button>
        <button
          onClick={() => onNavigate?.('/history')}
          className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] p-3 hover:text-[var(--aura-bronze-shimmer)] transition-colors active:scale-90 transition-all duration-200"
        >
          <History className="w-6 h-6" />
        </button>
      </nav>

      {/* Keyframes */}
      <style>{`
        @keyframes aura-pulse-slow {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.3; }
        }
        @keyframes aura-scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </>
  );
}
