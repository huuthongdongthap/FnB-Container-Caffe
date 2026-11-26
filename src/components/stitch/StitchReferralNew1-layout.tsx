'use client';

import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { X, UtensilsCrossed, UserPlus, Medal, User } from 'lucide-react';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

export function ReferralHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const initials = (user?.name || 'AC')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'AC';

  return (
    <header
      className="w-full bg-[var(--aura-noir-void, #050D1A)]/80 backdrop-blur-[8px] border-b border-white/10 flex justify-between items-center px-5 h-16 shadow-none"
      role="banner"
      aria-label={t('stitch.referral.headerAria')}
    >
      <button
        type="button"
        onClick={() => navigate('/account')}
        className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 transition-transform cursor-pointer"
        aria-label={t('stitch.referral.closeAria', { defaultValue: 'Quay lại tài khoản' })}
      >
        <X className="h-6 w-6" />
      </button>
      <Link
        to="/"
        className="font-display text-[24px] leading-[1.2] font-medium tracking-widest text-[var(--aura-chrome-bright)]"
      >
        AURA CAFE
      </Link>
      <Link
        to="/account"
        aria-label={t('stitch.referral.profileAvatarAlt', { defaultValue: 'Tài khoản hội viên' })}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-[11px] font-bold text-[var(--aura-chrome-bright)] hover:bg-white/20 transition-colors"
        style={{ border: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 30%, transparent)' }}
      >
        {user ? initials : <User className="h-4 w-4" />}
      </Link>
    </header>
  );
}

export function ReferralBottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 w-full z-50 rounded-t-xl bg-[var(--aura-surface-container)]/90 backdrop-blur-[8px] border-t border-white/5 flex justify-around items-center h-20 px-2"
      style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}
      role="navigation"
      aria-label={t('stitch.referral.navAria')}
    >
      <a
        href="/menu"
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] opacity-60 hover:text-[var(--aura-chrome-bright)] transition-colors active:scale-90 transition-transform"
        aria-label={t('stitch.referral.navMenuAria')}
      >
        <UtensilsCrossed className="h-6 w-6" />
        <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navMenu', { defaultValue: 'Menu' })}</span>
      </a>

      <a
        href="/referral"
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-bright)] rounded-xl px-3 py-1 active:scale-90 transition-transform"
        style={{
          backgroundColor: 'rgba(100, 66, 26, 0.2)',
          boxShadow: '0 0 15px color-mix(in srgb, var(--aura-chrome-bright) 15%, transparent)',
        }}
        aria-current="page"
        aria-label={t('stitch.referral.navReferralsAria')}
      >
        <UserPlus className="h-6 w-6" />
        <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navReferrals', { defaultValue: 'Referrals' })}</span>
      </a>

      <a
        href="/loyalty"
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] opacity-60 hover:text-[var(--aura-chrome-bright)] transition-colors active:scale-90 transition-transform"
        aria-label={t('stitch.referral.navRewardsAria')}
      >
        <Medal className="h-6 w-6" />
        <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navRewards', { defaultValue: 'Rewards' })}</span>
      </a>

      <a
        href="/account"
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] opacity-60 hover:text-[var(--aura-chrome-bright)] transition-colors active:scale-90 transition-transform"
        aria-label={t('stitch.referral.navProfileAria')}
      >
        <User className="h-6 w-6" />
        <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navProfile', { defaultValue: 'Profile' })}</span>
      </a>
    </nav>
  );
}
