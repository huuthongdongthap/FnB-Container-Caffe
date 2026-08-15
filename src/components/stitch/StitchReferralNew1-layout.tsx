'use client';

import { useTranslation } from 'react-i18next';
import { X, UtensilsCrossed, UserPlus, Medal, User } from 'lucide-react';

export function ReferralHeader() {
  const { t } = useTranslation();
  return (
    <header
      className="fixed top-0 w-full z-50 bg-[#091421]/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-5 h-16 shadow-none"
      role="banner"
      aria-label={t('stitch.referral.headerAria')}
    >
      <button
        type="button"
        className="text-[var(--aura-chrome-bright)] hover:opacity-80 transition-opacity active:scale-95 transition-transform"
        aria-label={t('stitch.referral.closeAria')}
      >
        <X className="h-6 w-6" />
      </button>
      <span className="font-display text-[24px] leading-[1.2] font-medium tracking-widest text-[var(--aura-chrome-bright)]">
        AURA CAFE
      </span>
      <div className="w-8 h-8 rounded-full overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 30%, transparent)' }}>
        <img
          className="w-full h-full object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBh-JKKrdKFObQU9h8Wnj2vKscgz4U9ak0LI7UIhXw18eDS0I6JPVZo-UPpwccmzw0tgUErqepBlzn43qBcDykg7E5WrkdatYzNJ2qtopegH_jBtchV2C1rQ7Kkp8pTkRGqpbshu_APsPuW51WiPlPjLAkoVg0Zzjm8JTaGzys_UzLAeaP2FpN6P8h3yaWvK70iK5dqfU1djDZMEwH8LZZ0vcAy7AkpOkRAlsfJpGhk035Js4uPSr_RlL69GNxbiZwHhKAV4pYaTd8"
          alt={t('stitch.referral.profileAvatarAlt')}
          loading="lazy"
        />
      </div>
    </header>
  );
}

export function ReferralBottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 w-full z-50 rounded-t-xl bg-[var(--aura-surface-container)]/90 backdrop-blur-2xl border-t border-white/5 flex justify-around items-center h-20 px-2"
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
        href="/referrals"
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
        href="/rewards"
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] opacity-60 hover:text-[var(--aura-chrome-bright)] transition-colors active:scale-90 transition-transform"
        aria-label={t('stitch.referral.navRewardsAria')}
      >
        <Medal className="h-6 w-6" />
        <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navRewards', { defaultValue: 'Rewards' })}</span>
      </a>

      <a
        href="/profile"
        className="flex flex-col items-center justify-center text-[var(--aura-chrome-soft)] opacity-60 hover:text-[var(--aura-chrome-bright)] transition-colors active:scale-90 transition-transform"
        aria-label={t('stitch.referral.navProfileAria')}
      >
        <User className="h-6 w-6" />
        <span className="font-body text-[12px] leading-[1.2] font-medium">{t('stitch.referral.navProfile', { defaultValue: 'Profile' })}</span>
      </a>
    </nav>
  );
}
