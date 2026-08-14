/**
 * Top navigation header for the referral page.
 * Contains back button, brand name, desktop nav links, and account icon.
 */

import { useTranslation } from 'react-i18next';
import { BODY_FONT, DISPLAY_FONT } from './StitchReferralNew2-constants';
import { ArrowBackIcon, AccountCircleIcon } from './StitchReferralNew2-icons';

export function ReferralHeader() {
  const { t } = useTranslation();
  return (
    <header
      className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/20 bg-[var(--aura-bg-page, #0A1A2E)]/60 px-5 backdrop-blur-xl md:px-6"
      role="banner"
      aria-label={t('stitch.referral.headerAria')}
    >
      {/* Left: back arrow + brand */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="text-[#efbd8a] transition-transform active:scale-95"
          aria-label={t('stitch.referral.backAria')}
        >
          <ArrowBackIcon className="h-6 w-6" />
        </button>
        <span className={`${DISPLAY_FONT} text-2xl tracking-tight text-[#efbd8a]`}>
          AURA CAFE
        </span>
      </div>

      {/* Center: desktop nav links */}
      <nav className="hidden items-center gap-8 md:flex" role="navigation" aria-label={t('stitch.referral.desktopNavAria')}>
        <a href="#menu" className={`${BODY_FONT} text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[#efbd8a]`}>
          {t('stitch.referral.navMenu')}
        </a>
        <a href="#referrals" className={`${BODY_FONT} text-xs font-semibold uppercase tracking-[0.1em] text-[#efbd8a]`}>
          {t('stitch.referral.navReferrals')}
        </a>
        <a href="#rewards" className={`${BODY_FONT} text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[#efbd8a]`}>
          {t('stitch.referral.navRewards')}
        </a>
        <a href="#profile" className={`${BODY_FONT} text-xs font-semibold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[#efbd8a]`}>
          {t('stitch.referral.navProfile')}
        </a>
      </nav>

      {/* Right: account icon */}
      <div className="flex items-center gap-4">
        <AccountCircleIcon className="h-6 w-6 text-[var(--aura-text-secondary, #a0a8b0)]" />
      </div>
    </header>
  );
}
